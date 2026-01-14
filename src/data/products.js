// src/data/products.js
// Product data layer with Supabase + caching

import { 
  getAllProducts as dbGetAllProducts,
  getProductByCode as dbGetProductByCode,
  searchProducts as dbSearchProducts,
  getProductsByCategory as dbGetProductsByCategory,
  getAllCategories as dbGetAllCategories,
} from '../database/products.js';
import { logger } from '../utils/logger.js';

// Import config
let BOT_CONFIG;
try {
  const module = await import('../bot/foramtters.js');
  BOT_CONFIG = module.BOT_CONFIG;
} catch {
  BOT_CONFIG = {
    PRODUCT_TTL_MS: Number(process.env.PRODUCT_TTL_MS) || 300000, // 5 minutes
  };
}

// In-memory cache
let PRODUCTS = [];
let LAST_LOAD = 0;
let PRODUCT_TOKENS = new Set();
let CATEGORIES_CACHE = [];

/**
 * Normalize text for searching
 */
const norm = (s) => String(s || '').toLowerCase().trim();
const normCode = (s) => norm(s).replace(/[^a-z0-9]/g, '');

/**
 * Split aliases
 */
export function splitAliases(s = '') {
  if (!s) return [];
  if (Array.isArray(s)) return s;
  
  return String(s)
    .split(/[\n,;|/]+/g)
    .map(t => t.trim())
    .filter(Boolean);
}

/**
 * Build search tokens from products
 */
export function buildProductTokens() {
  const tokens = new Set();
  
  for (const p of PRODUCTS) {
    // Add code
    if (p.kode) tokens.add(norm(p.kode));
    
    // Add words from name
    String(p.nama || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .map(s => s.trim())
      .filter(w => w && w.length >= 3)
      .forEach(w => tokens.add(w));
    
    // Add aliases
    const aliases = splitAliases(p.alias);
    aliases.forEach(w => {
      w.split(/[^a-z0-9]+/i)
        .filter(x => x && x.length >= 3)
        .forEach(x => tokens.add(x.toLowerCase()));
    });
  }
  
  PRODUCT_TOKENS = tokens;
  logger.info(`Built ${tokens.size} search tokens from ${PRODUCTS.length} products`);
}

/**
 * Load products from Supabase (with caching)
 */
export async function loadProducts(force = false) {
  const now = Date.now();
  const stale = (now - LAST_LOAD) > BOT_CONFIG.PRODUCT_TTL_MS;
  
  if (!force && PRODUCTS.length && !stale) {
    logger.info('Using cached products');
    return PRODUCTS;
  }

  try {
    logger.info('Loading products from Supabase...');
    
    const products = await dbGetAllProducts();
    
    // Log available items untuk setiap produk
    products.forEach(p => {
      if (p.available_items > 0 || p.total_items > 0) {
        logger.info(`📦 ${p.kode}: ${p.available_items}/${p.total_items} items tersedia`);
      } else if (p.stok > 0) {
        logger.warn(`⚠️  ${p.kode}: Stok lama=${p.stok} (no product_items found)`);
      }
    });
    
    PRODUCTS = products.map(p => ({
      // Supabase fields
      id: p.id,
      kode: p.kode || '',
      nama: p.nama || '',
      kategori: p.kategori || '',
      harga: String(p.harga || '0'),
      harga_lama: p.harga_lama ? String(p.harga_lama) : '',
      // Use available_items count instead of static stok field
      stok: String(p.available_items !== undefined ? p.available_items : (p.stok || '0')),
      available_items: p.available_items || 0,
      total_items: p.total_items || 0,
      ikon: p.ikon || '',
      deskripsi: p.deskripsi || '',
      wa: p.wa || '',
      alias: p.alias || [],
      aktif: p.aktif,
      created_at: p.created_at,
      updated_at: p.updated_at,
      // Legacy fields for compatibility
      terjual: '',
      total: '',
    }));

    LAST_LOAD = now;
    buildProductTokens();

    logger.info(`✅ Loaded ${PRODUCTS.length} products from Supabase`);
    return PRODUCTS;
    
  } catch (error) {
    logger.error('Failed to load products from Supabase:', { error: error.message });
    
    // If we have cached data, use it
    if (PRODUCTS.length > 0) {
      logger.warn('⚠️ Using stale cache due to error');
      return PRODUCTS;
    }
    
    throw error;
  }
}

/**
 * Get all categories
 */
export async function categories() {
  try {
    // Return from cache if available
    if (CATEGORIES_CACHE.length > 0 && PRODUCTS.length > 0) {
      return CATEGORIES_CACHE;
    }
    
    const cats = await dbGetAllCategories();
    CATEGORIES_CACHE = cats;
    return cats;
  } catch (error) {
    logger.error('Failed to get categories:', { error: error.message });
    
    // Fallback to local cache
    const localCats = [...new Set(PRODUCTS.map(p => p.kategori).filter(Boolean))];
    return localCats.sort();
  }
}

/**
 * Search products (local cache + fuzzy matching)
 */
export function searchProducts(q) {
  const s = norm(q);
  
  // Search in cached products
  return PRODUCTS.filter(p => {
    const fields = [
      p.nama,
      p.deskripsi,
      p.kode,
      p.kategori,
      ...(Array.isArray(p.alias) ? p.alias : splitAliases(p.alias))
    ];
    
    return fields.some(v => norm(v).includes(s));
  });
}

/**
 * Search products in database (for advanced search)
 */
export async function searchProductsDB(query) {
  try {
    const results = await dbSearchProducts(query);
    return results;
  } catch (error) {
    logger.error('Database search failed, using local:', { error: error.message });
    return searchProducts(query);
  }
}

/**
 * Get product by code (check cache first)
 */
export function byKode(code) {
  const c = normCode(code);
  
  return PRODUCTS.find(p => {
    // Check main code
    if (normCode(p.kode) === c) return true;
    
    // Check aliases
    const aliases = Array.isArray(p.alias) ? p.alias : splitAliases(p.alias);
    return aliases.some(a => normCode(a) === c);
  });
}

/**
 * Get product by code from database
 */
export async function byKodeDB(code) {
  try {
    const product = await dbGetProductByCode(code);
    return product;
  } catch (error) {
    logger.error('Failed to get product from DB:', { code, error: error.message });
    return byKode(code);
  }
}

/**
 * Get all products (from cache)
 */
export function getAll() {
  return PRODUCTS;
}

/**
 * Get search tokens
 */
export function getTokens() {
  return PRODUCT_TOKENS;
}

/**
 * Get products by category (from cache)
 */
export function byCategory(category) {
  return PRODUCTS.filter(p => norm(p.kategori) === norm(category));
}

/**
 * Get products by category from database
 */
export async function byCategoryDB(category) {
  try {
    const products = await dbGetProductsByCategory(category);
    return products;
  } catch (error) {
    logger.error('Failed to get category from DB:', { category, error: error.message });
    return byCategory(category);
  }
}

/**
 * Get product statistics
 */
export function getStats() {
  return {
    total: PRODUCTS.length,
    categories: [...new Set(PRODUCTS.map(p => p.kategori).filter(Boolean))].length,
    lastUpdate: new Date(LAST_LOAD).toISOString(),
    tokens: PRODUCT_TOKENS.size,
    cacheAge: Date.now() - LAST_LOAD,
  };
}

/**
 * Clear cache (force reload next time)
 */
export function clearCache() {
  PRODUCTS = [];
  LAST_LOAD = 0;
  PRODUCT_TOKENS = new Set();
  CATEGORIES_CACHE = [];
  logger.info('Product cache cleared');
}

/**
 * Legacy function for backward compatibility
 */
export function rowToProduct(r) {
  return {
    nama: r.nama || '',
    harga: r.harga || '',
    ikon: r.ikon || '',
    deskripsi: r.deskripsi || '',
    kategori: r.kategori || '',
    wa: r.wa || '',
    harga_lama: r.harga_lama || '',
    stok: r.stok || '',
    kode: r.kode || '',
    alias: r.alias || '',
    terjual: r.terjual || '',
    total: r.total || '',
  };
}

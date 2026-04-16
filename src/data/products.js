// src/data/products.js
// Product data layer with Supabase + caching

import { 
  getAllProducts as dbGetAllProducts,
  getProductByCode as dbGetProductByCode,
  searchProducts as dbSearchProducts,
  getProductsByCategory as dbGetProductsByCategory,
  getAllCategories as dbGetAllCategories,
} from '../database/products.js';
import crypto from 'node:crypto';
import { logger } from '../utils/logger.js';

// Import config
let BOT_CONFIG;
try {
  const module = await import('../bot/config.js');
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
let LAST_SELECTED_SAMPLE_HASH = '';
let STABLE_STOCK_BY_PRODUCT_KEY = new Map();

const BOT_STOCK_SWITCH_CONFIRMATION = 3;
const BOT_ZERO_DROP_EXTRA_CONFIRMATION = 2;
const MAX_STABLE_PRODUCTS = 1000;

function asNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hashProductsSnapshot(products = []) {
  const normalized = (products || [])
    .map((p) => ({
      id: String(p.id || ''),
      kode: String(p.kode || ''),
      aktif: p.aktif,
      stok: asNumber(p.stok),
      available_items: asNumber(p.available_items),
      total_items: asNumber(p.total_items),
      updated_at: String(p.updated_at || ''),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return crypto.createHash('sha1').update(JSON.stringify(normalized)).digest('hex');
}

function getProductStableKey(product = {}) {
  const id = String(product.id || '').trim();
  if (id) return `id:${id}`;

  const kode = String(product.kode || '').trim().toLowerCase();
  if (kode) return `kode:${kode}`;

  return '';
}

function sameStockTuple(a, b) {
  return a.stock === b.stock && a.available === b.available && a.total === b.total;
}

function pruneProductStabilityMap() {
  if (STABLE_STOCK_BY_PRODUCT_KEY.size <= MAX_STABLE_PRODUCTS) return;

  let oldestKey = '';
  let oldestSeenAt = Number.MAX_SAFE_INTEGER;

  for (const [key, state] of STABLE_STOCK_BY_PRODUCT_KEY.entries()) {
    if (state.lastSeenAt < oldestSeenAt) {
      oldestSeenAt = state.lastSeenAt;
      oldestKey = key;
    }
  }

  if (oldestKey) {
    STABLE_STOCK_BY_PRODUCT_KEY.delete(oldestKey);
  }
}

async function getStableProductsSnapshot(sampleCount = 3, sampleDelayMs = 120) {
  const samples = [];

  for (let i = 0; i < sampleCount; i += 1) {
    const data = await dbGetAllProducts();
    samples.push({ data, hash: hashProductsSnapshot(data) });

    if (i < sampleCount - 1) {
      await sleep(sampleDelayMs);
    }
  }

  const byHash = new Map();
  for (const sample of samples) {
    if (!byHash.has(sample.hash)) {
      byHash.set(sample.hash, { count: 0, data: sample.data });
    }
    byHash.get(sample.hash).count += 1;
  }

  let selectedHash = '';
  let selectedCount = -1;
  for (const [hash, info] of byHash.entries()) {
    if (info.count > selectedCount) {
      selectedHash = hash;
      selectedCount = info.count;
      continue;
    }

    // Tie-breaker: prefer previous selected hash to avoid oscillation.
    if (info.count === selectedCount && hash === LAST_SELECTED_SAMPLE_HASH) {
      selectedHash = hash;
    }
  }

  if (!selectedHash && samples.length > 0) {
    selectedHash = samples[samples.length - 1].hash;
  }

  const selected = byHash.get(selectedHash)?.data || samples[samples.length - 1]?.data || [];

  if (byHash.size > 1) {
    logger.warn('Detected inconsistent product snapshots, using stabilized selection', {
      hashes: Array.from(byHash.entries()).map(([hash, info]) => ({ hash, count: info.count })),
      selectedHash,
    });
  }

  LAST_SELECTED_SAMPLE_HASH = selectedHash;

  return selected;
}

function stabilizeProductsAcrossLoads(candidateProducts) {
  let heldCount = 0;
  let switchedCount = 0;
  const now = Date.now();

  const stabilized = (candidateProducts || []).map((product) => {
    const key = getProductStableKey(product);
    if (!key) {
      return product;
    }

    const candidateTuple = {
      stock: asNumber(product.stok),
      available: asNumber(product.available_items),
      total: asNumber(product.total_items),
    };

    const current = STABLE_STOCK_BY_PRODUCT_KEY.get(key);
    if (!current) {
      STABLE_STOCK_BY_PRODUCT_KEY.set(key, {
        stable: candidateTuple,
        pending: null,
        pendingHits: 0,
        lastSeenAt: now,
      });
      pruneProductStabilityMap();
      return product;
    }

    current.lastSeenAt = now;

    if (sameStockTuple(candidateTuple, current.stable)) {
      current.pending = null;
      current.pendingHits = 0;
      return product;
    }

    // Bias against false-zero flicker on low-stock products.
    if (candidateTuple.stock > current.stable.stock) {
      current.stable = { ...candidateTuple };
      current.pending = null;
      current.pendingHits = 0;
      switchedCount += 1;
      return product;
    }

    const isSuspiciousDropToZero =
      current.stable.stock > 0 && candidateTuple.stock === 0 && candidateTuple.total > 0;
    const requiredHits = isSuspiciousDropToZero
      ? BOT_STOCK_SWITCH_CONFIRMATION + BOT_ZERO_DROP_EXTRA_CONFIRMATION
      : BOT_STOCK_SWITCH_CONFIRMATION;

    if (current.pending && sameStockTuple(candidateTuple, current.pending)) {
      current.pendingHits += 1;
    } else {
      current.pending = { ...candidateTuple };
      current.pendingHits = 1;
    }

    if (current.pendingHits >= requiredHits) {
      current.stable = { ...candidateTuple };
      current.pending = null;
      current.pendingHits = 0;
      switchedCount += 1;
      return product;
    }

    heldCount += 1;
    return {
      ...product,
      stok: current.stable.stock,
      available_items: current.stable.available,
      total_items: current.stable.total,
    };
  });

  if (heldCount > 0 || switchedCount > 0) {
    logger.warn('Applied per-product bot stock stabilization', {
      heldCount,
      switchedCount,
      totalProducts: stabilized.length,
      requiredHitsBase: BOT_STOCK_SWITCH_CONFIRMATION,
    });
  }

  return stabilized;
}

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
    
    const sampledProducts = await getStableProductsSnapshot();
    const products = stabilizeProductsAcrossLoads(sampledProducts);
    
    // Log available items untuk setiap produk
    products.forEach(p => {
      if (p.available_items > 0 || p.total_items > 0) {
        logger.info(`📦 ${p.kode}: ${p.available_items}/${p.total_items} items tersedia`);
      } else if (p.stok > 0) {
        logger.warn(`⚠️  ${p.kode}: Stok lama=${p.stok} (no product_items found)`);
      }
    });
    
    PRODUCTS = products.map((p) => {
      const webPrice = asNumber(p.harga_web ?? p.harga_bot ?? p.harga ?? 0);
      const botPrice = asNumber(p.harga_bot ?? p.harga_web ?? p.harga ?? 0);
      const totalItems = asNumber(p.total_items);
      const availableItems = asNumber(p.available_items);
      const effectiveStock = totalItems > 0 ? availableItems : asNumber(p.stok);

      return {
      // Supabase fields
      id: p.id,
      kode: p.kode || '',
      nama: p.nama || '',
      kategori: p.kategori || '',
      harga_web: String(webPrice),
      harga_bot: String(botPrice),
      harga_lama: p.harga_lama ? String(p.harga_lama) : '',
      // Use item availability for item-managed products, fallback to static stock otherwise.
      stok: String(effectiveStock),
      available_items: availableItems,
      total_items: totalItems,
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
      };
    });

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
  LAST_SELECTED_SAMPLE_HASH = '';
  STABLE_STOCK_BY_PRODUCT_KEY = new Map();
  logger.info('Product cache cleared');
}

/**
 * Legacy function for backward compatibility
 */
export function rowToProduct(r) {
  const webPrice = asNumber(r.harga_web ?? r.harga_bot ?? r.harga ?? 0);
  const botPrice = asNumber(r.harga_bot ?? r.harga_web ?? r.harga ?? 0);

  return {
    nama: r.nama || '',
    harga_web: String(webPrice),
    harga_bot: String(botPrice),
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

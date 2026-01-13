// src/data/products.js
import { parse } from 'csv-parse/sync';

// Import config
let BOT_CONFIG;
try {
  const module = await import('../bot/config.js');
  BOT_CONFIG = module.BOT_CONFIG;
} catch {
  // Fallback
  BOT_CONFIG = {
    SHEET_URL: process.env.SHEET_URL || '',
    PRODUCT_TTL_MS: Number(process.env.PRODUCT_TTL_MS) || 120000,
  };
}

let PRODUCTS = [];
let LAST_LOAD = 0;
let PRODUCT_TOKENS = new Set();

/**
 * Normalize text for searching
 */
const norm = (s) => String(s || '').toLowerCase().trim();
const normCode = (s) => norm(s).replace(/[^a-z0-9]/g, '');

/**
 * Convert row to product object
 */
const lowerify = (r) => {
  const o = {};
  for (const k of Object.keys(r)) {
    o[k.trim().toLowerCase()] = (r[k] ?? '').toString().trim();
  }
  return o;
};

export function rowToProduct(r) {
  const o = lowerify(r);
  return {
    nama: o.nama || '',
    harga: o.harga || '',
    ikon: o.ikon || '',
    deskripsi: o.deskripsi || '',
    kategori: o.kategori || '',
    wa: o.wa || '',
    harga_lama: o.harga_lama || '',
    stok: o.stok || '',
    kode: o.kode || '',
    alias: o.alias || '',
    terjual: o.terjual || '',
    total: o.total || '',
  };
}

/**
 * Split aliases
 */
export function splitAliases(s = '') {
  return String(s)
    .split(/[\n,;|/]+/g)
    .map(t => t.trim())
    .filter(Boolean);
}

/**
 * Build search tokens
 */
export function buildProductTokens() {
  const tokens = new Set();
  for (const p of PRODUCTS) {
    if (p.kode) tokens.add(norm(p.kode));
    
    String(p.nama || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .map(s => s.trim())
      .filter(w => w && w.length >= 3)
      .forEach(w => tokens.add(w));
    
    splitAliases(p.alias).forEach(w => {
      w.split(/[^a-z0-9]+/i)
        .filter(x => x && x.length >= 3)
        .forEach(x => tokens.add(x.toLowerCase()));
    });
  }
  PRODUCT_TOKENS = tokens;
  console.log(`[PRODUCTS] Built ${tokens.size} search tokens`);
}

/**
 * Load products from Google Sheets
 */
export async function loadProducts(force = false) {
  const now = Date.now();
  const stale = (now - LAST_LOAD) > BOT_CONFIG.PRODUCT_TTL_MS;
  
  if (!force && PRODUCTS.length && !stale) {
    console.log('[PRODUCTS] Using cached data');
    return PRODUCTS;
  }

  if (!BOT_CONFIG.SHEET_URL) {
    console.warn('[PRODUCTS] SHEET_URL not configured, using dummy data');
    PRODUCTS = [
      {
        nama: 'Contoh Produk',
        harga: '10000',
        kode: 'DEMO1',
        alias: 'sample, demo',
        kategori: 'Demo',
        deskripsi: 'Produk contoh untuk testing',
        stok: '999',
      },
    ];
    LAST_LOAD = now;
    buildProductTokens();
    return PRODUCTS;
  }

  try {
    console.log('[PRODUCTS] Loading from sheet...');
    
    // Add cache-buster and no-cache headers
    const url = `${BOT_CONFIG.SHEET_URL}${BOT_CONFIG.SHEET_URL.includes('?') ? '&' : '?'}t=${now}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const csv = await response.text();
    const rows = parse(csv, { columns: true, skip_empty_lines: true });

    PRODUCTS = rows
      .map(rowToProduct)
      .filter(p => p.nama && p.kode);

    LAST_LOAD = now;
    buildProductTokens();

    console.log(`[PRODUCTS] Loaded ${PRODUCTS.length} products`);
    return PRODUCTS;
    
  } catch (error) {
    console.error('[PRODUCTS] Load error:', error.message);
    
    // If we have cached data, use it
    if (PRODUCTS.length > 0) {
      console.warn('[PRODUCTS] Using stale cache due to error');
      return PRODUCTS;
    }
    
    throw error;
  }
}

/**
 * Get all categories
 */
export const categories = () => {
  const cats = [...new Set(PRODUCTS.map(p => p.kategori).filter(Boolean))];
  return cats.sort((a, b) => a.localeCompare(b));
};

/**
 * Search products
 */
export const searchProducts = (q) => {
  const s = norm(q);
  return PRODUCTS.filter(p => 
    [p.nama, p.deskripsi, p.kode, p.kategori, p.alias].some(v => norm(v).includes(s))
  );
};

/**
 * Get product by code
 */
export const byKode = (code) => {
  const c = normCode(code);
  return PRODUCTS.find(p => {
    if (normCode(p.kode) === c) return true;
    const aliases = splitAliases(p.alias);
    return aliases.some(a => normCode(a) === c);
  });
};

/**
 * Get all products
 */
export const getAll = () => PRODUCTS;

/**
 * Get search tokens
 */
export const getTokens = () => PRODUCT_TOKENS;

/**
 * Get products by category
 */
export const byCategory = (category) => {
  return PRODUCTS.filter(p => norm(p.kategori) === norm(category));
};

/**
 * Get product statistics
 */
export const getStats = () => {
  return {
    total: PRODUCTS.length,
    categories: categories().length,
    lastUpdate: new Date(LAST_LOAD).toISOString(),
    tokens: PRODUCT_TOKENS.size,
  };
};

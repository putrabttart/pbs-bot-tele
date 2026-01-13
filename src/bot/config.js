// src/bot/config.js
import 'dotenv/config';

const bool = (v, def = false) => {
  const s = (v ?? '').toString().trim().toLowerCase();
  return s ? (s === 'true' || s === '1' || s === 'yes') : def;
};

const num = (v, def = 0) => {
  const n = Number(v);
  return isNaN(n) ? def : n;
};

export const BOT_CONFIG = {
  // Telegram
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_ADMIN_IDS: (process.env.TELEGRAM_ADMIN_IDS || '').split(',').map(id => Number(id.trim())).filter(Boolean),
  
  // Google Sheets
  SHEET_URL: process.env.SHEET_URL || '',
  SHEET_URL_PROMO: process.env.SHEET_URL_PROMO || '',
  SHEET_URL_PAYMENT: process.env.SHEET_URL_PAYMENT || '',
  PRODUCT_TTL_MS: num(process.env.PRODUCT_TTL_MS, 2 * 60 * 1000), // 2 minutes default
  
  // Google Apps Script
  GAS_URL: process.env.GAS_WEBHOOK_URL || '',
  GAS_SECRET: process.env.GAS_SECRET || '',
  
  // Midtrans
  MIDTRANS_SERVER_KEY: process.env.MIDTRANS_SERVER_KEY || '',
  MIDTRANS_IS_PRODUCTION: bool(process.env.MIDTRANS_IS_PRODUCTION, false),
  PAYMENT_TTL_MS: num(process.env.PAYMENT_TTL_MS, 15 * 60 * 1000), // 15 minutes
  
  // Server
  HTTP_PORT: num(process.env.HTTP_PORT, 3000),
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || '',
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || 'supersecret-bot',
  
  // Features
  ENABLE_PROMO: bool(process.env.ENABLE_PROMO, true),
  ENABLE_REFERRAL: bool(process.env.ENABLE_REFERRAL, true),
  ENABLE_ANALYTICS: bool(process.env.ENABLE_ANALYTICS, true),
  ENABLE_FAVORITES: bool(process.env.ENABLE_FAVORITES, true),
  
  // UI
  ITEMS_PER_PAGE: num(process.env.ITEMS_PER_PAGE, 10),
  GRID_COLS: num(process.env.GRID_COLS, 5),
  
  // Rate Limiting
  USER_COOLDOWN_MS: num(process.env.USER_COOLDOWN_MS, 1000),
  SEARCH_MIN_LENGTH: num(process.env.SEARCH_MIN_LENGTH, 2),
  
  // Store Info
  STORE_NAME: process.env.STORE_NAME || 'PBS Digital Store',
  STORE_DESCRIPTION: process.env.STORE_DESCRIPTION || 'Toko Digital Terpercaya',
  SUPPORT_CONTACT: process.env.SUPPORT_CONTACT || '',
  
  // Currency
  CURRENCY: process.env.CURRENCY || 'IDR',
  LOCALE: process.env.LOCALE || 'id-ID',
};

// Validation
export function validateConfig() {
  const errors = [];
  
  if (!BOT_CONFIG.TELEGRAM_BOT_TOKEN) {
    errors.push('TELEGRAM_BOT_TOKEN is required');
  }
  
  if (!BOT_CONFIG.SHEET_URL) {
    errors.push('SHEET_URL is required for products');
  }
  
  if (!BOT_CONFIG.GAS_URL) {
    errors.push('GAS_WEBHOOK_URL is required for stock management');
  }
  
  if (!BOT_CONFIG.MIDTRANS_SERVER_KEY) {
    errors.push('MIDTRANS_SERVER_KEY is required for payments');
  }
  
  if (errors.length > 0) {
    throw new Error('Configuration errors:\n' + errors.join('\n'));
  }
  
  return true;
}

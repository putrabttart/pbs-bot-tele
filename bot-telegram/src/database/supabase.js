// src/database/supabase.js
// Supabase client initialization

import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

let BOT_CONFIG;
try {
  const module = await import('../bot/config.js');
  BOT_CONFIG = module.BOT_CONFIG;
} catch {
  BOT_CONFIG = {
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  };
}

if (!BOT_CONFIG.SUPABASE_URL || !BOT_CONFIG.SUPABASE_ANON_KEY) {
  throw new Error('❌ SUPABASE_URL and SUPABASE_ANON_KEY harus di-set di .env');
}

// Create Supabase client
export const supabase = createClient(
  BOT_CONFIG.SUPABASE_URL,
  BOT_CONFIG.SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false, // Bot tidak perlu session
      autoRefreshToken: false,
    },
    db: {
      schema: 'public',
    },
    global: {
      headers: {
        'x-application-name': 'pbs-telegram-bot',
      },
    },
  }
);

logger.info('✅ Supabase client initialized');

/**
 * Test database connection
 */
export async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('count')
      .limit(1);
    
    if (error) throw error;
    
    logger.info('✅ Supabase connection test successful');
    return true;
  } catch (error) {
    logger.error('❌ Supabase connection test failed:', { error: error.message });
    return false;
  }
}

/**
 * Execute RPC (Remote Procedure Call) function
 */
export async function executeRPC(functionName, params = {}) {
  try {
    const { data, error } = await supabase.rpc(functionName, params);
    
    if (error) {
      logger.error(`RPC ${functionName} error:`, { error: error.message, params });
      throw error;
    }
    
    return data;
  } catch (error) {
    logger.error(`RPC ${functionName} failed:`, { error: error.message });
    throw error;
  }
}

/**
 * Clean expired reservations (maintenance task)
 */
export async function cleanExpiredReservations() {
  try {
    await executeRPC('clean_expired_reservations');
    logger.info('🧹 Expired reservations cleaned');
    return true;
  } catch (error) {
    logger.error('Failed to clean expired reservations:', { error: error.message });
    return false;
  }
}

// ─── Realtime: auto-invalidate product cache on DB changes ───

let _realtimeChannel = null;
let _debounceTimer = null;
const DEBOUNCE_MS = 2000; // Wait 2s after last change before refreshing

/**
 * Setup Supabase Realtime subscription for products & product_items.
 * When any row changes, the bot's in-memory product cache is invalidated
 * so the next user request fetches fresh data.
 */
export function setupRealtimeSubscription() {
  if (_realtimeChannel) {
    logger.info('Realtime subscription already active, skipping');
    return _realtimeChannel;
  }

  _realtimeChannel = supabase
    .channel('bot-product-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'products' },
      (payload) => {
        logger.info(`🔔 Realtime: products table ${payload.eventType}`, {
          kode: payload.new?.kode || payload.old?.kode,
        });
        _debouncedRefresh();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'product_items' },
      (payload) => {
        logger.info(`🔔 Realtime: product_items table ${payload.eventType}`, {
          product_code: payload.new?.product_code || payload.old?.product_code,
        });
        _debouncedRefresh();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'settings' },
      (payload) => {
        logger.info(`🔔 Realtime: settings table ${payload.eventType}`, {
          key: payload.new?.key || payload.old?.key,
        });
        _debouncedRefresh();
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        logger.info('✅ Realtime subscription active — products, product_items, settings');
      } else if (status === 'CHANNEL_ERROR') {
        logger.warn('⚠️ Realtime subscription error, will retry automatically');
      }
    });

  return _realtimeChannel;
}

/**
 * Debounced product cache refresh.
 * Multiple rapid DB changes (e.g. batch upload) only trigger ONE refresh.
 */
function _debouncedRefresh() {
  if (_debounceTimer) clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(async () => {
    try {
      const { loadProducts } = await import('../data/products.js');
      logger.info('🔄 Realtime: refreshing product cache...');
      await loadProducts(true, { resetStability: true });
      logger.info('✅ Realtime: product cache refreshed');
    } catch (err) {
      logger.error('❌ Realtime: failed to refresh product cache', { error: err.message });
    }
  }, DEBOUNCE_MS);
}

/**
 * Cleanup realtime subscription
 */
export function removeRealtimeSubscription() {
  if (_realtimeChannel) {
    supabase.removeChannel(_realtimeChannel);
    _realtimeChannel = null;
    logger.info('Realtime subscription removed');
  }
  if (_debounceTimer) {
    clearTimeout(_debounceTimer);
    _debounceTimer = null;
  }
}

export default supabase;

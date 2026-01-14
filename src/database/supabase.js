// src/database/supabase.js
// Supabase client initialization

import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

let BOT_CONFIG;
try {
  const module = await import('../bot/foramtters.js');
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

export default supabase;

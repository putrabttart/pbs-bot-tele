// src/database/stock.js
// Stock reservation operations

import { supabase, executeRPC } from './supabase.js';
import { logger } from '../utils/logger.js';

/**
 * Reserve product items for an order (product_items based)
 * @param {string} order_id - Order ID (string)
 * @param {string} kode - Product code
 * @param {number} qty - Quantity to reserve
 * @param {string} userRef - User reference
 * @returns {Promise<{ok: boolean, msg: string, available?: number}>}
 */
export async function reserveStock({ order_id, kode, qty, userRef }) {
  try {
    logger.info('Reserving stock:', { order_id, kode, qty, userRef });

    // Use product_items reservation procedure
    const result = await executeRPC('reserve_items_for_order', {
      p_order_id: order_id,
      p_product_code: kode,
      p_quantity: qty
    });
    
    if (!result || typeof result !== 'object') {
      return { ok: false, msg: 'invalid_response' };
    }
    
    logger.info('Stock reserved:', result);
    return result;
  } catch (error) {
    logger.error('Reserve stock error:', { error: error.message, order_id, kode });
    return { ok: false, msg: error.message || 'reserve_exception' };
  }
}

/**
 * Finalize reserved items after payment
 * @param {string} order_id - Order ID
 * @param {number} total - Total payment amount
 * @param {number|string} user_id - Telegram user id (bigint acceptable)
 * @returns {Promise<{ok: boolean, msg: string, items?: Array}>}
 */
export async function finalizeStock({ order_id, total, user_id }) {
  try {
    logger.info('Finalizing items:', { order_id, total, user_id });

    // Use product_items finalization; returns items with item_data
    const result = await executeRPC('finalize_items_for_order', {
      p_order_id: order_id,
      p_user_id: user_id ? Number(user_id) : null,
    });
    
    if (!result || typeof result !== 'object') {
      return { ok: false, msg: 'invalid_response' };
    }
    
    logger.info('Stock finalized:', result);
    
    // Log items detail untuk debugging
    if (result.items && result.items.length > 0) {
      logger.info(`Items finalized: ${result.items.length}`, { items: result.items });
    } else {
      logger.warn('⚠️ Finalize returned empty items array!');
    }
    
    return result;
  } catch (error) {
    logger.error('Finalize stock error:', { error: error.message, order_id });
    return { ok: false, msg: error.message || 'finalize_exception' };
  }
}

/**
 * Release reserved items (cancel/expire)
 * @param {string} order_id - Order ID
 * @param {string} reason - Release reason
 * @returns {Promise<{ok: boolean, msg: string}>}
 */
export async function releaseStock({ order_id, reason }) {
  try {
    logger.info('Releasing stock:', { order_id, reason });

    const result = await executeRPC('release_reserved_items', {
      p_order_id: order_id
    });
    
    if (!result || typeof result !== 'object') {
      return { ok: false, msg: 'invalid_response' };
    }
    
    logger.info('Stock released:', result);
    return result;
  } catch (error) {
    logger.error('Release stock error:', { error: error.message, order_id });
    return { ok: false, msg: error.message || 'release_exception' };
  }
}

/**
 * Get active reservations for an order
 */
export async function getOrderReservations(orderId) {
  try {
    const { data, error } = await supabase
      .from('stock_reservations')
      .select('*, products(*)')
      .eq('order_id', orderId)
      .eq('status', 'reserved');
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    logger.error('Failed to get order reservations:', { orderId, error: error.message });
    return [];
  }
}

/**
 * Clean expired reservations manually
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

/**
 * Get reservation stats
 */
export async function getReservationStats() {
  try {
    const { data, error } = await supabase
      .from('stock_reservations')
      .select('status');
    
    if (error) throw error;
    
    const stats = {
      total: data.length,
      reserved: data.filter(r => r.status === 'reserved').length,
      finalized: data.filter(r => r.status === 'finalized').length,
      released: data.filter(r => r.status === 'released').length,
    };
    
    return stats;
  } catch (error) {
    logger.error('Failed to get reservation stats:', { error: error.message });
    return { total: 0, reserved: 0, finalized: 0, released: 0 };
  }
}

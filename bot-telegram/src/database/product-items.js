// src/database/product-items.js
// Product items management (actual data yang dikirim ke customer)

import { supabase, executeRPC } from './supabase.js';
import { logger } from '../utils/logger.js';

/**
 * Get available items count for product
 */
export async function getAvailableItemsCount(productId) {
  try {
    const count = await executeRPC('get_available_items_count', {
      p_product_id: productId
    });
    
    return count || 0;
  } catch (error) {
    logger.error('Failed to get available items count:', { productId, error: error.message });
    return 0;
  }
}

/**
 * Reserve items for order
 */
export async function reserveItemsForOrder({ order_id, kode, qty }) {
  try {
    logger.info('Reserving items for order:', { order_id, kode, qty });
    
    const result = await executeRPC('reserve_items_for_order', {
      p_order_id: order_id,
      p_product_code: kode,
      p_quantity: qty
    });
    
    if (!result || typeof result !== 'object') {
      return { ok: false, msg: 'invalid_response' };
    }
    
    logger.info('Items reserved:', result);
    return result;
  } catch (error) {
    logger.error('Reserve items error:', { error: error.message, order_id, kode });
    return { ok: false, msg: error.message || 'reserve_items_exception' };
  }
}

/**
 * Finalize items for order (mark as sold and get data)
 */
export async function finalizeItemsForOrder({ order_id, user_id }) {
  try {
    logger.info('Finalizing items for order:', { order_id, user_id });
    
    const result = await executeRPC('finalize_items_for_order', {
      p_order_id: order_id,
      p_user_id: user_id
    });
    
    if (!result || typeof result !== 'object') {
      return { ok: false, msg: 'invalid_response' };
    }
    
    logger.info('Items finalized:', { order_id, count: result.count });
    
    // Parse items data
    if (result.items && result.items.length > 0) {
      logger.info(`Items data ready to send: ${result.items.length} items`);
    }
    
    return result;
  } catch (error) {
    logger.error('Finalize items error:', { error: error.message, order_id });
    return { ok: false, msg: error.message || 'finalize_items_exception' };
  }
}

/**
 * Release reserved items (cancel order)
 */
export async function releaseReservedItems({ order_id }) {
  try {
    logger.info('Releasing reserved items:', { order_id });
    
    const result = await executeRPC('release_reserved_items', {
      p_order_id: order_id
    });
    
    if (!result || typeof result !== 'object') {
      return { ok: false, msg: 'invalid_response' };
    }
    
    logger.info('Items released:', result);
    return result;
  } catch (error) {
    logger.error('Release items error:', { error: error.message, order_id });
    return { ok: false, msg: error.message || 'release_items_exception' };
  }
}

/**
 * Add new item to product
 */
export async function addProductItem({ productCode, itemData, notes = '', batch = '' }) {
  try {
    // Get product ID
    const { data: product } = await supabase
      .from('products')
      .select('id')
      .eq('kode', productCode)
      .single();
    
    if (!product) {
      throw new Error('Product not found');
    }
    
    const { data, error } = await supabase
      .from('product_items')
      .insert({
        product_id: product.id,
        product_code: productCode,
        item_data: itemData,
        notes,
        batch,
        status: 'available'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    logger.info('Product item added:', { productCode, itemId: data.id });
    return data;
  } catch (error) {
    logger.error('Failed to add product item:', { productCode, error: error.message });
    throw error;
  }
}

/**
 * Bulk add items to product
 */
export async function bulkAddProductItems({ productCode, items }) {
  try {
    // Get product ID
    const { data: product } = await supabase
      .from('products')
      .select('id')
      .eq('kode', productCode)
      .single();
    
    if (!product) {
      throw new Error('Product not found');
    }
    
    // Prepare items data
    const itemsData = items.map(item => ({
      product_id: product.id,
      product_code: productCode,
      item_data: typeof item === 'string' ? item : item.data,
      notes: typeof item === 'object' ? item.notes || '' : '',
      batch: typeof item === 'object' ? item.batch || '' : '',
      status: 'available'
    }));
    
    const { data, error } = await supabase
      .from('product_items')
      .insert(itemsData)
      .select();
    
    if (error) throw error;
    
    logger.info(`Bulk added ${items.length} items to product ${productCode}`);
    return data;
  } catch (error) {
    logger.error('Failed to bulk add items:', { productCode, error: error.message });
    throw error;
  }
}

/**
 * Get product items (for admin view)
 */
export async function getProductItems(productCode, status = null) {
  try {
    let query = supabase
      .from('product_items')
      .select('*')
      .eq('product_code', productCode)
      .order('created_at', { ascending: false });
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    logger.error('Failed to get product items:', { productCode, error: error.message });
    throw error;
  }
}

/**
 * Get inventory summary for all products
 */
export async function getInventorySummary() {
  try {
    const { data, error } = await supabase
      .from('product_inventory_summary')
      .select('*')
      .order('kode', { ascending: true });
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    logger.error('Failed to get inventory summary:', { error: error.message });
    throw error;
  }
}

/**
 * Mark item as invalid/expired
 */
export async function markItemAsInvalid(itemId, reason = '') {
  try {
    const { data, error } = await supabase
      .from('product_items')
      .update({
        status: 'invalid',
        notes: reason
      })
      .eq('id', itemId)
      .select()
      .single();
    
    if (error) throw error;
    
    logger.info('Item marked as invalid:', { itemId, reason });
    return data;
  } catch (error) {
    logger.error('Failed to mark item as invalid:', { itemId, error: error.message });
    throw error;
  }
}

/**
 * Delete item (permanent)
 */
export async function deleteProductItem(itemId) {
  try {
    const { error } = await supabase
      .from('product_items')
      .delete()
      .eq('id', itemId);
    
    if (error) throw error;
    
    logger.info('Product item deleted:', { itemId });
    return true;
  } catch (error) {
    logger.error('Failed to delete item:', { itemId, error: error.message });
    throw error;
  }
}

/**
 * Clean expired item reservations
 */
export async function cleanExpiredItemReservations() {
  try {
    const count = await executeRPC('clean_expired_item_reservations');
    
    if (count > 0) {
      logger.info(`Cleaned ${count} expired item reservations`);
    }
    
    return count;
  } catch (error) {
    logger.error('Failed to clean expired item reservations:', { error: error.message });
    return 0;
  }
}

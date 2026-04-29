// src/database/orders.js
// Order management operations

import { supabase } from './supabase.js';
import { logger } from '../utils/logger.js';

/**
 * Create new order
 */
export async function createOrder(orderData) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .insert({
        order_id: orderData.order_id,
        user_id: orderData.user_id,
        total_amount: orderData.total_amount,
        payment_url: orderData.payment_url,
        midtrans_token: orderData.midtrans_token,
        user_ref: orderData.user_ref,
        status: 'pending',
        expired_at: orderData.expired_at,
      })
      .select()
      .single();
    
    if (error) throw error;
    
    logger.info('Order created:', { order_id: orderData.order_id });
    return data;
  } catch (error) {
    logger.error('Failed to create order:', { error: error.message });
    throw error;
  }
}

/**
 * Create order items
 */
export async function createOrderItems(orderId, items) {
  try {
    // Fetch order UUID (id) because order_items.order_id references orders.id
    const { data: orderRow, error: orderErr } = await supabase
      .from('orders')
      .select('id')
      .eq('order_id', orderId)
      .single();
    if (orderErr || !orderRow?.id) throw orderErr || new Error('Order not found for orderId');

    // Optionally resolve product_id by code
    let productMap = new Map();
    const codes = Array.from(new Set(items.map(i => i.kode).filter(Boolean)));
    if (codes.length > 0) {
      const { data: products } = await supabase
        .from('products')
        .select('id,kode');
      if (products) {
        productMap = new Map(products.map(p => [p.kode, p.id]));
      }
    }

    const orderItems = items.map(item => ({
      order_id: orderRow.id,
      product_code: item.kode,
      product_name: item.nama,
      quantity: item.qty,
      price: item.harga,
      product_id: productMap.get(item.kode) || null,
      item_data: item.item_data || null,
    }));
    
    const { data, error } = await supabase
      .from('order_items')
      .insert(orderItems)
      .select();
    
    if (error) throw error;
    
    logger.info(`Order items created: ${items.length} items`);
    return data;
  } catch (error) {
    logger.error('Failed to create order items:', { error: error.message });
    throw error;
  }
}

/**
 * Get order by order_id
 */
export async function getOrder(orderId) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('order_id', orderId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    
    return data;
  } catch (error) {
    logger.error('Failed to get order:', { orderId, error: error.message });
    throw error;
  }
}

/**
 * Update order status
 */
export async function updateOrderStatus(orderId, status, additionalData = {}) {
  try {
    const updateData = {
      status,
      ...additionalData,
    };
    
    // Add timestamp fields based on status
    if (status === 'paid') {
      updateData.paid_at = new Date().toISOString();
    } else if (status === 'cancelled') {
      updateData.cancelled_at = new Date().toISOString();
    }
    
    const { data, error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('order_id', orderId)
      .select()
      .single();
    
    if (error) throw error;
    
    logger.info('Order status updated:', { orderId, status });
    return data;
  } catch (error) {
    logger.error('Failed to update order status:', { orderId, status, error: error.message });
    throw error;
  }
}

/**
 * Mark order items as sent
 */
export async function markItemsAsSent(orderId, itemData) {
  try {
    // order_items.order_id is UUID -> resolve orders.id first
    const { data: orderRow, error: orderErr } = await supabase
      .from('orders')
      .select('id')
      .eq('order_id', orderId)
      .single();
    if (orderErr || !orderRow?.id) throw orderErr || new Error('Order not found for orderId');

    const { data, error } = await supabase
      .from('order_items')
      .update({
        sent: true,
        sent_at: new Date().toISOString(),
        item_data: itemData, // Serialized item details
      })
      .eq('order_id', orderRow.id)
      .select();
    
    if (error) throw error;
    
    logger.info('Order items marked as sent:', { orderId });
    return data;
  } catch (error) {
    logger.error('Failed to mark items as sent:', { orderId, error: error.message });
    throw error;
  }
}

/**
 * Get user orders
 */
export async function getUserOrders(userId, limit = 10) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    logger.error('Failed to get user orders:', { userId, error: error.message });
    throw error;
  }
}

/**
 * Get pending orders
 */
export async function getPendingOrders() {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    logger.error('Failed to get pending orders:', { error: error.message });
    throw error;
  }
}

/**
 * Get expired orders that need cleanup
 */
export async function getExpiredOrders() {
  try {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('status', 'pending')
      .lt('expired_at', now);
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    logger.error('Failed to get expired orders:', { error: error.message });
    throw error;
  }
}

/**
 * Get order statistics
 */
export async function getOrderStats() {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('status, total_amount');
    
    if (error) throw error;
    
    const stats = {
      total: data.length,
      pending: data.filter(o => o.status === 'pending').length,
      paid: data.filter(o => o.status === 'paid').length,
      cancelled: data.filter(o => o.status === 'cancelled').length,
      expired: data.filter(o => o.status === 'expired').length,
      totalRevenue: data
        .filter(o => o.status === 'paid')
        .reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0),
    };
    
    return stats;
  } catch (error) {
    logger.error('Failed to get order stats:', { error: error.message });
    return {
      total: 0,
      pending: 0,
      paid: 0,
      cancelled: 0,
      expired: 0,
      totalRevenue: 0,
    };
  }
}

/**
 * Delete old orders (cleanup)
 */
export async function deleteOldOrders(daysOld = 90) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const { error } = await supabase
      .from('orders')
      .delete()
      .in('status', ['expired', 'cancelled'])
      .lt('created_at', cutoffDate.toISOString());
    
    if (error) throw error;
    
    logger.info(`Old orders deleted (older than ${daysOld} days)`);
    return true;
  } catch (error) {
    logger.error('Failed to delete old orders:', { error: error.message });
    return false;
  }
}

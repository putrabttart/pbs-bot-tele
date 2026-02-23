// src/database/analytics.js
// Analytics and reporting operations

import { supabase } from './supabase.js';
import { logger } from '../utils/logger.js';

/**
 * Track product view
 */
export async function trackProductView(productId) {
  try {
    // Upsert product view count
    const { error } = await supabase.rpc('increment_product_views', {
      p_product_id: productId
    });
    
    // If RPC doesn't exist, use manual upsert
    if (error?.code === '42883') {
      const { data: existing } = await supabase
        .from('analytics_product_views')
        .select('view_count')
        .eq('product_id', productId)
        .single();
      
      if (existing) {
        await supabase
          .from('analytics_product_views')
          .update({
            view_count: existing.view_count + 1,
            last_viewed: new Date().toISOString(),
          })
          .eq('product_id', productId);
      } else {
        await supabase
          .from('analytics_product_views')
          .insert({
            product_id: productId,
            view_count: 1,
            last_viewed: new Date().toISOString(),
          });
      }
    } else if (error) {
      throw error;
    }
    
    return true;
  } catch (error) {
    logger.error('Failed to track product view:', { productId, error: error.message });
    return false;
  }
}

/**
 * Track search query
 */
export async function trackSearch(query, userId = null) {
  try {
    // Check if query exists
    const { data: existing } = await supabase
      .from('analytics_searches')
      .select('id, search_count')
      .eq('query', query)
      .maybeSingle();
    
    if (existing) {
      // Update existing
      await supabase
        .from('analytics_searches')
        .update({
          search_count: existing.search_count + 1,
          last_searched: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      // Insert new
      await supabase
        .from('analytics_searches')
        .insert({
          query,
          user_id: userId,
          search_count: 1,
          last_searched: new Date().toISOString(),
        });
    }
    
    return true;
  } catch (error) {
    logger.error('Failed to track search:', { query, error: error.message });
    return false;
  }
}

/**
 * Update daily stats
 */
export async function updateDailyStats(date = new Date()) {
  try {
    const dateStr = date.toISOString().split('T')[0];
    
    // Get orders for this date
    const { data: orders } = await supabase
      .from('orders')
      .select('status, total_amount, user_id')
      .gte('created_at', dateStr + 'T00:00:00Z')
      .lt('created_at', dateStr + 'T23:59:59Z');
    
    const paidOrders = orders?.filter(o => o.status === 'paid') || [];
    const totalRevenue = paidOrders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
    const uniqueUsers = new Set(orders?.map(o => o.user_id) || []).size;
    
    // Upsert daily stats
    await supabase
      .from('analytics_daily_stats')
      .upsert({
        date: dateStr,
        total_orders: paidOrders.length,
        total_revenue: totalRevenue,
        unique_users: uniqueUsers,
      }, { onConflict: 'date' });
    
    logger.info('Daily stats updated:', { date: dateStr, orders: paidOrders.length });
    return true;
  } catch (error) {
    logger.error('Failed to update daily stats:', { error: error.message });
    return false;
  }
}

/**
 * Get top viewed products
 */
export async function getTopViewedProducts(limit = 10) {
  try {
    const { data, error } = await supabase
      .from('analytics_product_views')
      .select('product_id, view_count, last_viewed, products(*)')
      .order('view_count', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    logger.error('Failed to get top viewed products:', { error: error.message });
    throw error;
  }
}

/**
 * Get top search queries
 */
export async function getTopSearchQueries(limit = 10) {
  try {
    const { data, error } = await supabase
      .from('analytics_searches')
      .select('query, search_count, last_searched')
      .order('search_count', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    logger.error('Failed to get top search queries:', { error: error.message });
    throw error;
  }
}

/**
 * Get daily stats for date range
 */
export async function getDailyStats(startDate, endDate) {
  try {
    const { data, error } = await supabase
      .from('analytics_daily_stats')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    logger.error('Failed to get daily stats:', { error: error.message });
    throw error;
  }
}

/**
 * Get analytics summary
 */
export async function getAnalyticsSummary() {
  try {
    // Get order stats
    const { data: orders } = await supabase
      .from('orders')
      .select('status, total_amount');
    
    // Get product stats
    const { count: productCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('aktif', true);
    
    // Get user stats
    const { count: userCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    // Get top products
    const { data: topProducts } = await supabase
      .from('analytics_product_views')
      .select('view_count')
      .order('view_count', { ascending: false })
      .limit(5);
    
    const paidOrders = orders?.filter(o => o.status === 'paid') || [];
    const totalRevenue = paidOrders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
    
    return {
      totalOrders: orders?.length || 0,
      paidOrders: paidOrders.length,
      totalRevenue,
      totalProducts: productCount || 0,
      totalUsers: userCount || 0,
      avgOrderValue: paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0,
    };
  } catch (error) {
    logger.error('Failed to get analytics summary:', { error: error.message });
    return {
      totalOrders: 0,
      paidOrders: 0,
      totalRevenue: 0,
      totalProducts: 0,
      totalUsers: 0,
      avgOrderValue: 0,
    };
  }
}

/**
 * Get revenue by category
 */
export async function getRevenueByCategory() {
  try {
    const { data, error } = await supabase
      .from('order_items')
      .select('product_name, price, quantity, orders!inner(status), products(kategori)')
      .eq('orders.status', 'paid');
    
    if (error) throw error;
    
    // Group by category
    const categoryRevenue = {};
    data?.forEach(item => {
      const kategori = item.products?.kategori || 'Unknown';
      const revenue = parseFloat(item.price || 0) * item.quantity;
      categoryRevenue[kategori] = (categoryRevenue[kategori] || 0) + revenue;
    });
    
    return Object.entries(categoryRevenue)
      .map(([kategori, revenue]) => ({ kategori, revenue }))
      .sort((a, b) => b.revenue - a.revenue);
  } catch (error) {
    logger.error('Failed to get revenue by category:', { error: error.message });
    return [];
  }
}

// src/database/users.js
// User management operations

import { supabase } from './supabase.js';
import { logger } from '../utils/logger.js';

/**
 * Create or update user
 */
export async function upsertUser(userData) {
  try {
    const { data, error } = await supabase
      .from('users')
      .upsert({
        user_id: userData.user_id,
        username: userData.username || null,
        first_name: userData.first_name || null,
        last_name: userData.last_name || null,
        language: userData.language || 'id',
        last_activity: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      .select()
      .single();
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    logger.error('Failed to upsert user:', { error: error.message });
    throw error;
  }
}

/**
 * Get user by ID
 */
export async function getUser(userId) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    
    return data;
  } catch (error) {
    logger.error('Failed to get user:', { userId, error: error.message });
    throw error;
  }
}

/**
 * Update user last activity
 */
export async function updateUserActivity(userId) {
  try {
    const { error } = await supabase
      .from('users')
      .update({ last_activity: new Date().toISOString() })
      .eq('user_id', userId);
    
    if (error) throw error;
    
    return true;
  } catch (error) {
    logger.error('Failed to update user activity:', { userId, error: error.message });
    return false;
  }
}

/**
 * Get user favorites
 */
export async function getUserFavorites(userId) {
  try {
    const { data, error } = await supabase
      .from('favorites')
      .select('product_id, products(*)')
      .eq('user_id', userId);
    
    if (error) throw error;
    
    return data?.map(f => f.products) || [];
  } catch (error) {
    logger.error('Failed to get user favorites:', { userId, error: error.message });
    throw error;
  }
}

/**
 * Add product to favorites
 */
export async function addFavorite(userId, productId) {
  try {
    const { data, error } = await supabase
      .from('favorites')
      .insert({
        user_id: userId,
        product_id: productId,
      })
      .select()
      .single();
    
    if (error) {
      // Ignore duplicate key error
      if (error.code === '23505') {
        return { alreadyExists: true };
      }
      throw error;
    }
    
    logger.info('Favorite added:', { userId, productId });
    return data;
  } catch (error) {
    logger.error('Failed to add favorite:', { userId, productId, error: error.message });
    throw error;
  }
}

/**
 * Remove product from favorites
 */
export async function removeFavorite(userId, productId) {
  try {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('product_id', productId);
    
    if (error) throw error;
    
    logger.info('Favorite removed:', { userId, productId });
    return true;
  } catch (error) {
    logger.error('Failed to remove favorite:', { userId, productId, error: error.message });
    throw error;
  }
}

/**
 * Check if product is favorited by user
 */
export async function isFavorite(userId, productId) {
  try {
    const { data, error } = await supabase
      .from('favorites')
      .select('user_id')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return false;
      throw error;
    }
    
    return !!data;
  } catch (error) {
    logger.error('Failed to check favorite:', { userId, productId, error: error.message });
    return false;
  }
}

/**
 * Get user statistics
 */
export async function getUserStats(userId) {
  try {
    // Get order count and total spent
    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .select('status, total_amount')
      .eq('user_id', userId);
    
    if (orderError) throw orderError;
    
    // Get favorites count
    const { count: favCount, error: favError } = await supabase
      .from('favorites')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    if (favError) throw favError;
    
    const stats = {
      totalOrders: orders.length,
      paidOrders: orders.filter(o => o.status === 'paid').length,
      totalSpent: orders
        .filter(o => o.status === 'paid')
        .reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0),
      favoritesCount: favCount || 0,
    };
    
    return stats;
  } catch (error) {
    logger.error('Failed to get user stats:', { userId, error: error.message });
    return {
      totalOrders: 0,
      paidOrders: 0,
      totalSpent: 0,
      favoritesCount: 0,
    };
  }
}

/**
 * Get all users (admin)
 */
export async function getAllUsers(limit = 100) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('last_activity', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    logger.error('Failed to get all users:', { error: error.message });
    throw error;
  }
}

/**
 * Get active users (activity in last N days)
 */
export async function getActiveUsers(days = 30) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .gte('last_activity', cutoffDate.toISOString())
      .order('last_activity', { ascending: false });
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    logger.error('Failed to get active users:', { error: error.message });
    throw error;
  }
}

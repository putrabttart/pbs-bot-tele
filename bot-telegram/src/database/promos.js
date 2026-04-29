// src/database/promos.js
// Promo/discount code operations

import { supabase } from './supabase.js';
import { logger } from '../utils/logger.js';

/**
 * Get promo by code
 */
export async function getPromoByCode(code) {
  try {
    const { data, error } = await supabase
      .from('promos')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('aktif', true)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    
    return data;
  } catch (error) {
    logger.error('Failed to get promo:', { code, error: error.message });
    throw error;
  }
}

/**
 * Validate promo code
 */
export async function validatePromo(code, orderAmount) {
  try {
    const promo = await getPromoByCode(code);
    
    if (!promo) {
      return { valid: false, reason: 'Kode promo tidak ditemukan' };
    }
    
    const now = new Date();
    
    // Check valid dates
    if (promo.valid_from && new Date(promo.valid_from) > now) {
      return { valid: false, reason: 'Kode promo belum aktif' };
    }
    
    if (promo.valid_until && new Date(promo.valid_until) < now) {
      return { valid: false, reason: 'Kode promo sudah expired' };
    }
    
    // Check usage limit
    if (promo.usage_limit && promo.usage_count >= promo.usage_limit) {
      return { valid: false, reason: 'Kode promo sudah mencapai limit penggunaan' };
    }
    
    // Check minimum purchase
    if (promo.min_purchase && orderAmount < promo.min_purchase) {
      return {
        valid: false,
        reason: `Minimum pembelian Rp ${promo.min_purchase.toLocaleString('id-ID')}`,
      };
    }
    
    // Calculate discount
    let discountAmount = 0;
    
    if (promo.discount_percent) {
      discountAmount = orderAmount * (promo.discount_percent / 100);
      
      // Apply max discount if set
      if (promo.max_discount && discountAmount > promo.max_discount) {
        discountAmount = promo.max_discount;
      }
    } else if (promo.discount_amount) {
      discountAmount = promo.discount_amount;
    }
    
    return {
      valid: true,
      promo,
      discountAmount: Math.floor(discountAmount),
      finalAmount: Math.max(0, orderAmount - discountAmount),
    };
  } catch (error) {
    logger.error('Failed to validate promo:', { code, error: error.message });
    return { valid: false, reason: 'Terjadi kesalahan saat validasi promo' };
  }
}

/**
 * Increment promo usage count
 */
export async function incrementPromoUsage(code) {
  try {
    const { error } = await supabase.rpc('increment_promo_usage', {
      p_code: code.toUpperCase()
    });
    
    // If RPC doesn't exist, use manual update
    if (error?.code === '42883') {
      const { error: updateError } = await supabase
        .from('promos')
        .update({
          usage_count: supabase.raw('usage_count + 1'),
        })
        .eq('code', code.toUpperCase());
      
      if (updateError) throw updateError;
    } else if (error) {
      throw error;
    }
    
    logger.info('Promo usage incremented:', { code });
    return true;
  } catch (error) {
    logger.error('Failed to increment promo usage:', { code, error: error.message });
    return false;
  }
}

/**
 * Get all active promos
 */
export async function getAllPromos() {
  try {
    const { data, error } = await supabase
      .from('promos')
      .select('*')
      .eq('aktif', true)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    logger.error('Failed to get all promos:', { error: error.message });
    throw error;
  }
}

/**
 * Create promo (admin only)
 */
export async function createPromo(promoData) {
  try {
    const { data, error } = await supabase
      .from('promos')
      .insert({
        code: promoData.code.toUpperCase(),
        discount_percent: promoData.discount_percent || null,
        discount_amount: promoData.discount_amount || null,
        min_purchase: promoData.min_purchase || 0,
        max_discount: promoData.max_discount || null,
        valid_from: promoData.valid_from || new Date().toISOString(),
        valid_until: promoData.valid_until || null,
        usage_limit: promoData.usage_limit || null,
      })
      .select()
      .single();
    
    if (error) throw error;
    
    logger.info('Promo created:', { code: promoData.code });
    return data;
  } catch (error) {
    logger.error('Failed to create promo:', { error: error.message });
    throw error;
  }
}

/**
 * Update promo (admin only)
 */
export async function updatePromo(code, updates) {
  try {
    const { data, error } = await supabase
      .from('promos')
      .update(updates)
      .eq('code', code.toUpperCase())
      .select()
      .single();
    
    if (error) throw error;
    
    logger.info('Promo updated:', { code });
    return data;
  } catch (error) {
    logger.error('Failed to update promo:', { code, error: error.message });
    throw error;
  }
}

/**
 * Deactivate promo (admin only)
 */
export async function deactivatePromo(code) {
  try {
    const { data, error } = await supabase
      .from('promos')
      .update({ aktif: false })
      .eq('code', code.toUpperCase())
      .select()
      .single();
    
    if (error) throw error;
    
    logger.info('Promo deactivated:', { code });
    return data;
  } catch (error) {
    logger.error('Failed to deactivate promo:', { code, error: error.message });
    throw error;
  }
}

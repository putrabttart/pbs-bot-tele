// src/database/products.js
// Product database operations

import { supabase } from './supabase.js';
import { logger } from '../utils/logger.js';

/**
 * Get all active products with available item counts
 */
export async function getAllProducts() {
  try {
    const { data: products, error: prodError } = await supabase
      .from('products')
      .select('*')
      .eq('aktif', true)
      .order('kategori', { ascending: true })
      .order('nama', { ascending: true });
    
    if (prodError) throw prodError;
    
    // Fetch available items count for each product
    if (products && products.length > 0) {
      const productCodes = products.map(p => p.kode);
      
      // Query to count items by product_code and status
      const { data: itemCounts, error: itemError } = await supabase
        .from('product_items')
        .select('product_code, status')
        .in('product_code', productCodes);
      
      if (!itemError && itemCounts) {
        // Build map of code -> available count
        const countsMap = new Map();
        
        itemCounts.forEach((item) => {
          const key = item.product_code;
          if (!countsMap.has(key)) {
            countsMap.set(key, { available: 0, total: 0 });
          }
          const counts = countsMap.get(key);
          counts.total++;
          if (item.status === 'available') {
            counts.available++;
          }
        });
        
        // Add available count to products
        return products.map(p => {
          const counts = countsMap.get(p.kode) || { available: 0, total: 0 };
          return {
            ...p,
            available_items: counts.available,
            total_items: counts.total,
          };
        });
      }
    }
    
    return products || [];
  } catch (error) {
    logger.error('Failed to get products:', { error: error.message });
    throw error;
  }
}

/**
 * Get product by code
 */
export async function getProductByCode(kode) {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('kode', kode)
      .eq('aktif', true)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    
    return data;
  } catch (error) {
    logger.error('Failed to get product by code:', { kode, error: error.message });
    throw error;
  }
}

/**
 * Get product by ID
 */
export async function getProductById(id) {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    
    return data;
  } catch (error) {
    logger.error('Failed to get product by ID:', { id, error: error.message });
    throw error;
  }
}

/**
 * Search products by name/description/category
 */
export async function searchProducts(query) {
  try {
    const searchTerm = `%${query.toLowerCase()}%`;
    
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('aktif', true)
      .or(`nama.ilike.${searchTerm},deskripsi.ilike.${searchTerm},kategori.ilike.${searchTerm},kode.ilike.${searchTerm}`)
      .order('nama', { ascending: true })
      .limit(50);
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    logger.error('Failed to search products:', { query, error: error.message });
    throw error;
  }
}

/**
 * Get products by category
 */
export async function getProductsByCategory(kategori) {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('kategori', kategori)
      .eq('aktif', true)
      .order('nama', { ascending: true });
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    logger.error('Failed to get products by category:', { kategori, error: error.message });
    throw error;
  }
}

/**
 * Get all categories
 */
export async function getAllCategories() {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('kategori')
      .eq('aktif', true)
      .not('kategori', 'is', null);
    
    if (error) throw error;
    
    // Get unique categories
    const categories = [...new Set(data.map(p => p.kategori))].sort();
    return categories;
  } catch (error) {
    logger.error('Failed to get categories:', { error: error.message });
    throw error;
  }
}

/**
 * Get available stock for product (considering reservations)
 */
export async function getAvailableStock(productId) {
  try {
    const { data, error } = await supabase.rpc('get_available_stock', {
      p_product_id: productId
    });
    
    if (error) throw error;
    
    return data || 0;
  } catch (error) {
    logger.error('Failed to get available stock:', { productId, error: error.message });
    throw error;
  }
}

/**
 * Get low stock products
 */
export async function getLowStockProducts(threshold = 5) {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('aktif', true)
      .lte('stok', threshold)
      .order('stok', { ascending: true });
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    logger.error('Failed to get low stock products:', { error: error.message });
    throw error;
  }
}

/**
 * Update product stock (admin only)
 */
export async function updateProductStock(kode, newStock) {
  try {
    const { data, error } = await supabase
      .from('products')
      .update({ stok: newStock, updated_at: new Date().toISOString() })
      .eq('kode', kode)
      .select()
      .single();
    
    if (error) throw error;
    
    logger.info('Product stock updated:', { kode, newStock });
    return data;
  } catch (error) {
    logger.error('Failed to update product stock:', { kode, error: error.message });
    throw error;
  }
}

/**
 * Create or update product (admin only)
 */
export async function upsertProduct(productData) {
  try {
    const { data, error } = await supabase
      .from('products')
      .upsert(productData, { onConflict: 'kode' })
      .select()
      .single();
    
    if (error) throw error;
    
    logger.info('Product upserted:', { kode: productData.kode });
    return data;
  } catch (error) {
    logger.error('Failed to upsert product:', { error: error.message });
    throw error;
  }
}

/**
 * Bulk upsert products (for CSV import)
 */
export async function bulkUpsertProducts(products) {
  try {
    const { data, error } = await supabase
      .from('products')
      .upsert(products, { onConflict: 'kode' })
      .select();
    
    if (error) throw error;
    
    logger.info(`Bulk upserted ${products.length} products`);
    return data || [];
  } catch (error) {
    logger.error('Failed to bulk upsert products:', { error: error.message });
    throw error;
  }
}

/**
 * Delete product (soft delete by setting aktif = false)
 */
export async function deleteProduct(kode) {
  try {
    const { data, error } = await supabase
      .from('products')
      .update({ aktif: false, updated_at: new Date().toISOString() })
      .eq('kode', kode)
      .select()
      .single();
    
    if (error) throw error;
    
    logger.info('Product deleted (soft):', { kode });
    return data;
  } catch (error) {
    logger.error('Failed to delete product:', { kode, error: error.message });
    throw error;
  }
}

// scripts/migrate-products-to-supabase.js
// Migration script: Import products from Google Sheets CSV to Supabase

import { parse } from 'csv-parse/sync';
import { bulkUpsertProducts } from '../src/database/products.js';
import { logger } from '../src/utils/logger.js';

const SHEET_URL = process.env.SHEET_URL || '';

if (!SHEET_URL) {
  console.error('❌ SHEET_URL tidak diset di .env');
  process.exit(1);
}

/**
 * Convert CSV row to product object
 */
function rowToProduct(r) {
  const o = {};
  for (const k of Object.keys(r)) {
    o[k.trim().toLowerCase()] = (r[k] ?? '').toString().trim();
  }
  
  return {
    kode: o.kode || '',
    nama: o.nama || '',
    kategori: o.kategori || '',
    harga: parseFloat(o.harga) || 0,
    harga_lama: o.harga_lama ? parseFloat(o.harga_lama) : null,
    stok: parseInt(o.stok) || 0,
    ikon: o.ikon || '',
    deskripsi: o.deskripsi || '',
    wa: o.wa || '',
    alias: o.alias ? o.alias.split(/[\n,;|/]+/g).map(s => s.trim()).filter(Boolean) : [],
    aktif: true,
  };
}

/**
 * Main migration function
 */
async function migrate() {
  try {
    console.log('\n' + '═'.repeat(60));
    console.log('  📦  MIGRASI PRODUCTS: Google Sheets → Supabase');
    console.log('═'.repeat(60) + '\n');
    
    console.log('📥 Fetching products from Google Sheets...');
    console.log(`   URL: ${SHEET_URL}\n`);
    
    const response = await fetch(SHEET_URL);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const csv = await response.text();
    const rows = parse(csv, { columns: true, skip_empty_lines: true });
    
    console.log(`✅ Fetched ${rows.length} rows from CSV\n`);
    
    // Convert to products
    const products = rows
      .map(rowToProduct)
      .filter(p => p.nama && p.kode); // Only valid products
    
    console.log(`📝 Valid products to import: ${products.length}\n`);
    
    if (products.length === 0) {
      console.log('⚠️  No products to import');
      return;
    }
    
    // Show sample
    console.log('📄 Sample products:');
    products.slice(0, 3).forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.kode} - ${p.nama} (${p.kategori}) - Rp ${p.harga}`);
    });
    console.log('   ...\n');
    
    console.log('💾 Importing to Supabase...');
    
    // Batch import (chunk size: 100)
    const chunkSize = 100;
    let imported = 0;
    
    for (let i = 0; i < products.length; i += chunkSize) {
      const chunk = products.slice(i, i + chunkSize);
      await bulkUpsertProducts(chunk);
      imported += chunk.length;
      console.log(`   Imported ${imported}/${products.length} products...`);
    }
    
    console.log('\n' + '═'.repeat(60));
    console.log(`  ✅  MIGRATION COMPLETED!`);
    console.log(`  📦  ${imported} products imported to Supabase`);
    console.log('═'.repeat(60) + '\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

// Run migration
migrate();

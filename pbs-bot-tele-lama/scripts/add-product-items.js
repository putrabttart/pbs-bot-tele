// scripts/add-product-items.js
// Script untuk menambahkan items ke produk

import { bulkAddProductItems, getProductItems } from '../src/database/product-items.js';
import { logger } from '../src/utils/logger.js';

/**
 * Contoh: Add items untuk produk Canva
 */
async function addCanvaItems() {
  try {
    console.log('\n' + '═'.repeat(60));
    console.log('  📦  ADD PRODUCT ITEMS - Canva Pro');
    console.log('═'.repeat(60) + '\n');
    
    const productCode = 'canvahead';
    
    // Data items: bisa berupa akun, kode voucher, license key, dll
    const items = [
      { data: 'email1@example.com:password123', notes: 'Expired: 2026-12-31', batch: 'JAN2026' },
      { data: 'email2@example.com:password456', notes: 'Expired: 2026-12-31', batch: 'JAN2026' },
      { data: 'email3@example.com:password789', notes: 'Expired: 2026-12-31', batch: 'JAN2026' },
      { data: 'email4@example.com:passwordabc', notes: 'Expired: 2026-12-31', batch: 'JAN2026' },
      { data: 'email5@example.com:passworddef', notes: 'Expired: 2026-12-31', batch: 'JAN2026' },
    ];
    
    console.log(`📥 Adding ${items.length} items to product: ${productCode}\n`);
    
    const result = await bulkAddProductItems({
      productCode,
      items
    });
    
    console.log(`✅ Added ${result.length} items\n`);
    
    // Show current items
    console.log('📋 Current items for', productCode);
    const currentItems = await getProductItems(productCode);
    
    console.log(`   Total items: ${currentItems.length}`);
    console.log(`   Available: ${currentItems.filter(i => i.status === 'available').length}`);
    console.log(`   Reserved: ${currentItems.filter(i => i.status === 'reserved').length}`);
    console.log(`   Sold: ${currentItems.filter(i => i.status === 'sold').length}\n`);
    
    console.log('═'.repeat(60));
    console.log('  ✅  ITEMS ADDED SUCCESSFULLY!');
    console.log('═'.repeat(60) + '\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Failed to add items:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

/**
 * Template untuk produk lain
 */
async function addItemsForProduct(productCode, items) {
  try {
    console.log(`\n📦 Adding items to: ${productCode}`);
    
    const result = await bulkAddProductItems({
      productCode,
      items: items.map(data => ({ data }))
    });
    
    console.log(`✅ Added ${result.length} items\n`);
    
  } catch (error) {
    console.error(`❌ Failed for ${productCode}:`, error.message);
  }
}

// ============================================
// MAIN - Uncomment produk yang ingin ditambahkan
// ============================================

(async () => {
  // Contoh 1: Canva Pro
  await addCanvaItems();
  
  // Contoh 2: Netflix (uncomment untuk add)
  // await addItemsForProduct('vidtv1th', [
  //   'netflix1@email.com:pass123',
  //   'netflix2@email.com:pass456',
  // ]);
  
  // Contoh 3: Spotify (uncomment untuk add)
  // await addItemsForProduct('spotify1th', [
  //   'SPOT-CODE-001',
  //   'SPOT-CODE-002',
  //   'SPOT-CODE-003',
  // ]);
})();

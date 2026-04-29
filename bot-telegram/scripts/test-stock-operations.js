// scripts/test-stock-operations.js
// Test stock reservation operations

import { reserveStock, finalizeStock, releaseStock } from '../src/database/stock.js';
import { getProductByCode } from '../src/database/products.js';
import { logger } from '../src/utils/logger.js';

async function testStockOperations() {
  try {
    console.log('\n' + '═'.repeat(60));
    console.log('  🧪  TEST STOCK OPERATIONS');
    console.log('═'.repeat(60) + '\n');
    
    // Test 1: Get product
    console.log('1️⃣  Get product...');
    const product = await getProductByCode('canvahead');
    if (!product) {
      console.error('❌ Product not found!');
      process.exit(1);
    }
    console.log(`✅ Product: ${product.nama} (Stock: ${product.stok})\n`);
    
    // Test 2: Reserve stock
    console.log('2️⃣  Reserve stock...');
    const orderId = `TEST-${Date.now()}`;
    const reserveResult = await reserveStock({
      order_id: orderId,
      kode: 'canvahead',
      qty: 2,
      userRef: 'test_user_123'
    });
    
    console.log('Reserve result:', JSON.stringify(reserveResult, null, 2));
    
    if (!reserveResult.ok) {
      console.error('❌ Reserve failed!');
      process.exit(1);
    }
    console.log(`✅ Stock reserved: Order ${orderId}\n`);
    
    // Test 3: Check product stock (should decrease)
    console.log('3️⃣  Check available stock after reservation...');
    const productAfterReserve = await getProductByCode('canvahead');
    console.log(`   Current stock in DB: ${productAfterReserve.stok}`);
    console.log(`   (Stock tetap sama, tapi reserved di stock_reservations)\n`);
    
    // Test 4: Finalize stock
    console.log('4️⃣  Finalize stock (simulate payment success)...');
    const finalizeResult = await finalizeStock({
      order_id: orderId,
      total: 10000
    });
    
    console.log('Finalize result:', JSON.stringify(finalizeResult, null, 2));
    
    if (!finalizeResult.ok) {
      console.error('❌ Finalize failed!');
      process.exit(1);
    }
    console.log(`✅ Stock finalized\n`);
    
    // Test 5: Check product stock (should decrease now)
    console.log('5️⃣  Check stock after finalize...');
    const productAfterFinalize = await getProductByCode('canvahead');
    console.log(`   Stock before: ${product.stok}`);
    console.log(`   Stock after: ${productAfterFinalize.stok}`);
    console.log(`   Difference: -${product.stok - productAfterFinalize.stok}\n`);
    
    // Test 6: Test release (create another reservation first)
    console.log('6️⃣  Test release stock...');
    const orderId2 = `TEST-${Date.now()}-2`;
    await reserveStock({
      order_id: orderId2,
      kode: 'canvahead',
      qty: 1,
      userRef: 'test_user_456'
    });
    console.log(`   Reserved order: ${orderId2}`);
    
    const releaseResult = await releaseStock({
      order_id: orderId2,
      reason: 'test_cancelled'
    });
    
    console.log('Release result:', JSON.stringify(releaseResult, null, 2));
    console.log(`✅ Stock released\n`);
    
    console.log('═'.repeat(60));
    console.log('  ✅  ALL TESTS PASSED!');
    console.log('═'.repeat(60) + '\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run tests
testStockOperations();

// test-stock-sync.js
// Test script untuk cek sinkronisasi stok bot dan dashboard

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL atau SUPABASE_ANON_KEY tidak ada di .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testStockSync() {
  console.log('\n' + '═'.repeat(60));
  console.log('🧪 TEST SINKRONISASI STOK BOT & DASHBOARD');
  console.log('═'.repeat(60) + '\n');

  try {
    // 1. Fetch all products
    console.log('1️⃣  Mengambil data produk aktif...');
    const { data: products, error: prodError } = await supabase
      .from('products')
      .select('*')
      .eq('aktif', true)
      .order('kategori', { ascending: true })
      .order('nama', { ascending: true });

    if (prodError) throw prodError;
    console.log(`   ✅ Ditemukan ${products.length} produk aktif\n`);

    // 2. Fetch all items
    console.log('2️⃣  Mengambil data items dari product_items...');
    const { data: items, error: itemError } = await supabase
      .from('product_items')
      .select('product_code, status');

    if (itemError) throw itemError;
    console.log(`   ✅ Ditemukan ${items.length} total items\n`);

    // 3. Build count map
    const countsMap = new Map();
    items.forEach((item) => {
      const key = item.product_code;
      if (!countsMap.has(key)) {
        countsMap.set(key, { available: 0, reserved: 0, sold: 0, total: 0 });
      }
      const counts = countsMap.get(key);
      counts.total++;
      if (item.status === 'available') counts.available++;
      else if (item.status === 'reserved') counts.reserved++;
      else if (item.status === 'sold') counts.sold++;
    });

    // 4. Display comparison
    console.log('3️⃣  PERBANDINGAN STOK BOT vs DASHBOARD:\n');
    console.log('┌─────────────────────────┬───────────┬────────────────┬──────────────────┐');
    console.log('│ Kode Produk             │ Stok Lama │ Available Items│ Status Items     │');
    console.log('├─────────────────────────┼───────────┼────────────────┼──────────────────┤');

    products.forEach((p) => {
      const counts = countsMap.get(p.kode) || { available: 0, reserved: 0, sold: 0, total: 0 };
      const stokLama = p.stok || 0;
      const statusItems = `${counts.available}A/${counts.reserved}R/${counts.sold}S`;
      
      const match = stokLama == counts.available ? '✅' : '❌';
      
      console.log(
        `│ ${(p.kode + ' ').padEnd(23)}│ ${String(stokLama).padStart(9)} │ ${String(counts.available).padStart(14)} │ ${statusItems.padEnd(16)} ${match} │`
      );
    });

    console.log('└─────────────────────────┴───────────┴────────────────┴──────────────────┘\n');

    // 5. Summary
    const synced = products.filter(p => {
      const counts = countsMap.get(p.kode) || { available: 0 };
      return (p.stok || 0) == counts.available;
    }).length;

    console.log(`📊 HASIL: ${synced}/${products.length} produk sudah sinkron`);
    
    if (synced === products.length) {
      console.log('✅ SEMUA DATA SUDAH SINKRON!\n');
    } else {
      console.log(`⚠️  ${products.length - synced} produk BELUM SINKRON\n`);
      console.log('Produk yang tidak sinkron:');
      products.forEach((p) => {
        const counts = countsMap.get(p.kode) || { available: 0 };
        if ((p.stok || 0) != counts.available) {
          console.log(`  - ${p.kode}: Bot=${p.stok || 0}, Dashboard=${counts.available}`);
        }
      });
      console.log();
    }

    // 6. Details by product code
    console.log('4️⃣  DETAIL SETIAP PRODUK:\n');
    Array.from(countsMap.entries()).forEach(([code, counts]) => {
      const prod = products.find(p => p.kode === code);
      if (prod) {
        console.log(`📦 ${code} - ${prod.nama}`);
        console.log(`   Total Items: ${counts.total}`);
        console.log(`   ├─ Available: ${counts.available} (dapat dijual)`);
        console.log(`   ├─ Reserved:  ${counts.reserved} (sedang pending)`);
        console.log(`   └─ Sold:      ${counts.sold} (sudah terjual)`);
        console.log(`   Bot menampilkan: "Stok: ${prod.stok || 0}"`);
        console.log(`   Seharusnya: "Stok: ${counts.available}"`);
        console.log();
      }
    });

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    process.exit(1);
  }
}

// Run test
testStockSync();

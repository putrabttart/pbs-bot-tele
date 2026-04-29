#!/usr/bin/env node

/**
 * ══════════════════════════════════════════════════════
 *   TEST FLOW UTAMA BOT TELEGRAM
 *   - Koneksi DB
 *   - Load Katalog
 *   - Cek Stok
 *   - Detail Produk
 *   - Search Produk
 *   - Reserve Stock → Create Order → Midtrans Payment
 *   - Release Stock (cleanup)
 * ══════════════════════════════════════════════════════
 */

import 'dotenv/config';

// ─── Helpers ───────────────────────────────────────────
const PASS = '\x1b[32m✅ PASS\x1b[0m';
const FAIL = '\x1b[31m❌ FAIL\x1b[0m';
const WARN = '\x1b[33m⚠️  WARN\x1b[0m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const results = [];

function header(title) {
  console.log(`\n${BOLD}${CYAN}${'═'.repeat(60)}${RESET}`);
  console.log(`${BOLD}${CYAN}  ${title}${RESET}`);
  console.log(`${BOLD}${CYAN}${'═'.repeat(60)}${RESET}\n`);
}

function subHeader(title) {
  console.log(`\n${BOLD}  ── ${title} ──${RESET}\n`);
}

function assert(testName, condition, detail = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ${PASS}  ${testName}`);
    if (detail) console.log(`       ${DIM}${detail}${RESET}`);
    results.push({ name: testName, status: 'pass' });
  } else {
    failedTests++;
    console.log(`  ${FAIL}  ${testName}`);
    if (detail) console.log(`       ${detail}`);
    results.push({ name: testName, status: 'fail', detail });
  }
}

function info(msg) {
  console.log(`  ${DIM}ℹ️  ${msg}${RESET}`);
}

function showData(label, data) {
  console.log(`  ${DIM}📦 ${label}:${RESET}`);
  const lines = JSON.stringify(data, null, 2).split('\n');
  lines.forEach(l => console.log(`     ${DIM}${l}${RESET}`));
}

// ─── Main Test Runner ──────────────────────────────────
async function runTests() {
  header('TEST FLOW UTAMA BOT TELEGRAM');
  console.log(`  Waktu   : ${new Date().toLocaleString('id-ID')}`);
  console.log(`  Env     : ${process.env.MIDTRANS_IS_PRODUCTION === 'true' ? 'PRODUCTION' : 'SANDBOX'}`);
  console.log(`  Supabase: ${process.env.SUPABASE_URL ? process.env.SUPABASE_URL.substring(0, 30) + '...' : 'NOT SET'}`);

  // ═══════════════════════════════════════════════════════
  // FLOW 0: Validasi Config
  // ═══════════════════════════════════════════════════════
  subHeader('FLOW 0: Validasi Config');

  let BOT_CONFIG;
  try {
    const configModule = await import('./src/bot/config.js');
    BOT_CONFIG = configModule.BOT_CONFIG;
    assert('Config loaded', !!BOT_CONFIG, `STORE_NAME="${BOT_CONFIG.STORE_NAME}"`);
    assert('BOT_TOKEN tersedia', !!BOT_CONFIG.TELEGRAM_BOT_TOKEN, `Token: ${BOT_CONFIG.TELEGRAM_BOT_TOKEN.substring(0, 10)}...`);
    assert('SUPABASE_URL tersedia', !!BOT_CONFIG.SUPABASE_URL, BOT_CONFIG.SUPABASE_URL.substring(0, 35) + '...');
    assert('SUPABASE_ANON_KEY tersedia', !!BOT_CONFIG.SUPABASE_ANON_KEY, `Key: ${BOT_CONFIG.SUPABASE_ANON_KEY.substring(0, 20)}...`);
    assert('MIDTRANS_SERVER_KEY tersedia', !!BOT_CONFIG.MIDTRANS_SERVER_KEY, `Key: ${BOT_CONFIG.MIDTRANS_SERVER_KEY.substring(0, 15)}...`);
    assert('ADMIN_IDS tersedia', BOT_CONFIG.TELEGRAM_ADMIN_IDS.length > 0, `Admins: ${BOT_CONFIG.TELEGRAM_ADMIN_IDS.join(', ')}`);
  } catch (err) {
    assert('Config loaded', false, err.message);
    console.log('\n  ❌ Config gagal dimuat, tidak bisa lanjut test.\n');
    process.exit(1);
  }

  // ═══════════════════════════════════════════════════════
  // FLOW 1: Koneksi Database Supabase
  // ═══════════════════════════════════════════════════════
  subHeader('FLOW 1: Koneksi Database Supabase');

  let supabase;
  try {
    const dbModule = await import('./src/database/supabase.js');
    supabase = dbModule.supabase;
    assert('Supabase client initialized', !!supabase);

    const { data, error } = await supabase.from('products').select('count').limit(1);
    assert('Database connection OK', !error, error ? `Error: ${error.message}` : 'Query berhasil');
  } catch (err) {
    assert('Supabase client initialized', false, err.message);
    console.log('\n  ❌ Database gagal connect, tidak bisa lanjut test.\n');
    process.exit(1);
  }

  // ═══════════════════════════════════════════════════════
  // FLOW 2: Load Katalog Produk
  // ═══════════════════════════════════════════════════════
  subHeader('FLOW 2: Load Katalog Produk');

  let products = [];
  try {
    const { loadProducts, getAll } = await import('./src/data/products.js');

    info('Memanggil loadProducts(true) - force reload dari Supabase...');
    await loadProducts(true);
    products = getAll();

    assert('Products loaded dari Supabase', products.length > 0, `Total: ${products.length} produk`);

    // Tampilkan sample katalog
    if (products.length > 0) {
      console.log('');
      info('Sample Katalog (5 produk pertama):');
      console.log(`  ${'─'.repeat(56)}`);
      console.log(`  ${BOLD}${'No'.padEnd(4)} ${'Kode'.padEnd(14)} ${'Nama'.padEnd(28)} ${'Stok'.padEnd(6)} Harga${RESET}`);
      console.log(`  ${'─'.repeat(56)}`);
      products.slice(0, 5).forEach((p, i) => {
        const harga = Number(p.harga_bot || 0).toLocaleString('id-ID');
        console.log(`  ${String(i + 1).padEnd(4)} ${(p.kode || '-').padEnd(14)} ${(p.nama || '-').substring(0, 27).padEnd(28)} ${String(p.stok || 0).padEnd(6)} Rp ${harga}`);
      });
      console.log(`  ${'─'.repeat(56)}`);
    }

    // Cek fields penting ada
    const sample = products[0];
    assert('Field "kode" ada', !!sample.kode, `kode: "${sample.kode}"`);
    assert('Field "nama" ada', !!sample.nama, `nama: "${sample.nama}"`);
    assert('Field "harga_bot" ada', sample.harga_bot !== undefined, `harga_bot: "${sample.harga_bot}"`);
    assert('Field "stok" ada', sample.stok !== undefined, `stok: "${sample.stok}"`);
    assert('Field "kategori" ada', sample.kategori !== undefined, `kategori: "${sample.kategori}"`);
  } catch (err) {
    assert('Products loaded dari Supabase', false, err.message);
  }

  // ═══════════════════════════════════════════════════════
  // FLOW 3: Cek Stok Produk
  // ═══════════════════════════════════════════════════════
  subHeader('FLOW 3: Cek Stok Produk');

  try {
    const inStock = products.filter(p => Number(p.stok) > 0);
    const outOfStock = products.filter(p => Number(p.stok) === 0);

    assert('Ada produk dengan stok > 0', inStock.length > 0, `${inStock.length} produk tersedia`);
    info(`Produk stok habis: ${outOfStock.length}`);

    if (inStock.length > 0) {
      console.log('');
      info('Produk dengan stok tersedia:');
      console.log(`  ${'─'.repeat(50)}`);
      inStock.slice(0, 8).forEach(p => {
        const avail = p.available_items || 0;
        const total = p.total_items || 0;
        const stockInfo = total > 0 ? `${avail}/${total} items` : `${p.stok} stok`;
        console.log(`  ${DIM}  ${(p.kode || '-').padEnd(14)} ${(p.nama || '-').substring(0, 25).padEnd(26)} ${stockInfo}${RESET}`);
      });
      console.log(`  ${'─'.repeat(50)}`);
    }

    // Cek product_items system
    const withItems = products.filter(p => Number(p.total_items) > 0);
    assert('Product items system aktif', withItems.length > 0, `${withItems.length} produk menggunakan item system`);
  } catch (err) {
    assert('Cek stok produk', false, err.message);
  }

  // ═══════════════════════════════════════════════════════
  // FLOW 4: Detail Produk (byKode)
  // ═══════════════════════════════════════════════════════
  subHeader('FLOW 4: Detail Produk (byKode)');

  let testProduct = null;
  try {
    const { byKode } = await import('./src/data/products.js');

    // Ambil produk pertama yang punya stok
    const inStock = products.filter(p => Number(p.stok) > 0);
    if (inStock.length === 0) {
      info('Tidak ada produk dengan stok, skip test detail');
    } else {
      const targetCode = inStock[0].kode;
      testProduct = byKode(targetCode);

      assert('byKode() menemukan produk', !!testProduct, `Kode: "${targetCode}"`);

      if (testProduct) {
        console.log('');
        info(`Detail Produk "${testProduct.kode}":`);
        showData('Product', {
          kode: testProduct.kode,
          nama: testProduct.nama,
          kategori: testProduct.kategori,
          harga_bot: testProduct.harga_bot,
          harga_web: testProduct.harga_web,
          stok: testProduct.stok,
          available_items: testProduct.available_items,
          total_items: testProduct.total_items,
          deskripsi: (testProduct.deskripsi || '').substring(0, 80) + (testProduct.deskripsi?.length > 80 ? '...' : ''),
          aktif: testProduct.aktif,
        });

        // Test format detail
        const { formatProductDetail, formatCurrency } = await import('./src/bot/formatters.js');
        const detailText = formatProductDetail(testProduct, 1);
        assert('formatProductDetail() berhasil', detailText.length > 0, `Output: ${detailText.length} chars`);
        
        console.log('');
        info('Contoh output detail (yang dikirim ke user):');
        console.log(`  ${'─'.repeat(50)}`);
        detailText.split('\n').forEach(l => console.log(`  ${DIM}${l}${RESET}`));
        console.log(`  ${'─'.repeat(50)}`);

        // Test harga format
        const harga = Number(testProduct.harga_bot);
        const formatted = formatCurrency(harga);
        assert('formatCurrency() berhasil', formatted.includes('Rp'), `${harga} → "${formatted}"`);
      }

      // Test kode yang tidak ada
      const notFound = byKode('XXXNOTEXIST999');
      assert('byKode() return undefined untuk kode invalid', !notFound);
    }
  } catch (err) {
    assert('Detail produk', false, err.message);
  }

  // ═══════════════════════════════════════════════════════
  // FLOW 5: Search Produk
  // ═══════════════════════════════════════════════════════
  subHeader('FLOW 5: Search Produk');

  try {
    const { searchProducts } = await import('./src/data/products.js');

    // Search by nama
    const keyword = products[0]?.nama?.split(' ')[0] || 'premium';
    const searchResult = searchProducts(keyword);
    assert('searchProducts() mengembalikan hasil', searchResult.length > 0, `Query: "${keyword}" → ${searchResult.length} hasil`);

    if (searchResult.length > 0) {
      console.log('');
      info(`Hasil search "${keyword}":`);
      searchResult.slice(0, 5).forEach((p, i) => {
        console.log(`  ${DIM}  ${i + 1}. ${p.kode} - ${p.nama} (Stok: ${p.stok})${RESET}`);
      });
    }

    // Search yang tidak ada
    const emptyResult = searchProducts('zzzzxxxxxnotfound99999');
    assert('Search kosong return array kosong', emptyResult.length === 0, `Query: "zzzzxxxxxnotfound99999" → 0 hasil`);

    // Search by kode
    if (testProduct) {
      const byCodeSearch = searchProducts(testProduct.kode);
      assert('Search by kode produk', byCodeSearch.length > 0, `Query: "${testProduct.kode}" → ${byCodeSearch.length} hasil`);
    }
  } catch (err) {
    assert('Search produk', false, err.message);
  }

  // ═══════════════════════════════════════════════════════
  // FLOW 6: Kategori Produk
  // ═══════════════════════════════════════════════════════
  subHeader('FLOW 6: Kategori Produk');

  try {
    const { categories } = await import('./src/data/products.js');
    const cats = await categories();

    assert('categories() mengembalikan data', cats.length > 0, `Total: ${cats.length} kategori`);

    if (cats.length > 0) {
      console.log('');
      info('Daftar Kategori:');
      cats.forEach((c, i) => {
        const count = products.filter(p => p.kategori === c).length;
        console.log(`  ${DIM}  ${i + 1}. ${c} (${count} produk)${RESET}`);
      });
    }
  } catch (err) {
    assert('Kategori produk', false, err.message);
  }

  // ═══════════════════════════════════════════════════════
  // FLOW 7: Format Katalog (yang dikirim ke user)
  // ═══════════════════════════════════════════════════════
  subHeader('FLOW 7: Format Katalog');

  try {
    const { formatProductList } = await import('./src/bot/formatters.js');

    const sortedProducts = [...products].sort((a, b) => {
      return String(a.nama || '').localeCompare(String(b.nama || ''), 'id-ID', { sensitivity: 'base' });
    });

    const page1 = sortedProducts.slice(0, 10);
    const catalogText = formatProductList(page1, 1, 10, sortedProducts.length);

    assert('formatProductList() berhasil', catalogText.length > 0, `Output: ${catalogText.length} chars`);

    console.log('');
    info('Contoh output katalog halaman 1 (yang dikirim ke user):');
    console.log(`  ${'─'.repeat(50)}`);
    catalogText.split('\n').forEach(l => console.log(`  ${DIM}${l}${RESET}`));
    console.log(`  ${'─'.repeat(50)}`);
  } catch (err) {
    assert('Format katalog', false, err.message);
  }

  // ═══════════════════════════════════════════════════════
  // FLOW 8: Reserve Stock + Create Payment (Midtrans QRIS)
  // ═══════════════════════════════════════════════════════
  subHeader('FLOW 8: Reserve Stock → Create Payment (Midtrans QRIS)');

  let testOrderId = null;
  let reserveOk = false;

  if (!testProduct || Number(testProduct.stok) === 0) {
    info('Tidak ada produk dengan stok untuk test payment flow, skip...');
  } else {
    try {
      const { reserveStock, releaseStock } = await import('./src/database/stock.js');
      const { createMidtransQRISCharge, midtransStatus } = await import('./src/payments/midtrans.js');

      const timestamp = Date.now();
      testOrderId = `TEST-${timestamp.toString(36).toUpperCase().slice(-8)}`;
      const testQty = 1;
      const testPrice = Number(testProduct.harga_bot);

      info(`Test order: ${testOrderId}`);
      info(`Produk: ${testProduct.nama} (${testProduct.kode})`);
      info(`Qty: ${testQty}, Harga: Rp ${testPrice.toLocaleString('id-ID')}`);

      // Step 1: Reserve Stock
      console.log('');
      info('Step 1: Reserve stock...');
      const reserveResult = await reserveStock({
        order_id: testOrderId,
        kode: testProduct.kode,
        qty: testQty,
        userRef: 'tg:TEST_USER_0',
      });

      assert('reserveStock() berhasil', reserveResult?.ok === true, `Response: ${JSON.stringify(reserveResult)}`);
      reserveOk = reserveResult?.ok === true;

      if (reserveOk) {
        // Step 2: Create Midtrans QRIS Payment
        console.log('');
        info('Step 2: Create Midtrans QRIS payment...');
        const chargeResult = await createMidtransQRISCharge({
          order_id: testOrderId,
          gross_amount: testPrice * testQty,
        });

        const hasQR = !!chargeResult?.qr_string || !!chargeResult?.qr_url;
        assert('Midtrans QRIS charge berhasil', hasQR, `QR String: ${chargeResult?.qr_string ? 'YES' : 'NO'}, QR URL: ${chargeResult?.qr_url ? 'YES' : 'NO'}`);

        if (hasQR) {
          showData('Midtrans Response', {
            status_code: chargeResult.status_code,
            status_message: chargeResult.status_message,
            transaction_id: chargeResult.transaction_id,
            order_id: chargeResult.order_id,
            gross_amount: chargeResult.gross_amount,
            payment_type: chargeResult.payment_type,
            transaction_status: chargeResult.transaction_status,
            qr_string: chargeResult.qr_string ? `${chargeResult.qr_string.substring(0, 40)}...` : null,
            qr_url: chargeResult.qr_url || null,
            expiry_time: chargeResult.expiry_time,
          });
        }

        // Step 3: Check Payment Status
        console.log('');
        info('Step 3: Cek payment status via Midtrans API...');
        try {
          const status = await midtransStatus(testOrderId);
          assert('midtransStatus() berhasil', !!status?.transaction_status, `Status: "${status.transaction_status}"`);

          showData('Payment Status', {
            order_id: status.order_id,
            transaction_status: status.transaction_status,
            gross_amount: status.gross_amount,
            payment_type: status.payment_type,
            transaction_time: status.transaction_time,
          });
        } catch (statusErr) {
          assert('midtransStatus() berhasil', false, statusErr.message);
        }

        // Step 4: Release stock (cleanup - jangan finalize karena ini test)
        console.log('');
        info('Step 4: Release stock (cleanup test)...');
        const releaseResult = await releaseStock({
          order_id: testOrderId,
          reason: 'test_cleanup',
        });
        assert('releaseStock() berhasil', releaseResult?.ok === true, `Response: ${JSON.stringify(releaseResult)}`);
      }
    } catch (err) {
      assert('Payment flow', false, err.message);

      // Cleanup jika reserve berhasil tapi ada error setelahnya
      if (reserveOk && testOrderId) {
        try {
          const { releaseStock } = await import('./src/database/stock.js');
          await releaseStock({ order_id: testOrderId, reason: 'test_error_cleanup' });
          info('Stock released setelah error (cleanup)');
        } catch {}
      }
    }
  }

  // ═══════════════════════════════════════════════════════
  // FLOW 9: Database Orders (Read)
  // ═══════════════════════════════════════════════════════
  subHeader('FLOW 9: Database Orders');

  try {
    const { getOrderStats } = await import('./src/database/orders.js');
    const stats = await getOrderStats();

    assert('getOrderStats() berhasil', stats !== null);
    showData('Order Statistics', stats);
  } catch (err) {
    assert('Order stats', false, err.message);
  }

  // ═══════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════
  header('HASIL TEST');

  console.log(`  Total Tests  : ${BOLD}${totalTests}${RESET}`);
  console.log(`  ${PASS.replace('PASS', `Passed     : ${BOLD}${passedTests}${RESET}`)}`);
  if (failedTests > 0) {
    console.log(`  ${FAIL.replace('FAIL', `Failed     : ${BOLD}${failedTests}${RESET}`)}`);
  } else {
    console.log(`  ❌ Failed     : ${BOLD}0${RESET}`);
  }
  console.log(`  Success Rate : ${BOLD}${((passedTests / totalTests) * 100).toFixed(1)}%${RESET}`);

  if (failedTests > 0) {
    console.log(`\n  ${BOLD}Failed Tests:${RESET}`);
    results.filter(r => r.status === 'fail').forEach(r => {
      console.log(`    ${FAIL}  ${r.name}`);
      if (r.detail) console.log(`       ${r.detail}`);
    });
  }

  console.log(`\n${'═'.repeat(60)}\n`);
  process.exit(failedTests > 0 ? 1 : 0);
}

// ─── Run ───────────────────────────────────────────────
runTests().catch(err => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});

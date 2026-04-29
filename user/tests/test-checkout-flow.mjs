#!/usr/bin/env node

/**
 * ══════════════════════════════════════════════════════════
 *   TEST CHECKOUT FLOW — WEB USER STORE
 *
 *   Simulasi end-to-end checkout seperti yang dilakukan browser:
 *   1. Koneksi DB
 *   2. Load produk aktif dengan stok
 *   3. Validasi harga server-side
 *   4. Rate limit check (yang sudah diperbaiki)
 *   5. Reserve stock via RPC
 *   6. Create Midtrans QRIS payment
 *   7. Insert order ke database
 *   8. Release stock (cleanup)
 * ══════════════════════════════════════════════════════════
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env.local manually (dotenv doesn't auto-load .env.local)
const __dirname = dirname(fileURLToPath(import.meta.url));
const envLocalPath = resolve(__dirname, '..', '.env.local');
try {
  const envContent = readFileSync(envLocalPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.replace(/^\uFEFF/, '').trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) return;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  });
} catch {}

// ─── Helpers ───
const PASS = '\x1b[32m✅ PASS\x1b[0m';
const FAIL = '\x1b[31m❌ FAIL\x1b[0m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';

let total = 0, passed = 0, failed = 0;

function header(t) { console.log(`\n${BOLD}${CYAN}${'═'.repeat(60)}${RESET}\n${BOLD}${CYAN}  ${t}${RESET}\n${BOLD}${CYAN}${'═'.repeat(60)}${RESET}\n`); }
function sub(t) { console.log(`\n${BOLD}  ── ${t} ──${RESET}\n`); }
function assert(name, cond, detail = '') {
  total++;
  if (cond) { passed++; console.log(`  ${PASS}  ${name}`); }
  else { failed++; console.log(`  ${FAIL}  ${name}`); }
  if (detail) console.log(`       ${DIM}${detail}${RESET}`);
}
function info(m) { console.log(`  ${DIM}ℹ️  ${m}${RESET}`); }
function showData(label, data) {
  console.log(`  ${DIM}📦 ${label}:${RESET}`);
  JSON.stringify(data, null, 2).split('\n').forEach(l => console.log(`     ${DIM}${l}${RESET}`));
}

// ─── Main ───
async function run() {
  header('TEST CHECKOUT FLOW — WEB USER STORE');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const midtransServerKey = process.env.MIDTRANS_SERVER_KEY || '';
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';

  console.log(`  Waktu    : ${new Date().toLocaleString('id-ID')}`);
  console.log(`  Midtrans : ${isProduction ? 'PRODUCTION' : 'SANDBOX'}`);
  console.log(`  Supabase : ${supabaseUrl.substring(0, 35)}...`);

  // ═══ FLOW 1: Koneksi DB ═══
  sub('FLOW 1: Koneksi Database');

  assert('SUPABASE_URL tersedia', !!supabaseUrl);
  assert('SUPABASE_SERVICE_ROLE_KEY tersedia', !!supabaseServiceKey, `Key: ${supabaseServiceKey.substring(0, 20)}...`);
  assert('MIDTRANS_SERVER_KEY tersedia', !!midtransServerKey, `Key: ${midtransServerKey.substring(0, 20)}...`);

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: pingData, error: pingErr } = await supabase.from('products').select('count').limit(1);
  assert('Database connection OK', !pingErr, pingErr ? `Error: ${pingErr.message}` : 'Query berhasil');

  if (pingErr) { console.log('\n  ❌ DB gagal, stop.\n'); process.exit(1); }

  // ═══ FLOW 2: Load produk aktif dengan stok ═══
  sub('FLOW 2: Load Produk Aktif');

  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('id, kode, nama, harga_web, harga_bot, stok, aktif')
    .eq('aktif', true);

  assert('Products loaded', !prodErr && products?.length > 0, `${products?.length || 0} produk aktif`);

  // Cek stok via product_inventory_summary view
  const productIds = (products || []).map(p => p.id);
  let inventoryMap = new Map();

  const { data: inventoryRows, error: invErr } = await supabase
    .from('product_inventory_summary')
    .select('product_id, available_items, total_items')
    .in('product_id', productIds);

  if (invErr) {
    info(`⚠️ product_inventory_summary error: ${invErr.message} — fallback ke stok field`);
  } else {
    (inventoryRows || []).forEach(r => inventoryMap.set(r.product_id, r));
  }

  // Cari produk dengan stok tersedia
  const availableProducts = (products || []).filter(p => {
    const inv = inventoryMap.get(p.id);
    const effectiveStock = inv?.total_items > 0 ? inv.available_items : Number(p.stok || 0);
    return effectiveStock > 0;
  });

  assert('Ada produk dengan stok', availableProducts.length > 0, `${availableProducts.length} produk tersedia`);

  if (availableProducts.length === 0) {
    console.log('\n  ❌ Tidak ada produk dengan stok, stop.\n');
    process.exit(1);
  }

  const testProduct = availableProducts[0];
  const testInv = inventoryMap.get(testProduct.id);
  const testStock = testInv?.total_items > 0 ? testInv.available_items : Number(testProduct.stok || 0);
  const testPrice = Number(testProduct.harga_web || testProduct.harga_bot || 0);

  info(`Test produk: ${testProduct.nama} (${testProduct.kode})`);
  info(`Stok: ${testStock}, Harga web: Rp ${testPrice.toLocaleString('id-ID')}`);

  // ═══ FLOW 3: Validasi harga server-side ═══
  sub('FLOW 3: Validasi Harga Server-Side');

  assert('Harga web > 0', testPrice > 0, `Rp ${testPrice.toLocaleString('id-ID')}`);
  assert('Stok cukup (>= 1)', testStock >= 1, `Stok: ${testStock}`);

  const totalAmount = testPrice * 1; // qty = 1
  assert('Total amount valid', totalAmount > 0, `Rp ${totalAmount.toLocaleString('id-ID')}`);

  // ═══ FLOW 4: Rate Limit Check (yang sudah diperbaiki) ═══
  sub('FLOW 4: Rate Limit Check');

  const testEmail = 'test-checkout@example.com';
  const testPhone = '081234567890';
  const testIp = '127.0.0.1';
  const windowStart = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  // Cek pending orders by email (cara baru — direct query)
  const { count: emailPending, error: emailErr } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('customer_email', testEmail)
    .eq('status', 'pending')
    .gte('created_at', windowStart);

  assert('Rate limit email check OK', !emailErr, emailErr ? `Error: ${emailErr.message}` : `Pending orders email: ${emailPending || 0}`);

  // Cek pending orders by phone
  const { count: phonePending, error: phoneErr } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('customer_phone', testPhone)
    .eq('status', 'pending')
    .gte('created_at', windowStart);

  assert('Rate limit phone check OK', !phoneErr, phoneErr ? `Error: ${phoneErr.message}` : `Pending orders phone: ${phonePending || 0}`);

  const rateLimitPassed = (emailPending || 0) < 2 && (phonePending || 0) < 2;
  assert('Rate limit PASSED (< 2 pending)', rateLimitPassed, `Email: ${emailPending || 0}/2, Phone: ${phonePending || 0}/2`);

  // ═══ FLOW 5: Cek RPC lama (untuk diagnostik) ═══
  sub('FLOW 5: Diagnostik RPC Lama');

  try {
    const { data: rpcResult, error: rpcErr } = await supabase.rpc('check_and_update_rate_limits', {
      p_ip: testIp,
      p_email: testEmail,
      p_phone: testPhone,
      p_request_limit: 3,
      p_pending_limit: 2,
      p_window_minutes: 30,
    });

    if (rpcErr) {
      assert('RPC check_and_update_rate_limits', false, `ERROR: ${rpcErr.message}`);
      info('↑ Ini yang menyebabkan 429 sebelumnya! Sekarang sudah di-bypass dengan direct query.');
    } else {
      assert('RPC check_and_update_rate_limits', true, `Result: ${JSON.stringify(rpcResult)}`);
    }
  } catch (e) {
    assert('RPC check_and_update_rate_limits', false, `Exception: ${e.message}`);
    info('↑ RPC gagal, tapi checkout sekarang tidak bergantung pada RPC ini.');
  }

  // ═══ FLOW 6: Reserve Stock ═══
  sub('FLOW 6: Reserve Stock');

  const testOrderId = `TEST-WEB-${Date.now()}`;
  let reserveOk = false;

  info(`Order ID: ${testOrderId}`);
  info(`Produk: ${testProduct.kode}, Qty: 1`);

  try {
    const { data: reserveResult, error: reserveErr } = await supabase.rpc('reserve_items_for_order', {
      p_order_id: testOrderId,
      p_product_code: testProduct.kode,
      p_quantity: 1,
    });

    if (reserveErr) {
      assert('reserve_items_for_order RPC', false, `Error: ${reserveErr.message}`);
    } else {
      reserveOk = reserveResult?.ok === true;
      assert('reserve_items_for_order RPC', reserveOk, `Result: ${JSON.stringify(reserveResult)}`);
    }
  } catch (e) {
    assert('reserve_items_for_order RPC', false, `Exception: ${e.message}`);
  }

  // ═══ FLOW 7: Create Midtrans QRIS Payment ═══
  sub('FLOW 7: Create Midtrans QRIS Payment');

  let transactionId = null;
  let qrString = null;
  let qrUrl = null;

  if (!reserveOk) {
    info('Skip — reserve gagal');
  } else {
    const auth = Buffer.from(midtransServerKey + ':').toString('base64');
    const apiBase = isProduction ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com';

    const qrisPayload = {
      payment_type: 'qris',
      transaction_details: {
        order_id: testOrderId,
        gross_amount: totalAmount,
      },
      customer_details: {
        first_name: 'Test User',
        email: testEmail,
        phone: testPhone,
      },
    };

    info('Sending QRIS charge request...');

    try {
      const res = await fetch(`${apiBase}/v2/charge`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify(qrisPayload),
      });

      const text = await res.text();
      const json = JSON.parse(text);

      transactionId = json.transaction_id;
      qrString = json.qr_string;
      const qrAction = json.actions?.find(a => a.name === 'generate-qr-code');
      qrUrl = qrAction?.url || null;

      assert('Midtrans QRIS charge berhasil', res.ok && (!!qrString || !!qrUrl),
        `Status: ${json.transaction_status}, QR: ${qrString ? 'YES' : 'NO'}`);

      showData('Midtrans Response', {
        status_code: json.status_code,
        status_message: json.status_message,
        transaction_id: json.transaction_id,
        order_id: json.order_id,
        gross_amount: json.gross_amount,
        payment_type: json.payment_type,
        transaction_status: json.transaction_status,
        qr_string: qrString ? qrString.substring(0, 40) + '...' : null,
        qr_url: qrUrl,
        expiry_time: json.expiry_time,
      });
    } catch (e) {
      assert('Midtrans QRIS charge berhasil', false, `Exception: ${e.message}`);
    }
  }

  // ═══ FLOW 8: Insert Order ke Database ═══
  sub('FLOW 8: Insert Order ke Database');

  let orderInserted = false;

  if (!reserveOk) {
    info('Skip — reserve gagal');
  } else {
    const itemsArray = [{
      product_id: testProduct.id,
      product_name: testProduct.nama,
      product_code: testProduct.kode,
      quantity: 1,
      price: testPrice,
    }];

    try {
      const { data: insertedOrder, error: insertErr } = await supabase
        .from('orders')
        .insert({
          order_id: testOrderId,
          transaction_id: transactionId,
          customer_name: 'Test User',
          customer_email: testEmail,
          customer_phone: testPhone,
          total_amount: totalAmount,
          status: 'pending',
          payment_method: 'qris',
          items: itemsArray,
        })
        .select();

      if (insertErr) {
        assert('Insert order ke database', false, `Error: ${insertErr.message} | Code: ${insertErr.code} | Hint: ${insertErr.hint || '-'}`);
      } else {
        orderInserted = insertedOrder && insertedOrder.length > 0;
        assert('Insert order ke database', orderInserted, `Order ID: ${testOrderId}`);
      }
    } catch (e) {
      assert('Insert order ke database', false, `Exception: ${e.message}`);
    }
  }

  // ═══ FLOW 9: Cek Payment Status ═══
  sub('FLOW 9: Cek Payment Status');

  if (!transactionId) {
    info('Skip — tidak ada transaction');
  } else {
    const auth = Buffer.from(midtransServerKey + ':').toString('base64');
    const apiBase = isProduction ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com';

    try {
      const res = await fetch(`${apiBase}/v2/${testOrderId}/status`, {
        headers: { accept: 'application/json', Authorization: `Basic ${auth}` },
      });
      const json = JSON.parse(await res.text());

      assert('Payment status check', !!json.transaction_status, `Status: "${json.transaction_status}"`);
    } catch (e) {
      assert('Payment status check', false, e.message);
    }
  }

  // ═══ FLOW 10: Cleanup ═══
  sub('FLOW 10: Cleanup Test Data');

  // Release reserved items
  if (reserveOk) {
    try {
      const { data: releaseResult } = await supabase.rpc('release_reserved_items', {
        p_order_id: testOrderId,
      });
      assert('Release reserved items', releaseResult?.ok === true, `Result: ${JSON.stringify(releaseResult)}`);
    } catch (e) {
      assert('Release reserved items', false, e.message);
    }
  }

  // Delete test order
  if (orderInserted) {
    try {
      const { error: delErr } = await supabase
        .from('orders')
        .delete()
        .eq('order_id', testOrderId);
      assert('Delete test order', !delErr, delErr ? delErr.message : `Deleted: ${testOrderId}`);
    } catch (e) {
      assert('Delete test order', false, e.message);
    }
  }

  // ═══ SUMMARY ═══
  header('HASIL TEST');
  console.log(`  Total Tests  : ${BOLD}${total}${RESET}`);
  console.log(`  ${PASS.replace('PASS', `Passed     : ${BOLD}${passed}${RESET}`)}`);
  if (failed > 0) {
    console.log(`  ${FAIL.replace('FAIL', `Failed     : ${BOLD}${failed}${RESET}`)}`);
  } else {
    console.log(`  ❌ Failed     : ${BOLD}0${RESET}`);
  }
  console.log(`  Success Rate : ${BOLD}${((passed / total) * 100).toFixed(1)}%${RESET}`);
  console.log(`\n${'═'.repeat(60)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => { console.error('\n❌ Fatal:', err); process.exit(1); });

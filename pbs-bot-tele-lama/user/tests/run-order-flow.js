/**
 * Automated order flow test (manual payment)
 * - Creates checkout via /api/checkout
 * - Prints QR URL for manual payment
 * - Polls /api/orders/{orderId} until completed
 * - Verifies item_data populated from product_items/order_items
 *
 * Usage:
 *   node user/tests/run-order-flow.js --count=3 --code=viult --qty=1 --host=http://localhost:3001
 */

const { createClient } = require('@supabase/supabase-js')
const { URL } = require('url')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Parse args
const args = process.argv.slice(2)
const argMap = Object.fromEntries(
  args.map(a => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? true]
  })
)
const COUNT = Number(argMap.count || 1)
const PRODUCT_CODE = String(argMap.code || process.env.TEST_PRODUCT_CODE || 'viult')
const QTY = Number(argMap.qty || 1)
const HOST = String(argMap.host || 'http://localhost:3001')

async function getProductByCode(code) {
  const { data, error } = await supabase
    .from('products')
    .select('id, nama, kode, harga')
    .eq('kode', code)
    .single()
  if (error || !data) throw new Error(`Product not found for code ${code}: ${error?.message}`)
  return data
}

async function createCheckout(product, quantity) {
  const payload = {
    items: [{ product, quantity }],
    customerName: 'Test User',
    customerEmail: 'test@example.com',
    customerPhone: '081234567890',
  }
  const res = await fetch(new URL('/api/checkout', HOST), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Checkout failed')
  return data
}

async function pollOrder(orderId, { timeoutMs = 180000, intervalMs = 3000 } = {}) {
  const start = Date.now()
  let attempts = 0
  while (Date.now() - start < timeoutMs) {
    attempts++
    const res = await fetch(new URL(`/api/orders/${encodeURIComponent(orderId)}`, HOST))
    const data = await res.json()
    const status = (data.status || '').toLowerCase()
    
    console.log(`[Poll #${attempts}] Status: ${status} (raw: ${data.status})`)
    
    if (res.ok && status === 'completed') {
      console.log('✅ Payment confirmed!')
      return data
    }
    
    // Log if pending to show it's still waiting
    if (status === 'pending') {
      process.stdout.write('.')
    }
    
    await new Promise(r => setTimeout(r, intervalMs))
  }
  throw new Error(`Timeout waiting for order completion after ${attempts} attempts`)
}

async function verifyOrderItems(orderId) {
  const { data: order } = await supabase
    .from('orders')
    .select('id')
    .eq('order_id', orderId)
    .single()
  if (!order) return { ok: false, msg: 'order not found' }

  const { data: items } = await supabase
    .from('order_items')
    .select('product_code, item_data')
    .eq('order_id', order.id)
  const hasItemData = (items || []).some(i => !!i.item_data)
  return { ok: hasItemData, items: items || [] }
}

async function runOnce(iter) {
  console.log(`\n=== RUN ${iter} ===`)
  const product = await getProductByCode(PRODUCT_CODE)
  console.log('Product:', product)

  const checkout = await createCheckout(product, QTY)
  console.log('Checkout created:', {
    orderId: checkout.orderId,
    transactionId: checkout.transactionId,
    amount: checkout.amount,
    qrUrl: checkout.qrUrl,
  })
  console.log(`\n🔗 Scan QR ini untuk bayar: ${checkout.qrUrl}`)
  console.log(`📱 Atau buka di browser dan scan dengan aplikasi pembayaran\n`)

  console.log('⏳ Menunggu pembayaran (manual)...')
  console.log('💡 Tips: Jika webhook tidak jalan, refresh halaman order-success di browser\n')
  
  try {
    const order = await pollOrder(checkout.orderId)
    console.log('\n✅ Order selesai:', {
      orderId: order.orderId,
      status: order.status,
    })

    const verify = await verifyOrderItems(checkout.orderId)
    console.log('📦 Verifikasi order_items:', verify)
    if (!verify.ok) throw new Error('item_data tidak terisi di order_items')
    
    console.log('✅ Item data berhasil terisi!')
  } catch (err) {
    console.error('\n❌ Error:', err.message)
    console.log('\n💡 Coba cek:')
    console.log('   1. Apakah webhook Midtrans sudah dikonfigurasi?')
    console.log('   2. Buka http://localhost:3001/order-success?orderId=' + checkout.orderId)
    console.log('   3. Cek log terminal untuk error webhook\n')
    throw err
  }
}

async function main() {
  for (let i = 1; i <= COUNT; i++) {
    try {
      await runOnce(i)
      console.log(`RUN ${i} ✅ OK`)
    } catch (e) {
      console.error(`RUN ${i} ❌ Failed:`, e.message)
    }
  }
  console.log('\nAll done.')
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})

/*
 * Debug script: simulateOrder()
 *
 * Tujuan:
 * - Buat order dummy via /api/checkout
 * - Opsional simulasi webhook settlement (agar flow completed berjalan)
 * - Trigger endpoint /api/test-email
 * - Catat log ringkas untuk isolasi masalah checkout vs SMTP
 *
 * Usage:
 *   node tests/simulate-order.js --host=http://localhost:3001 --code=viult --qty=1 --email=test@example.com --simulateSettlement=true
 */

const crypto = require('crypto')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const args = process.argv.slice(2)
const argMap = Object.fromEntries(
  args.map((arg) => {
    const [k, v] = arg.replace(/^--/, '').split('=')
    return [k, v ?? true]
  })
)

const HOST = String(argMap.host || process.env.SIMULATE_ORDER_HOST || 'http://localhost:3001')
const PRODUCT_CODE = String(argMap.code || process.env.TEST_PRODUCT_CODE || '').trim()
const QTY = Math.max(1, Number(argMap.qty || 1))
const TEST_EMAIL = String(argMap.email || process.env.SMTP_TEST_TO || process.env.SMTP_USER || process.env.SMTP_FROM_EMAIL || '').trim()
const SIMULATE_SETTLEMENT = String(argMap.simulateSettlement || 'true').toLowerCase() !== 'false'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

function ts() {
  return new Date().toISOString()
}

function log(scope, message, fields) {
  const suffix = fields && Object.keys(fields).length
    ? ' | ' + Object.entries(fields).map(([k, v]) => `${k}=${String(v)}`).join(' | ')
    : ''
  console.log(`[${ts()}] [SIMULATE] [${scope}] ${message}${suffix}`)
}

async function fetchJson(url, options) {
  const response = await fetch(url, options)
  const text = await response.text()
  let body

  try {
    body = text ? JSON.parse(text) : {}
  } catch {
    body = { raw: text }
  }

  return {
    ok: response.ok,
    status: response.status,
    body,
  }
}

async function getProductByCode(productCode) {
  if (productCode) {
    const { data, error } = await supabase
      .from('products')
      .select('id, nama, kode, harga_web, harga_bot')
      .eq('kode', productCode)
      .single()

    if (error || !data) {
      throw new Error(`Product code tidak ditemukan: ${productCode}. Detail: ${error?.message || 'unknown_error'}`)
    }

    return {
      ...data,
      harga: Number(data.harga_web ?? data.harga_bot ?? 0),
    }
  }

  const { data, error } = await supabase
    .from('products')
    .select('id, nama, kode, harga_web, harga_bot')
    .eq('aktif', true)
    .limit(1)
    .single()

  if (error || !data) {
    throw new Error(`Tidak bisa ambil produk default. Detail: ${error?.message || 'unknown_error'}`)
  }

  return {
    ...data,
    harga: Number(data.harga_web ?? data.harga_bot ?? 0),
  }
}

function buildSettlementPayload(checkoutResult) {
  const orderId = String(checkoutResult.orderId || '')
  const grossAmount = String(Math.round(Number(checkoutResult.amount || 0)))
  const statusCode = '200'
  const serverKey = String(process.env.MIDTRANS_SERVER_KEY || '')

  const signature = crypto
    .createHash('sha512')
    .update(orderId + statusCode + grossAmount + serverKey)
    .digest('hex')

  return {
    order_id: orderId,
    status_code: statusCode,
    gross_amount: grossAmount,
    transaction_status: 'settlement',
    payment_type: 'qris',
    transaction_id: String(checkoutResult.transactionId || `SIM-${Date.now()}`),
    signature_key: signature,
    fraud_status: 'accept',
  }
}

async function simulateOrder() {
  log('START', 'Simulasi order dimulai', {
    host: HOST,
    productCode: PRODUCT_CODE || '(auto)',
    qty: QTY,
    simulateSettlement: SIMULATE_SETTLEMENT,
  })

  const product = await getProductByCode(PRODUCT_CODE)
  log('CHECKOUT', 'Produk dipilih untuk simulasi', {
    code: product.kode,
    productId: product.id,
    priceWeb: Number(product.harga_web || product.harga || 0),
  })

  const checkoutPayload = {
    items: [{ product, quantity: QTY }],
    customerName: 'Debug Simulator',
    customerEmail: TEST_EMAIL || 'debug.simulator@example.com',
    customerPhone: '081234567890',
  }

  const checkoutRes = await fetchJson(`${HOST}/api/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(checkoutPayload),
  })

  if (!checkoutRes.ok) {
    throw new Error(`Checkout gagal (${checkoutRes.status}): ${JSON.stringify(checkoutRes.body)}`)
  }

  const checkout = checkoutRes.body
  log('CHECKOUT', 'Order dummy berhasil dibuat', {
    orderId: checkout.orderId,
    transactionId: checkout.transactionId,
    amount: checkout.amount,
  })

  if (SIMULATE_SETTLEMENT) {
    const settlementPayload = buildSettlementPayload(checkout)
    log('PAYMENT', 'Mengirim simulasi webhook settlement', {
      orderId: settlementPayload.order_id,
      grossAmount: settlementPayload.gross_amount,
    })

    const webhookRes = await fetchJson(`${HOST}/api/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settlementPayload),
    })

    log('PAYMENT', 'Webhook settlement response', {
      status: webhookRes.status,
      ok: webhookRes.ok,
      body: JSON.stringify(webhookRes.body).slice(0, 320),
    })
  }

  await new Promise((resolve) => setTimeout(resolve, 900))

  const orderRes = await fetchJson(`${HOST}/api/orders/${encodeURIComponent(checkout.orderId)}`)
  log('CHECKOUT', 'Order status setelah simulasi', {
    orderId: checkout.orderId,
    statusHttp: orderRes.status,
    orderStatus: orderRes.body?.status || '-',
    itemsReady: orderRes.body?.itemsReady,
  })

  const emailTarget = normalizeEmail(TEST_EMAIL || checkoutPayload.customerEmail)
  if (!emailTarget) {
    log('EMAIL', 'Lewati test email karena target email tidak tersedia', {})
  } else {
    log('EMAIL', 'Memanggil endpoint test email', { target: emailTarget })

    const testEmailRes = await fetchJson(`${HOST}/api/test-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: emailTarget,
        subject: `SimulateOrder Test ${checkout.orderId}`,
        text: `Test email dari simulateOrder untuk order ${checkout.orderId}`,
      }),
    })

    log('EMAIL', 'Hasil endpoint test email', {
      statusHttp: testEmailRes.status,
      smtpConnection: testEmailRes.body?.smtp_connection,
      emailSendStatus: testEmailRes.body?.email_send_status,
      error: testEmailRes.body?.error_message || '-',
    })
  }

  log('DONE', 'Simulasi order selesai', {
    orderId: checkout.orderId,
    checkoutStatus: orderRes.body?.status || '-',
  })

  return {
    orderId: checkout.orderId,
    checkout,
    orderStatus: orderRes.body?.status || null,
  }
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

if (require.main === module) {
  simulateOrder()
    .then((result) => {
      log('RESULT', 'simulateOrder berhasil', { orderId: result.orderId, status: result.orderStatus || '-' })
      process.exit(0)
    })
    .catch((error) => {
      log('ERROR', 'simulateOrder gagal', {
        error: String(error?.message || error),
      })
      if (error?.stack) {
        console.error(error.stack)
      }
      process.exit(1)
    })
}

module.exports = {
  simulateOrder,
}

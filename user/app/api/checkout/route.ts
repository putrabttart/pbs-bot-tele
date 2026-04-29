import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveBotPrice, resolveWebPrice } from '@/lib/pricing'
import { logError, logInfo, logWarn, summarizeOrderForLog } from '@/lib/logging/terminal-log'
import { getSessionUser } from '@/lib/auth'

const midtransClient = require('midtrans-client')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServerKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  ''

// ✅ SERVER-SIDE Supabase client (pakai SERVICE ROLE, bukan ANON)
const supabase = createClient(
  supabaseUrl,
  supabaseServerKey
)

// Rate limiting constants
const RATE_LIMIT_REQUESTS_PER_IP = 3
const RATE_LIMIT_WINDOW_IP = 10 * 60 * 1000 // 10 minutes
const RATE_LIMIT_PENDING_ORDERS_PER_EMAIL = 2
const RATE_LIMIT_PENDING_ORDERS_PER_PHONE = 2
const RATE_LIMIT_PENDING_ORDERS_PER_IP = 2
const RATE_LIMIT_WINDOW_ORDERS = 30 * 60 * 1000 // 30 minutes

// CAPTCHA configuration
const HCAPTCHA_SECRET = process.env.HCAPTCHA_SECRET_KEY || ''
const HCAPTCHA_VERIFY_URL = 'https://hcaptcha.com/siteverify'
const IS_PRODUCTION = process.env.NODE_ENV === 'production'

// Bot user agents to block
const BOT_USER_AGENTS = [
  'python-requests',
  'curl',
  'wget',
  'postman',
  'insomnia',
  'httpie',
  // Note: empty string removed to avoid false positives
]

async function verifyCaptcha(token: string): Promise<{ success: boolean; score?: number; error?: string }> {
  if (!HCAPTCHA_SECRET) {
    if (IS_PRODUCTION) {
      logError('CAPTCHA', 'HCaptcha secret not configured in production')
      return { success: false, error: 'CAPTCHA configuration error' }
    }
    logWarn('CAPTCHA', 'HCaptcha secret not configured, skipping verification in dev mode')
    return { success: true } // Allow in dev mode only
  }

  if (!token || token.trim() === '') {
    return { success: false, error: 'CAPTCHA token missing' }
  }

  try {
    const response = await fetch(HCAPTCHA_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: HCAPTCHA_SECRET,
        response: token,
      }),
    })

    const result = await response.json()
    return {
      success: result.success,
      score: result.score,
      error: result['error-codes']?.join(', '),
    }
  } catch (error: any) {
    logError('CAPTCHA', 'Failed to verify captcha', { error: error.message })
    return { success: false, error: 'Verification failed' }
  }
}

function normalizeIp(ip: string): string {
  try {
    // Handle IPv6 by taking /64 prefix
    if (ip.includes(':')) {
      const parts = ip.split(':')
      // Take first 4 segments (64 bits)
      return parts.slice(0, 4).join(':') + '::/64'
    }
    return ip
  } catch {
    return ip
  }
}

function isBotUserAgent(userAgent: string): boolean {
  const ua = (userAgent || '').toLowerCase().trim()

  // Check for empty or null UA
  if (!ua || ua === 'null' || ua === 'undefined') {
    return true
  }

  return BOT_USER_AGENTS.some(botUa => ua.includes(botUa.toLowerCase()))
}

async function checkAndUpdateRateLimits(normalizedIp: string, email: string, phone: string): Promise<{ allowed: boolean; reason?: string }> {
  try {
    // Fallback: check pending orders directly (more reliable than RPC)
    // This avoids issues with missing columns or RPC function errors
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_ORDERS).toISOString()

    // Check pending orders by email
    const { count: emailPending } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('customer_email', email)
      .eq('status', 'pending')
      .gte('created_at', windowStart)

    if ((emailPending || 0) >= RATE_LIMIT_PENDING_ORDERS_PER_EMAIL) {
      return { allowed: false, reason: 'Terlalu banyak order pending untuk email ini. Selesaikan pembayaran sebelumnya atau tunggu 30 menit.' }
    }

    // Check pending orders by phone
    const { count: phonePending } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('customer_phone', phone)
      .eq('status', 'pending')
      .gte('created_at', windowStart)

    if ((phonePending || 0) >= RATE_LIMIT_PENDING_ORDERS_PER_PHONE) {
      return { allowed: false, reason: 'Terlalu banyak order pending untuk nomor telepon ini. Selesaikan pembayaran sebelumnya atau tunggu 30 menit.' }
    }

    // Check IP-based rate limit via rate_limits table (if exists)
    try {
      const ipWindowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_IP).toISOString()
      const { data: rateLimitRow } = await supabase
        .from('rate_limits')
        .select('request_count')
        .eq('ip', normalizedIp)
        .gte('window_start', ipWindowStart)
        .order('window_start', { ascending: false })
        .limit(1)
        .single()

      if (rateLimitRow && rateLimitRow.request_count >= RATE_LIMIT_REQUESTS_PER_IP) {
        return { allowed: false, reason: 'Terlalu banyak request dari IP ini. Coba lagi dalam 10 menit.' }
      }
    } catch {
      // rate_limits table might not exist or query failed — skip IP check
    }

    // Update IP rate counter
    try {
      const now = new Date()
      const windowKey = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), Math.floor(now.getMinutes() / 10) * 10).toISOString()

      await supabase
        .from('rate_limits')
        .upsert({
          ip: normalizedIp,
          request_count: 1,
          window_start: windowKey,
          updated_at: now.toISOString(),
        }, { onConflict: 'ip,window_start' })
        .select()
      // If upsert fails (e.g. table doesn't exist), we just skip — not critical
    } catch {
      // Non-critical — IP rate tracking failed, but checkout should still proceed
    }

    return { allowed: true }
  } catch (error: any) {
    // CRITICAL FIX: If rate limit check itself fails, ALLOW the request
    // rather than blocking legitimate customers
    logError('RATE_LIMIT', 'Rate limit check failed, allowing request as fallback', { error: error.message })
    return { allowed: true }
  }
}

async function logAbuse(request: NextRequest, captchaResult: { success: boolean; score?: number; error?: string }, source: string = 'checkout') {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               request.headers.get('x-real-ip') ||
               '127.0.0.1'

    await supabase
      .from('abuse_logs')
      .insert({
        ip,
        user_agent: request.headers.get('user-agent'),
        referer: request.headers.get('referer'),
        origin: request.headers.get('origin'),
        captcha_score: captchaResult.score,
        captcha_result: captchaResult.success ? 'success' : (captchaResult.error || 'failed'),
        source,
      })
  } catch (error: any) {
    logWarn('ABUSE_LOG', 'Failed to log abuse', { error: error.message })
  }
}

type ServerCheckoutItem = {
  product: {
    id: string
    kode: string
    nama: string
    harga_web: number
    harga_bot: number
    price: number
    stok: number
  }
  quantity: number
}

type InvalidCheckoutItem = {
  error: string
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

function normalizeCustomerEmail(email: string) {
  return String(email || '').trim().toLowerCase()
}

function isValidCustomerEmail(email: string) {
  const normalized = normalizeCustomerEmail(email)
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalized)
}

function parseAdminIds(raw: string | undefined): string[] {
  return String(raw || '')
    .split(/[\s,;]+/)
    .map((id) => id.replace(/['"]/g, '').trim())
    .filter(Boolean)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function sendTelegramToAdmins(text: string, context: string) {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim()
  const adminIds = parseAdminIds(process.env.TELEGRAM_ADMIN_IDS)

  if (!token || adminIds.length === 0) {
    logWarn(context, 'Telegram env missing', {
      hasToken: Boolean(token),
      adminCount: adminIds.length,
    })
    return
  }

  await Promise.all(
    adminIds.map(async (chatId) => {
      let lastError = ''

      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text,
              disable_web_page_preview: true,
            }),
          })

          if (resp.ok) {
            if (attempt > 1) {
              logInfo(context, 'Telegram send recovered', { chatId, attempt })
            }
            return
          }

          const body = await resp.text()
          lastError = `HTTP ${resp.status}: ${body.slice(0, 300)}`

          // Retry only for transient failures.
          if ((resp.status === 429 || resp.status >= 500) && attempt < 3) {
            await sleep(300 * attempt)
            continue
          }

          break
        } catch (err: any) {
          lastError = String(err?.message || err)

          if (attempt < 3) {
            await sleep(300 * attempt)
            continue
          }
        }
      }

      logError(context, 'Telegram send failed', {
        chatId,
        error: lastError || 'unknown_error',
      })
    })
  )
}

async function sendNewOrderAdminNotification(payload: {
  source: 'website'
  orderId: string
  customerName: string
  customerEmail: string
  customerPhone: string
  totalAmount: number
  items: any[]
}) {
  try {
    const itemLines = payload.items
      .map((it: any) => `- ${it?.product?.nama || it?.product_name || it?.product?.kode || '-'} x${it?.quantity || 1}`)
      .join('\n')

    const text = [
      '🆕 ORDER BARU MASUK',
      '',
      `Sumber: ${payload.source.toUpperCase()}`,
      `Order ID: ${payload.orderId}`,
      `Customer: ${payload.customerName}`,
      `Email: ${payload.customerEmail}`,
      `Phone: ${payload.customerPhone}`,
      `Total: ${formatCurrency(payload.totalAmount)}`,
      `Status: pending`,
      '',
      'Items:',
      itemLines || '-',
    ].join('\n')

    await sendTelegramToAdmins(text, 'CHECKOUT:new-order')
  } catch (err: any) {
    logWarn('CHECKOUT', 'Failed sending admin order notification', {
      error: String(err?.message || err),
    })
  }
}

async function sendWebsiteOrderEventNotification(payload: {
  title: string
  orderId: string
  customerName?: string
  customerPhone?: string
  totalAmount?: number
  status?: string
  reason?: string
  details?: string
}) {
  try {
    const text = [
      payload.title,
      '',
      'Sumber: WEBSITE',
      `Order ID: ${payload.orderId}`,
      payload.customerName ? `Customer: ${payload.customerName}` : null,
      payload.customerPhone ? `Phone: ${payload.customerPhone}` : null,
      payload.totalAmount !== undefined ? `Total: ${formatCurrency(payload.totalAmount)}` : null,
      payload.status ? `Status: ${payload.status}` : null,
      payload.reason ? `Reason: ${payload.reason}` : null,
      payload.details ? `Detail: ${payload.details}` : null,
    ]
      .filter(Boolean)
      .join('\n')

    await sendTelegramToAdmins(text, 'CHECKOUT:event')
  } catch (err: any) {
    logWarn('CHECKOUT', 'Failed sending website admin event notification', {
      error: String(err?.message || err),
    })
  }
}

async function releaseReservedItemsForOrder(orderId: string) {
  try {
    const { data: releaseResult, error: releaseError } = await supabase
      .rpc('release_reserved_items', {
        p_order_id: orderId,
      })

    if (releaseError) {
      logWarn('CHECKOUT', 'Failed releasing reserved items', {
        orderId,
        message: releaseError.message,
      })
      return
    }

    logInfo('CHECKOUT', 'Released reserved items', {
      orderId,
      result: releaseResult,
    })
  } catch (err: any) {
    logWarn('CHECKOUT', 'Exception while releasing reserved items', {
      orderId,
      error: err?.message || err,
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    // 0. Check if user is logged in (optional - for linking order to account)
    const sessionUser = await getSessionUser(request)

    // 1. Parse body
    const body = await request.json()
    const { items: rawItems, customerName, customerEmail, customerPhone, captchaToken } = body
    const normalizedCustomerName = String(customerName || '').trim()
    const normalizedCustomerEmail = normalizeCustomerEmail(customerEmail)
    const normalizedCustomerPhone = String(customerPhone || '').trim()

    // Get client metadata
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     request.headers.get('x-real-ip') ||
                     '127.0.0.1'
    const normalizedIp = normalizeIp(clientIp)
    const userAgent = request.headers.get('user-agent') || ''

    // 2. Block bot user agents
    if (isBotUserAgent(userAgent)) {
      await logAbuse(request, { success: false, error: 'bot_user_agent' }, 'bot_block')
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // 3. Basic validation
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return NextResponse.json({ error: 'Keranjang kosong' }, { status: 400 })
    }

    if (!normalizedCustomerName || !normalizedCustomerEmail || !normalizedCustomerPhone) {
      return NextResponse.json({ error: 'Data pelanggan tidak lengkap' }, { status: 400 })
    }

    if (!isValidCustomerEmail(normalizedCustomerEmail)) {
      return NextResponse.json(
        { error: 'Email tidak valid. Gunakan email aktif yang benar.' },
        { status: 400 }
      )
    }

    // 4. CAPTCHA verification
    const captchaResult = await verifyCaptcha(captchaToken || '')
    if (!captchaResult.success) {
      await logAbuse(request, captchaResult, 'checkout')
      return NextResponse.json(
        { error: 'Verifikasi CAPTCHA gagal. Silakan coba lagi.' },
        { status: 400 }
      )
    }

    // 5. Rate limit checks (atomic)
    const rateLimitCheck = await checkAndUpdateRateLimits(normalizedIp, normalizedCustomerEmail, normalizedCustomerPhone)
    if (!rateLimitCheck.allowed) {
      await logAbuse(request, captchaResult, 'rate_limit')
      return NextResponse.json(
        { error: rateLimitCheck.reason || 'Rate limit exceeded' },
        { status: 429 }
      )
    }

    // Validate Supabase env (server-only)
    if (!supabaseUrl || !supabaseServerKey) {
      logError('CHECKOUT', 'Supabase env not configured (URL / SERVICE_ROLE_KEY missing)')
      return NextResponse.json(
        { error: 'Server belum dikonfigurasi (Supabase)' },
        { status: 500 }
      )
    }

    // Normalize and validate payload shape from client.
    const normalizedItems = rawItems.map((item: any) => ({
      productId: String(item?.product?.id || '').trim(),
      quantity: Number(item?.quantity || 0),
    }))

    if (normalizedItems.some((item: any) => !item.productId || !Number.isInteger(item.quantity) || item.quantity <= 0)) {
      return NextResponse.json({ error: 'Format item tidak valid' }, { status: 400 })
    }

    const requestedByProductId = new Map<string, number>()
    for (const item of normalizedItems) {
      requestedByProductId.set(item.productId, (requestedByProductId.get(item.productId) || 0) + item.quantity)
    }

    const productIds = Array.from(requestedByProductId.keys())

    const { data: dbProducts, error: productError } = await supabase
      .from('products')
      .select('id, kode, nama, harga_web, harga_bot, stok, aktif')
      .in('id', productIds)

    if (productError) {
      logError('CHECKOUT', 'Failed to load products', {
        error: productError.message,
        code: productError.code,
      })
      return NextResponse.json({ error: 'Gagal memvalidasi produk' }, { status: 500 })
    }

    const productById = new Map<string, any>()
    for (const product of dbProducts || []) {
      productById.set(String(product.id), product)
    }

    const itemCountsByProductId = new Map<string, { available: number; total: number }>()
    if (productIds.length > 0) {
      const { data: inventoryRows, error: inventoryError } = await supabase
        .from('product_inventory_summary')
        .select('product_id, available_items, total_items')
        .in('product_id', productIds)

      if (inventoryError) {
        logError('CHECKOUT', 'Failed to load product_items for stock validation', {
          error: inventoryError.message,
          code: inventoryError.code,
        })
        return NextResponse.json({ error: 'Gagal memvalidasi stok produk' }, { status: 500 })
      }

      for (const row of inventoryRows || []) {
        const key = String(row?.product_id || '').trim()
        if (!key) continue

        itemCountsByProductId.set(key, {
          available: Number(row?.available_items || 0),
          total: Number(row?.total_items || 0),
        })
      }
    }

    const serverItemCandidates: Array<ServerCheckoutItem | InvalidCheckoutItem> = Array.from(requestedByProductId.entries()).map(([productId, quantity]) => {
      const product = productById.get(productId)
      if (!product) {
        return { error: `Produk tidak ditemukan: ${productId}` }
      }
      if (product.aktif === false) {
        return { error: `Produk tidak aktif: ${product.nama || productId}` }
      }

      const itemCounts = itemCountsByProductId.get(productId)
      const totalItems = itemCounts?.total || 0
      const availableItems = itemCounts?.available || 0
      const effectiveStock = totalItems > 0 ? availableItems : Number(product.stok || 0)

      if (effectiveStock < quantity) {
        return { error: `Stok tidak cukup untuk produk: ${product.nama || productId}` }
      }

      const webPrice = resolveWebPrice(product)
      const botPrice = resolveBotPrice(product)

      return {
        product: {
          id: product.id,
          kode: product.kode,
          nama: product.nama,
          harga_web: webPrice,
          harga_bot: botPrice,
          price: webPrice,
          stok: effectiveStock,
        },
        quantity,
      }
    })

    const invalidItem = serverItemCandidates.find((item): item is InvalidCheckoutItem => 'error' in item)
    if (invalidItem) {
      return NextResponse.json({ error: invalidItem.error }, { status: 400 })
    }

    const serverItems: ServerCheckoutItem[] = serverItemCandidates.filter(
      (item): item is ServerCheckoutItem => !('error' in item)
    )

    // IMPORTANT: total must be calculated from database-backed prices, never from client payload.
    const totalAmount = serverItems.reduce(
      (sum: number, item: any) => sum + item.product.price * item.quantity,
      0
    )

    // Create unique order ID
    const orderId = `PBS-${Date.now()}`

    // Midtrans credentials
    const serverKey = process.env.MIDTRANS_SERVER_KEY
    const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY

    // Kalau belum set Midtrans key, tetap seperti logika kamu: balik test token
    if (!serverKey || !clientKey) {
      logError('CHECKOUT', 'Midtrans credentials not configured')
      return NextResponse.json({
        success: true,
        orderId: orderId,
        snapToken: `test-token-${Date.now()}`,
        redirectUrl: `/demo-payment?orderId=${orderId}`,
        testMode: true,
      })
    }

    // Initialize Midtrans Snap (tidak dipakai untuk QRIS direct charge, tapi kamu sudah ada)
    const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true'

    logInfo('CHECKOUT', 'Midtrans config', {
      isProduction,
      serverKey: serverKey ? '***[set]' : '***[NOT SET]',
      clientKey: clientKey ? '***[set]' : '***[NOT SET]',
    })

    const snap = new midtransClient.Snap({
      isProduction,
      serverKey,
      clientKey,
    })
    void snap // biar tidak warning “unused” kalau kamu tidak pakai

    // ✅ Direct QRIS charge via Core API
    const auth = Buffer.from(String(serverKey) + ':').toString('base64')
    const apiBase = isProduction ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com'
    const apiUrl = `${apiBase}/v2/charge`

    const qrisPayload = {
      payment_type: 'qris',
      transaction_details: {
        order_id: orderId,
        gross_amount: totalAmount,
      },
      customer_details: {
        first_name: normalizedCustomerName,
        email: normalizedCustomerEmail,
        phone: normalizedCustomerPhone,
      },
    }

    logInfo('CHECKOUT', 'Creating direct QRIS transaction', {
      orderId,
      grossAmount: totalAmount,
      customerEmail: normalizedCustomerEmail,
      itemCount: serverItems.length,
    })

    // ✅ KUNCI SOLUSI: append notification hanya saat DEV
    // Isi env ini dengan URL ngrok kamu yang mengarah ke webhook web:
    // MIDTRANS_DEV_WEBHOOK_URL="https://xxxx.ngrok-free.app/api/webhook"
    const isDev = process.env.NODE_ENV !== 'production'
    const devWebhook = process.env.MIDTRANS_DEV_WEBHOOK_URL

    const qrisResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        Authorization: `Basic ${auth}`,

        // ✅ Tidak mengganggu Notification URL dashboard (bot tetap terima)
        ...(isDev && devWebhook ? { 'X-Append-Notification': devWebhook } : {}),
      },
      body: JSON.stringify(qrisPayload),
    })

    const qrisText = await qrisResponse.text()
    logInfo('CHECKOUT', 'QRIS response received', {
      orderId,
      status: qrisResponse.status,
      bodyPreview: qrisText.slice(0, 240),
    })

    if (!qrisResponse.ok) {
      throw new Error(`QRIS charge error: ${qrisResponse.status} - ${qrisText}`)
    }

    const transaction = JSON.parse(qrisText)
    logInfo('CHECKOUT', 'QRIS transaction created', {
      orderId,
      transactionId: transaction.transaction_id,
      transactionStatus: transaction.transaction_status,
    })

    // Extract QR code URL from actions array
    const qrCodeAction = transaction.actions?.find((action: any) => action.name === 'generate-qr-code')
    const qrCodeUrl = qrCodeAction?.url || `${apiBase}/v2/qris/${transaction.transaction_id}/qr-code`

    // ========================================
    // RESERVE PRODUCT ITEMS FROM DATABASE
    // ========================================
    logInfo('CHECKOUT', 'Reserving product items from product_items table', {
      orderId,
      itemCount: serverItems.length,
      items: serverItems.map((i: any) => ({
        product_code: i.product.kode,
        quantity: i.quantity,
      })),
    })

    const reservationResults: Array<any> = []

    for (const item of serverItems) {
      try {
        const { data: reserveResult, error: reserveError } = await supabase.rpc('reserve_items_for_order', {
          p_order_id: orderId,
          p_product_code: item.product.kode,
          p_quantity: item.quantity,
        })

        if (reserveError) {
          logError('CHECKOUT', 'Reserve failed for product', {
            orderId,
            productCode: item.product.kode,
            error: reserveError.message,
          })
          reservationResults.push({
            product_code: item.product.kode,
            success: false,
            error: reserveError.message,
          })
        } else if (reserveResult && reserveResult.ok) {
          logInfo('CHECKOUT', 'Reserved product items', {
            orderId,
            productCode: item.product.kode,
            count: reserveResult.count,
          })
          reservationResults.push({
            product_code: item.product.kode,
            success: true,
            count: reserveResult.count,
          })
        } else {
          logWarn('CHECKOUT', 'Reserve returned non-ok response', {
            orderId,
            productCode: item.product.kode,
            response: reserveResult,
          })
          reservationResults.push({
            product_code: item.product.kode,
            success: false,
            error: reserveResult?.msg || 'unknown_error',
          })
        }
      } catch (err: any) {
        logError('CHECKOUT', 'Exception reserving product items', {
          orderId,
          productCode: item.product.kode,
          error: err.message,
        })
        reservationResults.push({
          product_code: item.product.kode,
          success: false,
          error: err.message,
        })
      }
    }

    // Check if all reservations successful
    const allReserved = reservationResults.every((r) => r.success)
    if (!allReserved) {
      logError('CHECKOUT', 'Some items could not be reserved', {
        orderId,
        reservationResults,
      })
      await sendWebsiteOrderEventNotification({
        title: '⚠️ RESERVE STOCK GAGAL',
        orderId,
        customerName: normalizedCustomerName,
        customerPhone: normalizedCustomerPhone,
        totalAmount,
        status: 'reserve_failed',
        reason: 'some_items_not_reserved',
        details: JSON.stringify(reservationResults),
      })
      await releaseReservedItemsForOrder(orderId)
      return NextResponse.json(
        {
          error: 'Stok item digital tidak mencukupi. Silakan checkout ulang.',
          orderId,
        },
        { status: 409 }
      )
    } else {
      logInfo('CHECKOUT', 'All items successfully reserved', {
        orderId,
        count: reservationResults.length,
      })
    }

    // ========================================
    // SAVE ORDER TO DATABASE
    // ========================================
    try {
      const itemsArray = serverItems.map((item: any) => ({
        product_id: item.product.id,
        product_name: item.product.nama,
        product_code: item.product.kode,
        quantity: item.quantity,
        price: item.product.price,
      }))

      logInfo('CHECKOUT', 'Preparing order for database', {
        orderId,
        itemCount: itemsArray.length,
      })

      const { data: insertedOrder, error: insertError } = await supabase
        .from('orders')
        .insert({
          order_id: orderId,
          transaction_id: transaction.transaction_id,
          customer_name: normalizedCustomerName,
          customer_email: normalizedCustomerEmail,
          customer_phone: normalizedCustomerPhone,
          total_amount: totalAmount,
          status: 'pending',
          payment_method: 'qris',
          items: itemsArray,
          // user_id nullable untuk web (telegram bot users)
          // user_web_id links to registered web user account
          ...(sessionUser?.userId ? { user_web_id: sessionUser.userId } : {}),
        })
        .select()

      if (insertError) {
        logError('CHECKOUT', 'Insert order failed', {
          orderId,
          code: insertError.code,
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
        })
        await sendWebsiteOrderEventNotification({
          title: '⚠️ ORDER INSERT GAGAL',
          orderId,
          customerName: normalizedCustomerName,
          customerPhone: normalizedCustomerPhone,
          totalAmount,
          status: 'insert_failed',
          reason: insertError.message || 'insert_error',
        })
        await releaseReservedItemsForOrder(orderId)
        return NextResponse.json(
          {
            error: 'Pesanan gagal diproses di server. Silakan ulang checkout.',
            orderId,
          },
          { status: 500 }
        )
      } else if (insertedOrder && insertedOrder.length > 0) {
        logInfo('CHECKOUT', 'Order saved to database', {
          orderId,
          order: summarizeOrderForLog(insertedOrder[0]),
        })
      } else {
        logWarn('CHECKOUT', 'Insert returned no data (without error)', { orderId })
        await releaseReservedItemsForOrder(orderId)
        return NextResponse.json(
          {
            error: 'Pesanan gagal diproses di server. Silakan ulang checkout.',
            orderId,
          },
          { status: 500 }
        )
      }
    } catch (dbError: any) {
      logError('CHECKOUT', 'Database exception while saving order', {
        orderId,
        message: dbError.message,
        code: dbError.code,
      })
      await sendWebsiteOrderEventNotification({
        title: '⚠️ ORDER DATABASE EXCEPTION',
        orderId,
        customerName: normalizedCustomerName,
        customerPhone: normalizedCustomerPhone,
        totalAmount,
        status: 'db_exception',
        reason: dbError?.message || 'unknown_db_exception',
      })
      await releaseReservedItemsForOrder(orderId)
      return NextResponse.json(
        {
          error: 'Pesanan gagal diproses di server. Silakan ulang checkout.',
          orderId,
        },
        { status: 500 }
      )
    }

    // Return transaction details
    await sendNewOrderAdminNotification({
      source: 'website',
      orderId,
      customerName: normalizedCustomerName,
      customerEmail: normalizedCustomerEmail,
      customerPhone: normalizedCustomerPhone,
      totalAmount,
      items: serverItems,
    })

    return NextResponse.json({
      success: true,
      orderId,
      transactionId: transaction.transaction_id,
      qrString: transaction.qr_string,
      qrUrl: qrCodeUrl,
      transactionTime: transaction.transaction_time,
      transactionStatus: transaction.transaction_status,
      amount: totalAmount,
      merchantId: transaction.merchant_id,
      items: serverItems.map((item: any) => ({
        product_id: item.product.id,
        product_name: item.product.nama,
        product_code: item.product.kode,
        quantity: item.quantity,
        price: item.product.price,
        total: item.product.price * item.quantity,
      })),
    })
  } catch (error: any) {
    logError('CHECKOUT', 'Error creating transaction', {
      error: error?.message || String(error),
    })
    return NextResponse.json(
      { error: `Terjadi kesalahan: ${error.message || 'unknown error'}` },
      { status: 500 }
    )
  }
}

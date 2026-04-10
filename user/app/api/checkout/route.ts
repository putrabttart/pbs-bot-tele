import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveBotPrice, resolveWebPrice } from '@/lib/pricing'

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
    console.warn(`[${context}] Telegram env missing`, {
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
              console.log(`[${context}] Telegram send recovered`, { chatId, attempt })
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

      console.error(`[${context}] Telegram send failed`, {
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
    console.warn('[CHECKOUT] Failed sending admin order notification:', err?.message || err)
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
    console.warn('[CHECKOUT] Failed sending website admin event notification:', err?.message || err)
  }
}

async function releaseReservedItemsForOrder(orderId: string) {
  try {
    const { data: releaseResult, error: releaseError } = await supabase
      .rpc('release_reserved_items', {
        p_order_id: orderId,
      })

    if (releaseError) {
      console.warn('[CHECKOUT] Failed releasing reserved items:', {
        orderId,
        message: releaseError.message,
      })
      return
    }

    console.log('[CHECKOUT] Released reserved items:', {
      orderId,
      result: releaseResult,
    })
  } catch (err: any) {
    console.warn('[CHECKOUT] Exception while releasing reserved items:', {
      orderId,
      error: err?.message || err,
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { items: rawItems, customerName, customerEmail, customerPhone } = body
    const normalizedCustomerName = String(customerName || '').trim()
    const normalizedCustomerEmail = normalizeCustomerEmail(customerEmail)
    const normalizedCustomerPhone = String(customerPhone || '').trim()

    // Validate input
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

    // Validate Supabase env (server-only)
    if (!supabaseUrl || !supabaseServerKey) {
      console.error('[CHECKOUT] Supabase env not configured (URL / SERVICE_ROLE_KEY missing)')
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
      console.error('[CHECKOUT] Failed to load products:', productError)
      return NextResponse.json({ error: 'Gagal memvalidasi produk' }, { status: 500 })
    }

    const productById = new Map<string, any>()
    for (const product of dbProducts || []) {
      productById.set(String(product.id), product)
    }

    const serverItemCandidates: Array<ServerCheckoutItem | InvalidCheckoutItem> = Array.from(requestedByProductId.entries()).map(([productId, quantity]) => {
      const product = productById.get(productId)
      if (!product) {
        return { error: `Produk tidak ditemukan: ${productId}` }
      }
      if (product.aktif === false) {
        return { error: `Produk tidak aktif: ${product.nama || productId}` }
      }
      if (Number(product.stok || 0) < quantity) {
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
          stok: Number(product.stok || 0),
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
      console.error('[CHECKOUT] Midtrans credentials not configured')
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

    console.log('[CHECKOUT] Midtrans Config:', {
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

    console.log('[CHECKOUT] Creating Direct QRIS transaction:', JSON.stringify(qrisPayload, null, 2))

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
    console.log('[CHECKOUT] QRIS Response status:', qrisResponse.status)
    console.log('[CHECKOUT] QRIS Response:', qrisText.slice(0, 500))

    if (!qrisResponse.ok) {
      throw new Error(`QRIS charge error: ${qrisResponse.status} - ${qrisText}`)
    }

    const transaction = JSON.parse(qrisText)
    console.log('[CHECKOUT] QRIS transaction created:', transaction)

    // Extract QR code URL from actions array
    const qrCodeAction = transaction.actions?.find((action: any) => action.name === 'generate-qr-code')
    const qrCodeUrl = qrCodeAction?.url || `${apiBase}/v2/qris/${transaction.transaction_id}/qr-code`

    // ========================================
    // RESERVE PRODUCT ITEMS FROM DATABASE
    // ========================================
    console.log('[CHECKOUT] 🔄 Reserving product items from product_items table...')
    console.log(
      '[CHECKOUT] Items to reserve:',
      serverItems.map((i: any) => ({
        product_code: i.product.kode,
        quantity: i.quantity,
        name: i.product.nama,
      }))
    )

    const reservationResults: Array<any> = []

    for (const item of serverItems) {
      try {
        const { data: reserveResult, error: reserveError } = await supabase.rpc('reserve_items_for_order', {
          p_order_id: orderId,
          p_product_code: item.product.kode,
          p_quantity: item.quantity,
        })

        if (reserveError) {
          console.error(`[CHECKOUT] ❌ Reserve failed for ${item.product.kode}:`, reserveError.message)
          reservationResults.push({
            product_code: item.product.kode,
            success: false,
            error: reserveError.message,
          })
        } else if (reserveResult && reserveResult.ok) {
          console.log(`[CHECKOUT] ✅ Reserved ${reserveResult.count} items for ${item.product.kode}`)
          reservationResults.push({
            product_code: item.product.kode,
            success: true,
            count: reserveResult.count,
          })
        } else {
          console.warn(`[CHECKOUT] ⚠️ Reserve response for ${item.product.kode}:`, reserveResult)
          reservationResults.push({
            product_code: item.product.kode,
            success: false,
            error: reserveResult?.msg || 'unknown_error',
          })
        }
      } catch (err: any) {
        console.error(`[CHECKOUT] ❌ Exception reserving ${item.product.kode}:`, err.message)
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
      console.error('[CHECKOUT] ❌ Some items could not be reserved:', reservationResults)
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
      console.log('[CHECKOUT] ✅ All items successfully reserved')
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

      console.log('[CHECKOUT] 🔄 Preparing order for database...')
      console.log('[CHECKOUT] Order ID:', orderId)
      console.log('[CHECKOUT] Items count:', itemsArray.length)

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
          // user_id nullable untuk web
        })
        .select()

      if (insertError) {
        console.error('[CHECKOUT] ❌ INSERT order GAGAL:', {
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
        console.log('[CHECKOUT] ✅ Order BERHASIL disimpan ke database')
        console.log('[CHECKOUT] Order data:', JSON.stringify(insertedOrder[0], null, 2))
      } else {
        console.warn('[CHECKOUT] ⚠️ INSERT returned no data (but no error).')
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
      console.error('[CHECKOUT] ❌ Database exception:', {
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
    console.error('[CHECKOUT] Error creating transaction:', error)
    return NextResponse.json(
      { error: `Terjadi kesalahan: ${error.message || 'unknown error'}` },
      { status: 500 }
    )
  }
}

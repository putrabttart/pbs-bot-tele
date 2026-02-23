import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const midtransClient = require('midtrans-client')

// ✅ SERVER-SIDE Supabase client (pakai SERVICE ROLE, bukan ANON)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// ✅ RATE LIMITING: Prevent brute force
const requestLimits = new Map<string, Array<number>>()

function checkRateLimit(clientId: string, maxPerMinute: number = 5): boolean {
  const now = Date.now()
  const oneMinuteAgo = now - 60000

  if (!requestLimits.has(clientId)) {
    requestLimits.set(clientId, [now])
    return true
  }

  const times = requestLimits.get(clientId)!
  const recentRequests = times.filter(t => t > oneMinuteAgo)

  if (recentRequests.length >= maxPerMinute) {
    console.warn(`[RATE LIMIT] ${clientId} exceeded ${maxPerMinute}/min`)
    return false
  }

  recentRequests.push(now)
  requestLimits.set(clientId, recentRequests)
  return true
}

export async function POST(request: NextRequest) {
  const clientIp = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown'

  try {
    // ✅ STEP 0: Rate limiting
    if (!checkRateLimit(clientIp, 5)) {
      return NextResponse.json(
        { error: 'Terlalu banyak request. Coba lagi dalam 1 menit.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { items, customerName, customerEmail, customerPhone } = body

    console.log('[CHECKOUT] Received request from:', clientIp)
    console.log('[CHECKOUT] Items count:', items?.length || 0)

    // ✅ STEP 1: Validate input
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Keranjang kosong' }, { status: 400 })
    }

    if (!customerName || !customerEmail || !customerPhone) {
      return NextResponse.json({ error: 'Data pelanggan tidak lengkap' }, { status: 400 })
    }

    // ✅ Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(customerEmail)) {
      return NextResponse.json({ error: 'Email tidak valid' }, { status: 400 })
    }

    // ✅ STEP 2: Validate Supabase env
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[CHECKOUT] Supabase env not configured')
      return NextResponse.json(
        { error: 'Server belum dikonfigurasi' },
        { status: 500 }
      )
    }

    // ✅ STEP 3: CRITICAL FIX - FETCH PRODUCT PRICES FROM DATABASE ONLY
    // Do NOT trust client-provided prices!
    console.log('[CHECKOUT] 📊 Validating items against database...')

    let totalAmount = 0
    const validatedItems: any[] = []

    for (const item of items) {
      const productCode = item.product?.kode
      const clientQty = item.quantity

      if (!productCode || !Number.isInteger(clientQty) || clientQty <= 0) {
        console.error('[CHECKOUT] ❌ Invalid item format:', item)
        return NextResponse.json(
          { error: 'Format item tidak valid' },
          { status: 400 }
        )
      }

      // ✅ FETCH FROM DATABASE - this is the FIX!
      const { data: dbProduct, error: dbError } = await supabase
        .from('products')
        .select('id, kode, nama, harga, stok')
        .eq('kode', productCode)
        .single()

      if (dbError || !dbProduct) {
        console.error(`[CHECKOUT] ❌ Product not found in DB: ${productCode}`)
        return NextResponse.json(
          { error: `Produk ${productCode} tidak ditemukan` },
          { status: 404 }
        )
      }

      // ✅ VALIDATE STOCK
      if (dbProduct.stok < clientQty) {
        console.error(`[CHECKOUT] ❌ Insufficient stock for ${productCode}`)
        return NextResponse.json(
          { error: `Stock ${productCode} tidak cukup (tersedia: ${dbProduct.stok})` },
          { status: 400 }
        )
      }

      // ✅ Calculate total using DB price (NOT client price!)
      const itemTotal = dbProduct.harga * clientQty
      totalAmount += itemTotal

      validatedItems.push({
        product_id: dbProduct.id,
        product_code: dbProduct.kode,
        product_name: dbProduct.nama,
        price: dbProduct.harga,      // ← FROM DATABASE!
        quantity: clientQty,
        subtotal: itemTotal,
      })

      console.log(`[CHECKOUT] ✅ Validated ${productCode}: Rp${dbProduct.harga} × ${clientQty} = Rp${itemTotal}`)
    }

    if (validatedItems.length === 0) {
      return NextResponse.json({ error: 'Tidak ada item valid' }, { status: 400 })
    }

    // ✅ STEP 4: Create order record in database FIRST (before Midtrans)
    const orderId = `PBS-${Date.now()}-${Math.random().toString(36).substring(7)}`

    console.log('[CHECKOUT] 📝 Creating order record in database...')
    console.log('[CHECKOUT] Order ID:', orderId)
    console.log('[CHECKOUT] Total Amount (from DB):', totalAmount)

    try {
      const { data: orderRecord, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_id: orderId,
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone,
          total_amount: totalAmount,      // ← SAVE IN DB!
          status: 'pending',
          payment_method: 'qris',
          items: validatedItems,          // Store for reference
        })
        .select()

      if (orderError) {
        console.error('[CHECKOUT] ❌ Order creation failed:', orderError)
        return NextResponse.json(
          { error: 'Gagal membuat order' },
          { status: 500 }
        )
      }

      console.log('[CHECKOUT] ✅ Order created in DB')
    } catch (err: any) {
      console.error('[CHECKOUT] ❌ Order creation exception:', err.message)
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      )
    }

    // ✅ STEP 5: Create Midtrans transaction with serverside calculated amount
    const serverKey = process.env.MIDTRANS_SERVER_KEY
    const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true'

    if (!serverKey) {
      console.error('[CHECKOUT] Midtrans credentials not configured')
      return NextResponse.json({
        success: false,
        error: 'Payment gateway not configured',
      }, { status: 500 })
    }

    const auth = Buffer.from(String(serverKey) + ':').toString('base64')
    const apiBase = isProduction ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com'
    const apiUrl = `${apiBase}/v2/charge`

    // ✅ Critical: Use validated total from DB, never from client!
    const qrisPayload = {
      payment_type: 'qris',
      transaction_details: {
        order_id: orderId,
        gross_amount: totalAmount,  // ← FROM DB CALCULATION!
      },
      item_details: validatedItems.map(item => ({
        id: item.product_code,
        price: item.price,           // ← FROM DB!
        quantity: item.quantity,
        name: item.product_name,
      })),
      customer_details: {
        first_name: customerName,
        email: customerEmail,
        phone: customerPhone,
      },
    }

    console.log('[CHECKOUT] 💳 Creating QRIS transaction with Midtrans...')
    console.log('[CHECKOUT] Amount: Rp' + totalAmount)

    const isDev = process.env.NODE_ENV !== 'production'
    const devWebhook = process.env.MIDTRANS_DEV_WEBHOOK_URL

    const qrisResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        Authorization: `Basic ${auth}`,
        ...(isDev && devWebhook ? { 'X-Append-Notification': devWebhook } : {}),
      },
      body: JSON.stringify(qrisPayload),
    })

    const qrisText = await qrisResponse.text()

    if (!qrisResponse.ok) {
      console.error('[CHECKOUT] ❌ QRIS charge failed:', qrisText)
      return NextResponse.json(
        { error: `Gagal buat transaksi: ${qrisResponse.status}` },
        { status: 500 }
      )
    }

    const transaction = JSON.parse(qrisText)
    console.log('[CHECKOUT] ✅ QRIS transaction created:', {
      transaction_id: transaction.transaction_id,
      status: transaction.transaction_status,
      amount: transaction.gross_amount,
    })

    // ✅ STEP 6: Reserve items in database
    console.log('[CHECKOUT] 🔄 Reserving items from inventory...')

    const reservationResults: Array<any> = []
    for (const item of validatedItems) {
      try {
        const { data: reserveResult, error: reserveError } = await supabase.rpc(
          'reserve_items_for_order',
          {
            p_order_id: orderId,
            p_product_code: item.product_code,
            p_quantity: item.quantity,
          }
        )

        if (reserveError) {
          console.error(`[CHECKOUT] ❌ Reserve failed for ${item.product_code}:`, reserveError.message)
          reservationResults.push({
            product_code: item.product_code,
            success: false,
            error: reserveError.message,
          })
        } else if (reserveResult?.ok) {
          console.log(`[CHECKOUT] ✅ Reserved ${reserveResult.count} items for ${item.product_code}`)
          reservationResults.push({
            product_code: item.product_code,
            success: true,
            count: reserveResult.count,
          })
        }
      } catch (err: any) {
        console.error(`[CHECKOUT] ❌ Exception reserving ${item.product_code}:`, err.message)
      }
    }

    const allReserved = reservationResults.every((r) => r.success)
    if (!allReserved) {
      console.warn('[CHECKOUT] ⚠️ Some items could not be reserved')
    } else {
      console.log('[CHECKOUT] ✅ All items successfully reserved')
    }

    // ✅ STEP 7: Update order with transaction details
    try {
      await supabase
        .from('orders')
        .update({
          transaction_id: transaction.transaction_id,
          status: 'pending_payment',
        })
        .eq('order_id', orderId)
    } catch (err) {
      console.warn('[CHECKOUT] ⚠️ Could not update order with transaction_id')
    }

    // ✅ STEP 8: Return response WITHOUT QR strings in body
    // Frontend should fetch QR from server, NOT from response body
    console.log('[CHECKOUT] ✅ Returning response to frontend')

    return NextResponse.json({
      success: true,
      orderId,
      transactionId: transaction.transaction_id,
      // ❌ DO NOT return qrString or qrUrl!
      // Frontend should call /api/order/:id to get QR securely
      amount: totalAmount,
    }, { status: 200 })

  } catch (error: any) {
    console.error('[CHECKOUT] ❌ CRITICAL ERROR:', error.message)
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server' },
      { status: 500 }
    )
  }
}

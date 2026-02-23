import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const midtransClient = require('midtrans-client')

// ✅ SERVER-SIDE Supabase client (pakai SERVICE ROLE, bukan ANON)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { items, customerName, customerEmail, customerPhone } = body

    // Validate input
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Keranjang kosong' }, { status: 400 })
    }

    if (!customerName || !customerEmail || !customerPhone) {
      return NextResponse.json({ error: 'Data pelanggan tidak lengkap' }, { status: 400 })
    }

    // Validate Supabase env (server-only)
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[CHECKOUT] Supabase env not configured (URL / SERVICE_ROLE_KEY missing)')
      return NextResponse.json(
        { error: 'Server belum dikonfigurasi (Supabase)' },
        { status: 500 }
      )
    }

    // Calculate total
    const totalAmount = items.reduce(
      (sum: number, item: any) => sum + item.product.harga * item.quantity,
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
        first_name: customerName,
        email: customerEmail,
        phone: customerPhone,
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
      items.map((i: any) => ({
        product_code: i.product.kode,
        quantity: i.quantity,
        name: i.product.nama,
      }))
    )

    const reservationResults: Array<any> = []

    for (const item of items) {
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
      // Logika kamu: continue anyway
    } else {
      console.log('[CHECKOUT] ✅ All items successfully reserved')
    }

    // ========================================
    // SAVE ORDER TO DATABASE
    // ========================================
    try {
      const itemsArray = items.map((item: any) => ({
        product_id: item.product.id,
        product_name: item.product.nama,
        product_code: item.product.kode,
        quantity: item.quantity,
        price: item.product.harga,
      }))

      console.log('[CHECKOUT] 🔄 Preparing order for database...')
      console.log('[CHECKOUT] Order ID:', orderId)
      console.log('[CHECKOUT] Items count:', itemsArray.length)

      const { data: insertedOrder, error: insertError } = await supabase
        .from('orders')
        .insert({
          order_id: orderId,
          transaction_id: transaction.transaction_id,
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone,
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
        console.warn('[CHECKOUT] ⚠️ Order not saved to DB, but QRIS transaction created. Will try to save via webhook.')
      } else if (insertedOrder && insertedOrder.length > 0) {
        console.log('[CHECKOUT] ✅ Order BERHASIL disimpan ke database')
        console.log('[CHECKOUT] Order data:', JSON.stringify(insertedOrder[0], null, 2))
      } else {
        console.warn('[CHECKOUT] ⚠️ INSERT returned no data (but no error).')
      }
    } catch (dbError: any) {
      console.error('[CHECKOUT] ❌ Database exception:', {
        message: dbError.message,
        code: dbError.code,
      })
      // continue
    }

    // Return transaction details
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
      items: items.map((item: any) => ({
        product_id: item.product.id,
        product_name: item.product.nama,
        product_code: item.product.kode,
        quantity: item.quantity,
        price: item.product.harga,
        total: item.product.harga * item.quantity,
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

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const midtransClient = require('midtrans-client')

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { items, customerName, customerEmail, customerPhone } = body

    // Validate input
    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'Keranjang kosong' },
        { status: 400 }
      )
    }

    if (!customerName || !customerEmail || !customerPhone) {
      return NextResponse.json(
        { error: 'Data pelanggan tidak lengkap' },
        { status: 400 }
      )
    }

    // Calculate total
    const totalAmount = items.reduce(
      (sum: number, item: any) => sum + item.product.harga * item.quantity,
      0
    )

    // Create unique order ID
    const orderId = `PBS-${Date.now()}`

    // Check if Midtrans credentials are properly configured
    const serverKey = process.env.MIDTRANS_SERVER_KEY
    const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY

    if (!serverKey || !clientKey) {
      console.error('Midtrans credentials not configured')
      // Return test token for demo purposes
      return NextResponse.json({
        success: true,
        orderId: orderId,
        snapToken: `test-token-${Date.now()}`,
        redirectUrl: `/demo-payment?orderId=${orderId}`,
        testMode: true,
      })
    }

    // Initialize Midtrans Snap
    const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true'
    
    console.log('Midtrans Config:', {
      isProduction: isProduction,
      serverKey: serverKey ? '***[set]' : '***[NOT SET]',
      clientKey: clientKey ? '***[set]' : '***[NOT SET]',
    })

    const snap = new midtransClient.Snap({
      isProduction: isProduction,
      serverKey: serverKey,
      clientKey: clientKey,
    })

    // Use Direct QRIS Charge API instead of Snap (same as bot implementation)
    // This ensures QRIS payment works even if merchant doesn't support Snap QRIS
    
    const auth = Buffer.from(String(serverKey) + ':').toString('base64')
    const apiBase = isProduction
      ? 'https://api.midtrans.com'
      : 'https://api.sandbox.midtrans.com'
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

    console.log('Creating Direct QRIS transaction:', JSON.stringify(qrisPayload, null, 2))

    const qrisResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'accept': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: JSON.stringify(qrisPayload),
    })

    const qrisText = await qrisResponse.text()
    console.log('QRIS Response status:', qrisResponse.status)
    console.log('QRIS Response:', qrisText.slice(0, 500))

    if (!qrisResponse.ok) {
      throw new Error(`QRIS charge error: ${qrisResponse.status} - ${qrisText}`)
    }

    const transaction = JSON.parse(qrisText)

    console.log('QRIS transaction created:', transaction)

    // Extract QR code URL from actions array
    const qrCodeAction = transaction.actions?.find((action: any) => action.name === 'generate-qr-code')
    const qrCodeUrl = qrCodeAction?.url || `${apiBase}/v2/qris/${transaction.transaction_id}/qr-code`

    // ========================================
    // RESERVE PRODUCT ITEMS FROM DATABASE
    // ========================================
    console.log('[CHECKOUT] 🔄 Reserving product items from product_items table...')
    console.log('[CHECKOUT] Items to reserve:', items.map((i: any) => ({ 
      product_code: i.product.kode, 
      quantity: i.quantity,
      name: i.product.nama 
    })))
    
    const reservationResults = []
    for (const item of items) {
      try {
        const { data: reserveResult, error: reserveError } = await supabase
          .rpc('reserve_items_for_order', {
            p_order_id: orderId,
            p_product_code: item.product.kode,
            p_quantity: item.quantity
          })

        if (reserveError) {
          console.error(`[CHECKOUT] ❌ Reserve failed for ${item.product.kode}:`, reserveError.message)
          reservationResults.push({ 
            product_code: item.product.kode, 
            success: false, 
            error: reserveError.message 
          })
        } else if (reserveResult && reserveResult.ok) {
          console.log(`[CHECKOUT] ✅ Reserved ${reserveResult.count} items for ${item.product.kode}`)
          reservationResults.push({ 
            product_code: item.product.kode, 
            success: true, 
            count: reserveResult.count 
          })
        } else {
          console.warn(`[CHECKOUT] ⚠️ Reserve response for ${item.product.kode}:`, reserveResult)
          reservationResults.push({ 
            product_code: item.product.kode, 
            success: false, 
            error: reserveResult?.msg || 'unknown_error' 
          })
        }
      } catch (err: any) {
        console.error(`[CHECKOUT] ❌ Exception reserving ${item.product.kode}:`, err.message)
        reservationResults.push({ 
          product_code: item.product.kode, 
          success: false, 
          error: err.message 
        })
      }
    }

    // Check if all reservations successful
    const allReserved = reservationResults.every(r => r.success)
    if (!allReserved) {
      console.error('[CHECKOUT] ❌ Some items could not be reserved:', reservationResults)
      // Continue anyway - admin can manually fulfill
    } else {
      console.log('[CHECKOUT] ✅ All items successfully reserved')
    }

    // Save order to database
    // Menggunakan OPSI B: schema web store sendiri (orders.items JSONB)
    try {
      // Prepare items array exactly as needed
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
      
      // Step 1: Insert order (tanpa user_id karena web users bukan dari Telegram)
      // user_id dibuat nullable di migration 007, jadi OK untuk NULL
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
          // user_id: null,  // Web users tidak punya user_id dari Telegram
          // paid_at: null,  // Will be set when webhook confirms payment
        })
        .select()

      if (insertError) {
        console.error('[CHECKOUT] ❌ INSERT order GAGAL:', {
          code: insertError.code,
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
        })
        // Continue anyway - transaction sudah dibuat di Midtrans
        console.warn('[CHECKOUT] ⚠️ Order not saved to DB, but QRIS transaction created. Will try to save via webhook.')
      } else if (insertedOrder && insertedOrder.length > 0) {
        console.log('[CHECKOUT] ✅ Order BERHASIL disimpan ke database')
        console.log('[CHECKOUT] Order data:', JSON.stringify(insertedOrder[0], null, 2))
      } else {
        console.warn('[CHECKOUT] ⚠️ INSERT returned no data (but no error). Hmm.')
      }
    } catch (dbError: any) {
      console.error('[CHECKOUT] ❌ Database exception:', {
        message: dbError.message,
        code: dbError.code,
      })
      // Continue - payment transaction already created
    }

    // Direct QRIS Charge returns qr_string and qr_url
    // For now, we'll return the transaction details
    // Client needs to handle QRIS response differently
    return NextResponse.json({
      success: true,
      orderId: orderId,
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
    console.error('Error creating transaction:', error)
    return NextResponse.json(
      { error: `Terjadi kesalahan: ${error.message || 'unknown error'}` },
      { status: 500 }
    )
  }
}

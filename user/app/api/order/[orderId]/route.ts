import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ✅ SERVER-SIDE Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const orderId = params.orderId

  try {
    console.log('[ORDER API] Fetching order:', orderId)

    // ✅ Fetch order from database
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('order_id', orderId)
      .single()

    if (orderError || !order) {
      console.error('[ORDER API] ❌ Order not found:', orderId, orderError?.message)
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    console.log('[ORDER API] ✅ Order found:', orderId)
    console.log('[ORDER API] Status:', order.status)

    // ✅ ONLY return QR if order is still pending
    let qrData = null
    if (order.status === 'pending' || order.status === 'pending_payment') {
      console.log('[ORDER API] 📊 Fetching QR from Midtrans...')

      // Fetch QR from Midtrans status API
      const serverKey = process.env.MIDTRANS_SERVER_KEY
      const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true'
      const apiBase = isProduction ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com'

      if (!serverKey) {
        console.error('[ORDER API] ❌ Midtrans credentials missing')
        return NextResponse.json(
          { order, qr: null },
          { status: 200 }
        )
      }

      try {
        if (!order.transaction_id) {
          console.warn('[ORDER API] ⚠️ No transaction_id found')
          return NextResponse.json({
            order,
            qr: null,
          }, { status: 200 })
        }

        const auth = Buffer.from(String(serverKey) + ':').toString('base64')
        const statusUrl = `${apiBase}/v2/${order.transaction_id}/status`

        console.log('[ORDER API] Fetching status from:', statusUrl)

        const statusResponse = await fetch(statusUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        })

        if (!statusResponse.ok) {
          console.error('[ORDER API] ❌ Midtrans status fetch failed:', statusResponse.status)
          console.log('[ORDER API] ⚠️ Continuing without QR data')
        } else {
          const statusData = await statusResponse.json()
          
          // Extract QR code from Midtrans response
          // QRIS returns qr_string in the response
          qrData = {
            qrUrl: statusData.qr_string || null,
            qrString: statusData.qr_string || null,
            transactionStatus: statusData.transaction_status || null,
            fraudStatus: statusData.fraud_status || null,
          }

          console.log('[ORDER API] ✅ QR fetched from Midtrans:', {
            hasQr: !!qrData.qrUrl,
            transactionStatus: qrData.transactionStatus,
          })
        }
      } catch (midtransError) {
        console.error('[ORDER API] ⚠️ Error fetching QR:', (midtransError as Error).message)
        // Continue without QR, don't block order info
      }
    } else {
      console.log('[ORDER API] ℹ️ Order not pending (status:', order.status, '), QR not provided')
    }

    // ✅ Return order info + QR (if pending)
    const response = {
      success: true,
      order: {
        order_id: order.order_id,
        customer_name: order.customer_name,
        customer_email: order.customer_email,
        customer_phone: order.customer_phone,
        total_amount: order.total_amount,
        status: order.status,
        payment_method: order.payment_method,
        transaction_id: order.transaction_id || null,
        created_at: order.created_at,
        updated_at: order.updated_at || null,
      },
      qr: qrData,
    }

    console.log('[ORDER API] ✅ Response ready')
    return NextResponse.json(response)

  } catch (error) {
    console.error('[ORDER API] ❌ Unexpected error:', (error as Error).message)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

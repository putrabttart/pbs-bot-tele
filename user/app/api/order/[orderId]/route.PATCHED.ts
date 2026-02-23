import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const orderId = params.orderId

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID required' }, { status: 400 })
    }

    console.log('[ORDER API] Fetching order:', orderId)

    // ✅ Fetch order from database (read-only, no sensitive data exposed)
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, order_id, total_amount, status, transaction_id, customer_name, customer_email, items, created_at')
      .eq('order_id', orderId)
      .single()

    if (error || !order) {
      console.error('[ORDER API] Order not found:', orderId)
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    console.log('[ORDER API] Order found, status:', order.status)

    // ✅ If order status is still 'pending', fetch QR from Midtrans
    let qrData = null

    if (order.status === 'pending' || order.status === 'pending_payment') {
      try {
        const serverKey = process.env.MIDTRANS_SERVER_KEY
        const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true'
        const apiBase = isProduction
          ? 'https://api.midtrans.com'
          : 'https://api.sandbox.midtrans.com'

        const auth = Buffer.from(String(serverKey) + ':').toString('base64')
        const statusUrl = `${apiBase}/v2/${encodeURIComponent(orderId)}/status`

        console.log('[ORDER API] Fetching status from Midtrans...')

        const statusResponse = await fetch(statusUrl, {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Basic ${auth}`,
          },
        })

        const statusText = await statusResponse.text()

        if (statusResponse.ok) {
          const midtransData = JSON.parse(statusText)
          
          // Extract QR code data from Midtrans response
          if (midtransData.actions) {
            const qrAction = midtransData.actions.find(
              (a: any) => a.name === 'generate-qr-code' || a.name === 'generate-qr-code-v2'
            )
            if (qrAction?.url) {
              qrData = {
                qrUrl: qrAction.url,
              }
            }
          }

          // Also try direct QR endpoints
          if (!qrData?.qrUrl && midtransData.qr_url) {
            qrData = { qrUrl: midtransData.qr_url }
          }

          console.log('[ORDER API] QR data retrieved from Midtrans:', !!qrData?.qrUrl)
        } else {
          console.warn('[ORDER API] Could not fetch Midtrans status:', statusResponse.status)
        }
      } catch (err: any) {
        console.error('[ORDER API] Error fetching QR:', err.message)
      }
    }

    // ✅ Return order data + QR (only if pending, only from Midtrans API)
    return NextResponse.json(
      {
        success: true,
        order: {
          orderId: order.order_id,
          status: order.status,
          totalAmount: order.total_amount,
          customerName: order.customer_name,
          customerEmail: order.customer_email,
          items: order.items,
          createdAt: order.created_at,
        },
        qr: qrData, // ← Only if order is pending, from Midtrans API
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('[ORDER API] Error:', error.message)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

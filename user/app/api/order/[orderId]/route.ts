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
      console.log('[ORDER API] 📊 Fetching QR from Midtrans using transaction_id...')

      if (order.transaction_id) {
        // ✅ Return transaction_id so frontend can call /api/qris/{transactionId}
        qrData = {
          transactionId: order.transaction_id,
          source: 'database',
        }
        console.log('[ORDER API] ✅ QR endpoint ready for:', order.transaction_id)
      } else {
        console.warn('[ORDER API] ⚠️ No transaction_id found')
      }
    } else {
      console.log('[ORDER API] ℹ️ Order not pending (status:', order.status, ')')
    }

    // ✅ Return order info + QR (if pending) - OUTSIDE if/else block
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

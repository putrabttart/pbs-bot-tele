import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { email, orderId } = await request.json()

    if (!email || !orderId) {
      return NextResponse.json(
        { found: false, orders: [], error: 'Email dan Order ID diperlukan' },
        { status: 400 }
      )
    }

    // Search in orders table
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .eq('customer_email', email)
      .eq('order_id', orderId)

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { found: false, orders: [], error: 'Terjadi kesalahan database' },
        { status: 500 }
      )
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json(
        { found: false, orders: [] },
        { status: 200 }
      )
    }

    // Format results
    const formattedOrders = orders.map((order: any) => ({
      id: order.id,
      orderId: order.order_id,
      transactionId: order.transaction_id,
      customerEmail: order.customer_email,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      total: Number(order.amount),
      status: order.status,
      transactionTime: order.created_at,
      items: order.items || [],
    }))

    return NextResponse.json(
      { found: true, orders: formattedOrders },
      { status: 200 }
    )
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { found: false, orders: [], error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

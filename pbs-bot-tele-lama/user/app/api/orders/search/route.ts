import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

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

    const orderUuids = orders.map((o: any) => o.id)
    const orderIdStrings = orders.map((o: any) => o.order_id)

    // Fetch order_items for these orders
    const { data: orderItems, error: orderItemsError } = await supabase
      .from('order_items')
      .select('order_id, product_code, product_name, quantity, price, item_data')
      .in('order_id', orderUuids)

    if (orderItemsError) {
      console.warn('[Order Search] Could not load order_items:', orderItemsError.message)
    }

    // Fetch notes from product_items (by order_id string)
    const { data: productItemNotes, error: notesError } = await supabase
      .from('product_items')
      .select('order_id, product_code, notes')
      .in('order_id', orderIdStrings)
      .eq('status', 'sold')

    if (notesError) {
      console.warn('[Order Search] Could not load product item notes:', notesError.message)
    }

    const notesMap = new Map<string, Map<string, string[]>>()
    for (const row of productItemNotes || []) {
      const oid = row.order_id
      const code = row.product_code
      const note = (row.notes || '').trim()
      if (!oid || !code || !note) continue
      if (!notesMap.has(oid)) notesMap.set(oid, new Map())
      const productMap = notesMap.get(oid)!
      const list = productMap.get(code) || []
      if (!list.includes(note)) list.push(note)
      productMap.set(code, list)
    }

    const itemsByOrder = new Map<string, any[]>()
    for (const it of orderItems || []) {
      const list = itemsByOrder.get(it.order_id) || []
      list.push(it)
      itemsByOrder.set(it.order_id, list)
    }

    // Format results
    const formattedOrders = orders.map((order: any) => {
      const rawItems = itemsByOrder.get(order.id) || order.items || []
      const enrichedItems = rawItems.map((it: any) => {
        const productNotes = notesMap.get(order.order_id)?.get(it.product_code) || []
        return {
          ...it,
          product_notes: productNotes.join('\n')
        }
      })

      return {
      id: order.id,
      orderId: order.order_id,
      transactionId: order.transaction_id,
      customerEmail: order.customer_email,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      total: Number(order.total_amount ?? order.amount ?? 0),
      status: order.status,
      transactionTime: order.created_at,
      items: enrichedItems,
    }
    })

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

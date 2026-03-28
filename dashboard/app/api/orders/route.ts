import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createServerClient()

    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })

    if (ordersError) {
      return NextResponse.json({ error: ordersError.message }, { status: 500 })
    }

    const orderUUIDs = (orders || []).map((o: any) => o.id).filter(Boolean)
    let orderItems: Record<string, any[]> = {}

    if (orderUUIDs.length > 0) {
      const chunkSize = 150
      for (let i = 0; i < orderUUIDs.length; i += chunkSize) {
        const chunk = orderUUIDs.slice(i, i + chunkSize)
        const { data: itemsData, error: itemsError } = await supabase
          .from('order_items')
          .select('*')
          .in('order_id', chunk)

        if (itemsError) {
          return NextResponse.json(
            { error: itemsError.message || 'Failed to load order items' },
            { status: 500 }
          )
        }

        ;(itemsData || []).forEach((item: any) => {
          if (!orderItems[item.order_id]) {
            orderItems[item.order_id] = []
          }
          orderItems[item.order_id].push(item)
        })
      }
    }

    return NextResponse.json({ orders: orders || [], orderItems })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to load orders' },
      { status: 500 }
    )
  }
}

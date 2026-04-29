import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, supabaseAdmin } from '@/lib/auth'

const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 50

export async function GET(request: NextRequest) {
  // 1. Check authentication
  const session = await getSessionUser(request)
  if (!session) {
    return NextResponse.json({ error: 'Anda harus login untuk melihat riwayat pesanan' }, { status: 401 })
  }

  try {
    // 2. Parse pagination params
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(searchParams.get('limit') || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE))
    const offset = (page - 1) * limit

    // 3. Build filter
    const filterStr = `user_web_id.eq.${session.userId},customer_email.eq.${session.email},customer_phone.eq.${session.phone}`

    // 4. Get total count
    const { count: totalCount, error: countError } = await supabaseAdmin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .or(filterStr)

    if (countError) {
      console.error('Orders count error:', countError)
      return NextResponse.json({ error: 'Gagal mengambil riwayat pesanan' }, { status: 500 })
    }

    const total = totalCount || 0
    const totalPages = Math.max(1, Math.ceil(total / limit))

    // 5. Fetch paginated orders
    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select('id, order_id, transaction_id, customer_name, customer_email, customer_phone, total_amount, status, payment_method, items, created_at, user_web_id')
      .or(filterStr)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Orders fetch error:', error)
      return NextResponse.json({ error: 'Gagal mengambil riwayat pesanan' }, { status: 500 })
    }

    // 6. For completed orders, also fetch order_items with item_data
    const orderIds = (orders || []).map((o: any) => o.id)
    let orderItemsMap: Record<string, any[]> = {}

    if (orderIds.length > 0) {
      const { data: orderItems } = await supabaseAdmin
        .from('order_items')
        .select('id, order_id, product_code, item_data, quantity, price')
        .in('order_id', orderIds)

      if (orderItems) {
        for (const item of orderItems) {
          if (!orderItemsMap[item.order_id]) {
            orderItemsMap[item.order_id] = []
          }
          orderItemsMap[item.order_id].push(item)
        }
      }
    }

    // 7. Merge order_items into orders
    const enrichedOrders = (orders || []).map((order: any) => {
      const dbItems = orderItemsMap[order.id] || []
      let mergedItems = (order.items || []).map((jsonItem: any) => {
        const matchingDbItem = dbItems.find(
          (dbItem: any) => dbItem.product_code === (jsonItem.product_code || jsonItem.productCode)
        )
        return {
          ...jsonItem,
          item_data: matchingDbItem?.item_data || jsonItem.item_data || '',
        }
      })

      return {
        id: order.id,
        orderId: order.order_id,
        transactionId: order.transaction_id,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        customerPhone: order.customer_phone,
        total: order.total_amount,
        status: order.status,
        paymentMethod: order.payment_method,
        transactionTime: order.created_at,
        items: mergedItems,
      }
    })

    return NextResponse.json({
      success: true,
      orders: enrichedOrders,
      pagination: {
        page,
        limit,
        totalCount: total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    })
  } catch (error: any) {
    console.error('Orders API error:', error)
    return NextResponse.json(
      { error: `Terjadi kesalahan: ${error.message || 'unknown error'}` },
      { status: 500 }
    )
  }
}

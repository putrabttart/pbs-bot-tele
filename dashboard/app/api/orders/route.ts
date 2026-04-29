import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * Fetch ALL rows from a Supabase table, bypassing the default 1000-row limit.
 * Uses range-based pagination to pull every row.
 */
async function fetchAll(
  supabase: ReturnType<typeof createServerClient>,
  table: string,
  options?: { orderBy?: string; ascending?: boolean; filterColumn?: string; filterValues?: string[] }
) {
  const PAGE_SIZE = 1000
  let allData: any[] = []
  let from = 0
  let hasMore = true

  while (hasMore) {
    let query = supabase
      .from(table)
      .select('*')
      .range(from, from + PAGE_SIZE - 1)

    if (options?.orderBy) {
      query = query.order(options.orderBy, { ascending: options.ascending ?? false })
    }

    if (options?.filterColumn && options?.filterValues) {
      query = query.in(options.filterColumn, options.filterValues)
    }

    const { data, error } = await query

    if (error) throw error

    const rows = data || []
    allData = allData.concat(rows)

    if (rows.length < PAGE_SIZE) {
      hasMore = false
    } else {
      from += PAGE_SIZE
    }
  }

  return allData
}

export async function GET() {
  try {
    const supabase = createServerClient()

    // Fetch ALL orders (bypasses default 1000-row limit)
    const orders = await fetchAll(supabase, 'orders', {
      orderBy: 'created_at',
      ascending: false,
    })

    // Fetch ALL order_items for these orders
    const orderUUIDs = orders.map((o: any) => o.id).filter(Boolean)
    let orderItems: Record<string, any[]> = {}

    if (orderUUIDs.length > 0) {
      // Fetch order_items in chunks to avoid URL length limits
      const chunkSize = 200
      for (let i = 0; i < orderUUIDs.length; i += chunkSize) {
        const chunk = orderUUIDs.slice(i, i + chunkSize)
        const { data: itemsData, error: itemsError } = await supabase
          .from('order_items')
          .select('*')
          .in('order_id', chunk)
          .range(0, 9999)

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

    return NextResponse.json({ orders, orderItems })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to load orders' },
      { status: 500 }
    )
  }
}

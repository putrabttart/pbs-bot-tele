import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const supabase = createServerClient()

    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })

    if (productsError) {
      return NextResponse.json({ error: productsError.message || JSON.stringify(productsError) }, { status: 400 })
    }

    const { data: productItems, error: itemsError } = await supabase
      .from('product_items')
      .select('product_id, status')

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message || JSON.stringify(itemsError) }, { status: 400 })
    }

    const countsMap = new Map<string, { total: number }>()
    ;(productItems || []).forEach((item: any) => {
      const productIdKey = String(item.product_id || '').trim()
      if (!productIdKey) return

      if (!countsMap.has(productIdKey)) {
        countsMap.set(productIdKey, { total: 0 })
      }

      const counts = countsMap.get(productIdKey)!
      counts.total += 1
    })

    const enrichedProducts = (products || []).map((p: any) => {
      const itemCountsForProduct = countsMap.get(String(p.id))
      // Canonical available stock comes from products.stok.
      const availableItems = Number(p.stok || 0)
      const totalItems = itemCountsForProduct?.total || 0

      return {
        ...p,
        // Presentation-only: show effective stock from items for item-managed products.
        stok: totalItems > 0 ? availableItems : p.stok,
        availableItems,
        totalItems,
      }
    })

    return NextResponse.json({ data: enrichedProducts })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to fetch products' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const payload = await req.json()

    const { data, error } = await supabase
      .from('products')
      .insert([payload])
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message || JSON.stringify(error) }, { status: 400 })
    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to create product' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await req.json()
    const { id, ...payload } = body

    if (!id) return NextResponse.json({ error: 'Missing product id' }, { status: 400 })

    const { data, error } = await supabase
      .from('products')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message || JSON.stringify(error) }, { status: 400 })
    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update product' }, { status: 500 })
  }
}

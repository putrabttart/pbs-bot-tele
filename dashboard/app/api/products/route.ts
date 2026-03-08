import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

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

    const { data: itemCounts, error: itemsError } = await supabase
      .from('product_items')
      .select('product_code, status')

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message || JSON.stringify(itemsError) }, { status: 400 })
    }

    const countsMap = new Map<string, { available: number; total: number }>()
    ;(itemCounts || []).forEach((item: any) => {
      const key = item.product_code
      if (!countsMap.has(key)) {
        countsMap.set(key, { available: 0, total: 0 })
      }
      const counts = countsMap.get(key)!
      counts.total += 1
      if (item.status === 'available') counts.available += 1
    })

    const enrichedProducts = (products || []).map((p: any) => ({
      ...p,
      availableItems: countsMap.get(p.kode)?.available || 0,
      totalItems: countsMap.get(p.kode)?.total || 0,
    }))

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

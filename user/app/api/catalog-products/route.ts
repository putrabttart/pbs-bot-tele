import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function getServerSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''

  if (!supabaseUrl || !key) {
    throw new Error('Missing Supabase env for catalog API')
  }

  return createClient(supabaseUrl, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function norm(v: string | null | undefined) {
  return String(v || '').trim().toLowerCase()
}

function isTrueLike(v: unknown) {
  return v === true || String(v || '').trim().toLowerCase() === 'true'
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getServerSupabase()
    const { searchParams } = new URL(request.url)

    const id = searchParams.get('id')
    const q = (searchParams.get('q') || '').trim()
    const aktifOnly = searchParams.get('aktifOnly') !== 'false'
    const limit = Number(searchParams.get('limit') || 0)

    let productsQuery = supabase.from('products').select('*').order('nama', { ascending: true })

    if (aktifOnly) {
      productsQuery = productsQuery.eq('aktif', true)
    }

    if (id) {
      productsQuery = productsQuery.eq('id', id)
    }

    if (q.length >= 2) {
      const escaped = q.replace(/,/g, ' ')
      productsQuery = productsQuery.or(`nama.ilike.%${escaped}%,deskripsi.ilike.%${escaped}%,kategori.ilike.%${escaped}%`)
    }

    if (limit > 0) {
      productsQuery = productsQuery.limit(limit)
    }

    const { data: products, error: productsError } = await productsQuery
    if (productsError) {
      return NextResponse.json({ error: productsError.message || JSON.stringify(productsError) }, { status: 400 })
    }

    const ids = (products || []).map((p: any) => p.id).filter(Boolean)

    const countsMap = new Map<string, { available: number; total: number }>()

    if (ids.length > 0) {
      const { data: items, error: itemsError } = await supabase
        .from('product_items')
        .select('product_id, status')
        .in('product_id', ids)

      if (itemsError) {
        return NextResponse.json({ error: itemsError.message || JSON.stringify(itemsError) }, { status: 400 })
      }

      ;(items || []).forEach((item: any) => {
        const key = String(item.product_id || '').trim()
        if (!key) return

        if (!countsMap.has(key)) {
          countsMap.set(key, { available: 0, total: 0 })
        }

        const c = countsMap.get(key)!
        c.total += 1
        if (norm(item.status) === 'available') {
          c.available += 1
        }
      })
    }

    const filteredProducts = aktifOnly ? (products || []).filter((p: any) => isTrueLike(p?.aktif)) : (products || [])

    const data = filteredProducts.map((p: any) => {
      const c = countsMap.get(String(p.id))
      const availableItems = c?.available || 0
      const totalItems = c?.total || 0
      const hargaWeb = Number(p?.harga_web ?? p?.harga_bot ?? 0) || 0
      const hargaBot = Number(p?.harga_bot ?? p?.harga_web ?? 0) || 0

      return {
        ...p,
        harga_web: hargaWeb,
        harga_bot: hargaBot,
        availableItems,
        totalItems,
        stok: totalItems > 0 ? availableItems : p.stok,
      }
    })

    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to load catalog products' }, { status: 500 })
  }
}

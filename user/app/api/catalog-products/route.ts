import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveBotPrice, resolveWebPrice } from '@/lib/pricing'
import { logApi, logError, logSuccess } from '@/lib/logging/terminal-log'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const STOCK_SWITCH_CONFIRMATION = 3
const ZERO_DROP_EXTRA_CONFIRMATION = 2
const MAX_STABLE_PRODUCTS = 500

type StableProductState = {
  stableStock: number
  stableAvailable: number
  stableTotal: number
  pendingStock: number | null
  pendingAvailable: number | null
  pendingTotal: number | null
  pendingHits: number
  lastSeenAt: number
}

const stableStockByProductId = new Map<string, StableProductState>()

function asNumber(v: any) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function sameTuple(
  a: { stock: number; available: number; total: number },
  b: { stock: number; available: number; total: number }
) {
  return a.stock === b.stock && a.available === b.available && a.total === b.total
}

function pruneStableProductMap() {
  if (stableStockByProductId.size <= MAX_STABLE_PRODUCTS) return

  let oldestKey: string | null = null
  let oldestSeenAt = Number.MAX_SAFE_INTEGER

  for (const [key, state] of stableStockByProductId.entries()) {
    if (state.lastSeenAt < oldestSeenAt) {
      oldestSeenAt = state.lastSeenAt
      oldestKey = key
    }
  }

  if (oldestKey) {
    stableStockByProductId.delete(oldestKey)
  }
}

function stabilizeProductStock(productId: string, candidate: { stock: number; available: number; total: number }) {
  if (!productId) return candidate

  const now = Date.now()
  const current = stableStockByProductId.get(productId)

  if (!current) {
    stableStockByProductId.set(productId, {
      stableStock: candidate.stock,
      stableAvailable: candidate.available,
      stableTotal: candidate.total,
      pendingStock: null,
      pendingAvailable: null,
      pendingTotal: null,
      pendingHits: 0,
      lastSeenAt: now,
    })
    pruneStableProductMap()
    return candidate
  }

  current.lastSeenAt = now
  const stableTuple = {
    stock: current.stableStock,
    available: current.stableAvailable,
    total: current.stableTotal,
  }

  if (sameTuple(candidate, stableTuple)) {
    current.pendingStock = null
    current.pendingAvailable = null
    current.pendingTotal = null
    current.pendingHits = 0
    return candidate
  }

  // Bias against false-zero flicker: move up immediately, move to zero more carefully.
  if (candidate.stock > stableTuple.stock) {
    current.stableStock = candidate.stock
    current.stableAvailable = candidate.available
    current.stableTotal = candidate.total
    current.pendingStock = null
    current.pendingAvailable = null
    current.pendingTotal = null
    current.pendingHits = 0
    return candidate
  }

  const isSuspiciousDropToZero = stableTuple.stock > 0 && candidate.stock === 0 && candidate.total > 0
  const requiredHits = isSuspiciousDropToZero
    ? STOCK_SWITCH_CONFIRMATION + ZERO_DROP_EXTRA_CONFIRMATION
    : STOCK_SWITCH_CONFIRMATION

  const pendingTuple =
    current.pendingStock === null || current.pendingAvailable === null || current.pendingTotal === null
      ? null
      : {
          stock: current.pendingStock,
          available: current.pendingAvailable,
          total: current.pendingTotal,
        }

  if (pendingTuple && sameTuple(candidate, pendingTuple)) {
    current.pendingHits += 1
  } else {
    current.pendingStock = candidate.stock
    current.pendingAvailable = candidate.available
    current.pendingTotal = candidate.total
    current.pendingHits = 1
  }

  if (current.pendingHits >= requiredHits) {
    current.stableStock = candidate.stock
    current.stableAvailable = candidate.available
    current.stableTotal = candidate.total
    current.pendingStock = null
    current.pendingAvailable = null
    current.pendingTotal = null
    current.pendingHits = 0
    return candidate
  }

  return stableTuple
}

function jsonNoStore(payload: any, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    },
  })
}

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

    logApi('GET /api/catalog-products', {
      id: id || '-',
      q,
      aktifOnly,
      limit,
    })

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
      logError('API', 'Catalog products query failed', {
        route: '/api/catalog-products',
        error: productsError.message,
      })
      return jsonNoStore({ error: productsError.message || JSON.stringify(productsError) }, 400)
    }

    const ids = (products || []).map((p: any) => p.id).filter(Boolean)

    const countsMap = new Map<string, { available: number; total: number }>()

    if (ids.length > 0) {
      const { data: inventoryRows, error: inventoryError } = await supabase
        .from('product_inventory_summary')
        .select('product_id, available_items, total_items')
        .in('product_id', ids)

      if (inventoryError) {
        logError('API', 'Catalog product_items query failed', {
          route: '/api/catalog-products',
          error: inventoryError.message,
        })
        return jsonNoStore({ error: inventoryError.message || JSON.stringify(inventoryError) }, 400)
      }

      ;(inventoryRows || []).forEach((row: any) => {
        const key = String(row.product_id || '').trim()
        if (!key) return

        countsMap.set(key, {
          available: Number(row.available_items || 0),
          total: Number(row.total_items || 0),
        })
      })
    }

    const filteredProducts = aktifOnly ? (products || []).filter((p: any) => isTrueLike(p?.aktif)) : (products || [])

    const data = filteredProducts.map((p: any) => {
      const c = countsMap.get(String(p.id))
      const availableItems = c?.available || 0
      const totalItems = c?.total || 0
      const hargaWeb = resolveWebPrice(p)
      const hargaBot = resolveBotPrice(p)
      const candidateStock = totalItems > 0 ? availableItems : asNumber(p.stok)
      const stable = stabilizeProductStock(String(p.id || ''), {
        stock: candidateStock,
        available: asNumber(availableItems),
        total: asNumber(totalItems),
      })

      return {
        ...p,
        harga_web: hargaWeb,
        harga_bot: hargaBot,
        availableItems: stable.available,
        totalItems: stable.total,
        stok: stable.stock,
      }
    })

    logSuccess('API', 'Catalog products served', {
      route: '/api/catalog-products',
      count: data.length,
    })

    return jsonNoStore({ data })
  } catch (err: any) {
    logError('API', 'Catalog products unhandled error', {
      route: '/api/catalog-products',
      error: err?.message || 'unknown_error',
      stack: err?.stack,
    })
    return jsonNoStore({ error: err?.message || 'Failed to load catalog products' }, 500)
  }
}

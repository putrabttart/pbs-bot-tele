import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import crypto from 'node:crypto'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const SNAPSHOT_SWITCH_CONFIRMATION = 2

type StableSnapshotState = {
  stableHash: string
  stableData: any[]
  pendingHash: string | null
  pendingHits: number
}

let stableSnapshotState: StableSnapshotState | null = null

function hashSnapshot(data: any[]) {
  return crypto.createHash('sha1').update(JSON.stringify(data || [])).digest('hex')
}

function stabilizeSnapshot(data: any[]) {
  const candidateHash = hashSnapshot(data)

  if (!stableSnapshotState) {
    stableSnapshotState = {
      stableHash: candidateHash,
      stableData: data,
      pendingHash: null,
      pendingHits: 0,
    }
    return data
  }

  if (candidateHash === stableSnapshotState.stableHash) {
    stableSnapshotState.stableData = data
    stableSnapshotState.pendingHash = null
    stableSnapshotState.pendingHits = 0
    return data
  }

  if (stableSnapshotState.pendingHash === candidateHash) {
    stableSnapshotState.pendingHits += 1
  } else {
    stableSnapshotState.pendingHash = candidateHash
    stableSnapshotState.pendingHits = 1
  }

  if (stableSnapshotState.pendingHits >= SNAPSHOT_SWITCH_CONFIRMATION) {
    stableSnapshotState.stableHash = candidateHash
    stableSnapshotState.stableData = data
    stableSnapshotState.pendingHash = null
    stableSnapshotState.pendingHits = 0
    return data
  }

  return stableSnapshotState.stableData
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

function normalizePrice(value: any) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function hasOwn(obj: any, key: string) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key)
}

function normalizeProductPayload(input: any, options: { requirePrice?: boolean } = {}) {
  const requirePrice = options.requirePrice !== false
  const hasWebPrice = hasOwn(input, 'harga_web')
  const hasBotPrice = hasOwn(input, 'harga_bot')
  const hasLegacyPrice = hasOwn(input, 'harga')
  const hasAnyPriceField = hasWebPrice || hasBotPrice || hasLegacyPrice

  // For partial updates (e.g. quick toggle aktif), keep payload untouched if no price fields are sent.
  if (!hasAnyPriceField && !requirePrice) {
    const payload: any = { ...(input || {}) }
    delete payload.harga
    return payload
  }

  const rawWebPrice = normalizePrice(input?.harga_web)
  const rawBotPrice = normalizePrice(input?.harga_bot)
  const rawLegacyPrice = normalizePrice(input?.harga)
  const webPrice = rawWebPrice ?? rawBotPrice ?? rawLegacyPrice
  const botPrice = rawBotPrice ?? rawWebPrice ?? rawLegacyPrice

  if (webPrice === null && botPrice === null) {
    throw new Error('Isi minimal salah satu harga: harga_web atau harga_bot')
  }

  const payload: any = {
    ...input,
    harga_web: webPrice,
    harga_bot: botPrice,
  }

  delete payload.harga

  return payload
}

export async function GET() {
  try {
    const supabase = createServerClient()

    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })

    if (productsError) {
      return jsonNoStore({ error: productsError.message || JSON.stringify(productsError) }, 400)
    }

    const productIds = (products || []).map((p: any) => String(p.id || '')).filter(Boolean)
    const countsMap = new Map<string, { available: number; total: number }>()

    if (productIds.length > 0) {
      const { data: inventoryRows, error: inventoryError } = await supabase
        .from('product_inventory_summary')
        .select('product_id, available_items, total_items')
        .in('product_id', productIds)

      if (inventoryError) {
        return jsonNoStore({ error: inventoryError.message || JSON.stringify(inventoryError) }, 400)
      }

      ;(inventoryRows || []).forEach((row: any) => {
        const productIdKey = String(row.product_id || '').trim()
        if (!productIdKey) return

        countsMap.set(productIdKey, {
          available: Number(row.available_items || 0),
          total: Number(row.total_items || 0),
        })
      })
    }

    const enrichedProducts = (products || []).map((p: any) => {
      const itemCountsForProduct = countsMap.get(String(p.id))
      const rawTotalItems = itemCountsForProduct?.total || 0
      const availableFromItems = itemCountsForProduct?.available || 0
      const itemManaged = rawTotalItems > 0
      const availableItems = itemManaged ? availableFromItems : Number(p.stok || 0)
      // Display-friendly total: for non-item products, mirror static stock to avoid 1/0 confusion.
      const totalItems = itemManaged ? rawTotalItems : availableItems
      const rawWebPrice = normalizePrice(p?.harga_web)
      const rawBotPrice = normalizePrice(p?.harga_bot)
      const webPrice = rawWebPrice ?? rawBotPrice ?? 0
      const botPrice = rawBotPrice ?? rawWebPrice ?? 0

      return {
        ...p,
        harga_web: webPrice,
        harga_bot: botPrice,
        // Canonical stock for API consumers.
        stok: availableItems,
        availableItems,
        totalItems,
        itemManaged,
      }
    })

    const stableProducts = stabilizeSnapshot(enrichedProducts)
    return jsonNoStore({ data: stableProducts })
  } catch (err: any) {
    return jsonNoStore({ error: err?.message || 'Failed to fetch products' }, 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const payload = normalizeProductPayload(await req.json(), { requirePrice: true })

    const { data, error } = await supabase
      .from('products')
      .insert([payload])
      .select()
      .single()

    if (error) return jsonNoStore({ error: error.message || JSON.stringify(error) }, 400)
    return jsonNoStore({ data })
  } catch (err: any) {
    return jsonNoStore({ error: err?.message || 'Failed to create product' }, 500)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await req.json()
    const { id, ...rawPayload } = body
    const payload = normalizeProductPayload(rawPayload, { requirePrice: false })

    if (!id) return jsonNoStore({ error: 'Missing product id' }, 400)

    const { data, error } = await supabase
      .from('products')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (error) return jsonNoStore({ error: error.message || JSON.stringify(error) }, 400)
    return jsonNoStore({ data })
  } catch (err: any) {
    return jsonNoStore({ error: err?.message || 'Failed to update product' }, 500)
  }
}

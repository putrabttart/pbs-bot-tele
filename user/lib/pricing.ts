type PriceSource = {
  harga_web?: unknown
  harga_bot?: unknown
  harga?: unknown
} | null | undefined

function parsePrice(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null

  const raw = String(value).trim()
  if (!raw) return null

  let normalized = raw.replace(/\s+/g, '')

  // 1.234,56 -> 1234.56
  if (/^\d{1,3}(\.\d{3})+,\d+$/.test(normalized)) {
    normalized = normalized.replace(/\./g, '').replace(',', '.')
  } else if (/^\d{1,3}(,\d{3})+\.\d+$/.test(normalized)) {
    // 1,234.56 -> 1234.56
    normalized = normalized.replace(/,/g, '')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(normalized)) {
    // 15.000 -> 15000
    normalized = normalized.replace(/\./g, '')
  } else if (/^\d{1,3}(,\d{3})+$/.test(normalized)) {
    // 15,000 -> 15000
    normalized = normalized.replace(/,/g, '')
  }

  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

export function resolveWebPrice(source: PriceSource): number {
  const web = parsePrice(source?.harga_web)
  const bot = parsePrice(source?.harga_bot)
  const legacy = parsePrice(source?.harga)
  return web ?? bot ?? legacy ?? 0
}

export function resolveBotPrice(source: PriceSource): number {
  const bot = parsePrice(source?.harga_bot)
  const web = parsePrice(source?.harga_web)
  const legacy = parsePrice(source?.harga)
  return bot ?? web ?? legacy ?? 0
}

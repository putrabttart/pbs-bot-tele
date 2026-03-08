import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

function parseProjectRefFromUrl(url: string): string | null {
  try {
    const host = new URL(url).host
    return host.split('.')[0] || null
  } catch {
    return null
  }
}

function parseProjectRefFromLegacyJwt(key: string): string | null {
  // Legacy service_role keys are JWTs; we can read `ref` from payload for sanity checks.
  if (!key.includes('.')) return null
  try {
    const payloadPart = key.split('.')[1]
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
    const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'))
    return typeof payload?.ref === 'string' ? payload.ref : null
  } catch {
    return null
  }
}

export function createBrowserClient() {
  return createSupabaseBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL in .env.local')
  }

  if (!serviceKey) {
    throw new Error('Missing Supabase server key. Set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY in .env.local')
  }

  const urlRef = parseProjectRefFromUrl(supabaseUrl)
  const keyRef = parseProjectRefFromLegacyJwt(serviceKey)
  if (urlRef && keyRef && urlRef !== keyRef) {
    throw new Error(
      `Supabase key mismatch: URL project ref is "${urlRef}" but service key belongs to "${keyRef}". Use keys from the same Supabase project.`
    )
  }

  return createClient(
    supabaseUrl,
    serviceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

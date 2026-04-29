import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

// Server-side Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServerKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  ''

export const supabaseAdmin = createClient(supabaseUrl, supabaseServerKey)

// ============================================
// Password utilities
// ============================================
const BCRYPT_ROUNDS = 12

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// ============================================
// Password validation
// ============================================
export interface PasswordValidation {
  valid: boolean
  errors: string[]
}

export function validatePassword(password: string): PasswordValidation {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push('Password minimal 8 karakter')
  }
  if (password.length > 64) {
    errors.push('Password maksimal 64 karakter')
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password harus mengandung huruf kecil (a-z)')
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password harus mengandung huruf besar (A-Z)')
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password harus mengandung angka (0-9)')
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
    errors.push('Password harus mengandung karakter spesial (!@#$%^&*...)')
  }

  return { valid: errors.length === 0, errors }
}

// ============================================
// Session token (simple JWT-like with crypto)
// ============================================
const SESSION_SECRET = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'default-session-secret-change-me'
const SESSION_COOKIE_NAME = 'pbs_session'
const SESSION_MAX_AGE = 30 * 24 * 60 * 60 // 30 days in seconds

interface SessionPayload {
  userId: string
  email: string
  nama: string
  phone: string
  iat: number
  exp: number
}

// Simple base64url encode/decode
function base64UrlEncode(str: string): string {
  return Buffer.from(str).toString('base64url')
}

function base64UrlDecode(str: string): string {
  return Buffer.from(str, 'base64url').toString('utf-8')
}

// Simple HMAC signing using Node.js crypto
async function sign(payload: string): Promise<string> {
  const { createHmac } = await import('crypto')
  return createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url')
}

export async function createSessionToken(user: { id: string; email: string; nama: string; phone: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const payload: SessionPayload = {
    userId: user.id,
    email: user.email,
    nama: user.nama,
    phone: user.phone,
    iat: now,
    exp: now + SESSION_MAX_AGE,
  }

  const payloadStr = base64UrlEncode(JSON.stringify(payload))
  const signature = await sign(payloadStr)
  return `${payloadStr}.${signature}`
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const [payloadStr, signature] = token.split('.')
    if (!payloadStr || !signature) return null

    const expectedSig = await sign(payloadStr)
    if (signature !== expectedSig) return null

    const payload: SessionPayload = JSON.parse(base64UrlDecode(payloadStr))
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp < now) return null

    return payload
  } catch {
    return null
  }
}

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  })
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
}

export function getSessionToken(request: NextRequest): string | null {
  return request.cookies.get(SESSION_COOKIE_NAME)?.value || null
}

export async function getSessionUser(request: NextRequest): Promise<SessionPayload | null> {
  const token = getSessionToken(request)
  if (!token) return null
  return verifySessionToken(token)
}

// ============================================
// CAPTCHA verification (same as checkout)
// ============================================
const HCAPTCHA_SECRET = process.env.HCAPTCHA_SECRET_KEY || ''
const HCAPTCHA_VERIFY_URL = 'https://hcaptcha.com/siteverify'
const IS_PRODUCTION = process.env.NODE_ENV === 'production'

export async function verifyCaptcha(token: string): Promise<{ success: boolean; score?: number; error?: string }> {
  if (!HCAPTCHA_SECRET) {
    if (IS_PRODUCTION) {
      return { success: false, error: 'CAPTCHA configuration error' }
    }
    return { success: true } // Allow in dev mode
  }

  if (!token || token.trim() === '') {
    return { success: false, error: 'CAPTCHA token missing' }
  }

  try {
    const response = await fetch(HCAPTCHA_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: HCAPTCHA_SECRET,
        response: token,
      }),
    })

    const result = await response.json()
    return {
      success: result.success,
      score: result.score,
      error: result['error-codes']?.join(', '),
    }
  } catch (error: any) {
    return { success: false, error: 'Verification failed' }
  }
}

// ============================================
// Rate limiting for auth (same pattern as checkout)
// ============================================
const AUTH_RATE_LIMIT_REQUESTS = 5 // 5 attempts per IP per window
const AUTH_RATE_LIMIT_WINDOW = 10 * 60 * 1000 // 10 minutes

export function normalizeIp(ip: string): string {
  try {
    if (ip.includes(':')) {
      const parts = ip.split(':')
      return parts.slice(0, 4).join(':') + '::/64'
    }
    return ip
  } catch {
    return ip
  }
}

export function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'
}

// Bot user agents to block
const BOT_USER_AGENTS = ['python-requests', 'curl', 'wget', 'postman', 'insomnia', 'httpie']

export function isBotUserAgent(userAgent: string): boolean {
  const ua = (userAgent || '').toLowerCase().trim()
  if (!ua || ua === 'null' || ua === 'undefined') return true
  return BOT_USER_AGENTS.some(botUa => ua.includes(botUa.toLowerCase()))
}

export async function checkAuthRateLimit(normalizedIp: string, source: string): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const ipWindowStart = new Date(Date.now() - AUTH_RATE_LIMIT_WINDOW).toISOString()

    try {
      const { data: rateLimitRow } = await supabaseAdmin
        .from('rate_limits')
        .select('request_count')
        .eq('ip', normalizedIp)
        .gte('window_start', ipWindowStart)
        .order('window_start', { ascending: false })
        .limit(1)
        .single()

      if (rateLimitRow && rateLimitRow.request_count >= AUTH_RATE_LIMIT_REQUESTS) {
        return { allowed: false, reason: 'Terlalu banyak percobaan. Coba lagi dalam 10 menit.' }
      }
    } catch {
      // table might not exist, skip
    }

    // Update IP rate counter
    try {
      const now = new Date()
      const windowKey = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), Math.floor(now.getMinutes() / 10) * 10).toISOString()

      await supabaseAdmin
        .from('rate_limits')
        .upsert({
          ip: normalizedIp,
          request_count: 1,
          window_start: windowKey,
          updated_at: now.toISOString(),
        }, { onConflict: 'ip,window_start' })
        .select()
    } catch {
      // Non-critical
    }

    return { allowed: true }
  } catch {
    return { allowed: true } // fail-open
  }
}

export async function logAuthAbuse(request: NextRequest, captchaResult: { success: boolean; score?: number; error?: string }, source: string) {
  try {
    const ip = getClientIp(request)
    await supabaseAdmin
      .from('abuse_logs')
      .insert({
        ip,
        user_agent: request.headers.get('user-agent'),
        referer: request.headers.get('referer'),
        origin: request.headers.get('origin'),
        captcha_score: captchaResult.score,
        captcha_result: captchaResult.success ? 'success' : (captchaResult.error || 'failed'),
        source,
      })
  } catch {
    // Non-critical
  }
}

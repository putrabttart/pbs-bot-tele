import { NextRequest, NextResponse } from 'next/server'
import {
  supabaseAdmin,
  verifyPassword,
  verifyCaptcha,
  checkAuthRateLimit,
  logAuthAbuse,
  isBotUserAgent,
  getClientIp,
  normalizeIp,
  createSessionToken,
  setSessionCookie,
} from '@/lib/auth'

function normalizeIdentifier(identifier: string) {
  return String(identifier || '').trim().toLowerCase()
}

function isEmail(value: string) {
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(value)
}

function normalizePhone(phone: string) {
  return String(phone || '').trim().replace(/\s+/g, '')
}

export async function POST(request: NextRequest) {
  try {
    const userAgent = request.headers.get('user-agent') || ''
    const clientIp = getClientIp(request)
    const normalizedIp = normalizeIp(clientIp)

    // 1. Block bots
    if (isBotUserAgent(userAgent)) {
      await logAuthAbuse(request, { success: false, error: 'bot_user_agent' }, 'login_bot_block')
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // 2. Parse body
    const body = await request.json()
    const { identifier, password, captchaToken } = body

    const normalizedId = normalizeIdentifier(identifier)
    const rawPassword = String(password || '')

    // 3. Basic validation
    if (!normalizedId) {
      return NextResponse.json({ error: 'Email atau nomor HP tidak boleh kosong' }, { status: 400 })
    }

    if (!rawPassword) {
      return NextResponse.json({ error: 'Password tidak boleh kosong' }, { status: 400 })
    }

    // 4. CAPTCHA verification
    const captchaResult = await verifyCaptcha(captchaToken || '')
    if (!captchaResult.success) {
      await logAuthAbuse(request, captchaResult, 'login')
      return NextResponse.json({ error: 'Verifikasi CAPTCHA gagal. Silakan coba lagi.' }, { status: 400 })
    }

    // 5. Rate limit
    const rateLimitCheck = await checkAuthRateLimit(normalizedIp, 'login')
    if (!rateLimitCheck.allowed) {
      await logAuthAbuse(request, captchaResult, 'login_rate_limit')
      return NextResponse.json({ error: rateLimitCheck.reason || 'Rate limit exceeded' }, { status: 429 })
    }

    // 6. Find user by email or phone
    let user: any = null

    if (isEmail(normalizedId)) {
      const { data } = await supabaseAdmin
        .from('user_web')
        .select('id, nama, email, phone, password_hash, is_active')
        .eq('email', normalizedId)
        .limit(1)
        .single()
      user = data
    } else {
      // Try as phone number
      const normalizedPhone = normalizePhone(normalizedId)
      const { data } = await supabaseAdmin
        .from('user_web')
        .select('id, nama, email, phone, password_hash, is_active')
        .eq('phone', normalizedPhone)
        .limit(1)
        .single()
      user = data
    }

    if (!user) {
      // Generic error to prevent user enumeration
      return NextResponse.json({ error: 'Email/nomor HP atau password salah' }, { status: 401 })
    }

    if (!user.is_active) {
      return NextResponse.json({ error: 'Akun Anda telah dinonaktifkan. Hubungi support.' }, { status: 403 })
    }

    // 7. Verify password
    const isPasswordValid = await verifyPassword(rawPassword, user.password_hash)
    if (!isPasswordValid) {
      await logAuthAbuse(request, { success: false, error: 'wrong_password' }, 'login_failed')
      return NextResponse.json({ error: 'Email/nomor HP atau password salah' }, { status: 401 })
    }

    // 8. Create session
    const sessionToken = await createSessionToken({
      id: user.id,
      email: user.email,
      nama: user.nama,
      phone: user.phone,
    })

    const response = NextResponse.json({
      success: true,
      message: 'Login berhasil!',
      user: {
        id: user.id,
        nama: user.nama,
        email: user.email,
        phone: user.phone,
      },
    })

    setSessionCookie(response, sessionToken)
    return response
  } catch (error: any) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: `Terjadi kesalahan: ${error.message || 'unknown error'}` },
      { status: 500 }
    )
  }
}

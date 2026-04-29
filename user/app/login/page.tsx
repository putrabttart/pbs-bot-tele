'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Script from 'next/script'
import { useAuth } from '@/components/AuthProvider'

export default function LoginPage() {
  const router = useRouter()
  const { user, login } = useAuth()

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // CAPTCHA state
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaReady, setCaptchaReady] = useState(false)
  const captchaRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<number | null>(null)

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      router.push('/profile')
    }
  }, [user, router])

  // Render hCaptcha
  const renderCaptcha = () => {
    const hc = (window as any).hcaptcha
    if (!hc || !captchaRef.current) return

    if (widgetIdRef.current !== null) {
      try { hc.remove(widgetIdRef.current) } catch {}
      widgetIdRef.current = null
    }
    captchaRef.current.innerHTML = ''

    try {
      widgetIdRef.current = hc.render(captchaRef.current, {
        sitekey: process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || '',
        callback: (token: string) => setCaptchaToken(token),
        'expired-callback': () => setCaptchaToken(''),
        'error-callback': () => setCaptchaToken(''),
      })
      setCaptchaReady(true)
    } catch (err) {
      console.warn('hCaptcha render error:', err)
    }
  }

  const resetCaptcha = () => {
    setCaptchaToken('')
    const hc = (window as any).hcaptcha
    if (hc && widgetIdRef.current !== null) {
      try { hc.reset(widgetIdRef.current) } catch {}
    }
  }

  useEffect(() => {
    setCaptchaToken('')
    setCaptchaReady(false)
    widgetIdRef.current = null

    let attempts = 0
    const tryRender = () => {
      if ((window as any).hcaptcha && captchaRef.current) {
        renderCaptcha()
        return
      }
      attempts++
      if (attempts < 30) setTimeout(tryRender, 200)
    }
    setTimeout(tryRender, 100)

    return () => { attempts = 999 }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!identifier.trim()) {
      setError('Masukkan email atau nomor HP')
      return
    }

    if (!password) {
      setError('Masukkan password')
      return
    }

    setLoading(true)

    const result = await login(identifier.trim(), password, captchaToken)

    if (result.success) {
      setSuccess(true)
      setTimeout(() => {
        router.push('/profile')
      }, 1000)
    } else {
      setError(result.error || 'Login gagal')
      resetCaptcha()
    }

    setLoading(false)
  }

  if (success) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="fa-solid fa-check text-green-500 text-4xl"></i>
          </div>
          <h1 className="text-2xl font-bold text-green-600 mb-2">Login Berhasil!</h1>
          <p className="text-gray-600 mb-4">Mengalihkan ke halaman profil...</p>
          <div className="animate-spin h-6 w-6 border-2 border-primary-500 border-t-transparent rounded-full mx-auto"></div>
        </div>
      </div>
    )
  }

  return (
    <>
      <Script
        src="https://js.hcaptcha.com/1/api.js?render=explicit&recaptchacompat=off"
        strategy="afterInteractive"
        onLoad={() => {
          if (captchaRef.current && widgetIdRef.current === null) {
            renderCaptcha()
          }
        }}
      />

      <div className="container mx-auto px-4 py-8 max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-[#5c63f2] to-[#7b5cf7] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <i className="fa-solid fa-right-to-bracket text-white text-2xl"></i>
            </div>
            <h1 className="text-2xl font-bold text-[#1c2340]">Masuk</h1>
            <p className="text-gray-500 text-sm mt-1">
              Login untuk melihat riwayat pesanan Anda
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6 flex items-start gap-2">
              <i className="fa-solid fa-circle-exclamation text-red-500 mt-0.5"></i>
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email / Phone */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Email atau Nomor HP <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <i className="fa-solid fa-at absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"></i>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5c63f2]/30 focus:border-[#5c63f2] transition-all"
                  placeholder="contoh@email.com atau 08xxxxxxxx"
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <i className="fa-solid fa-lock absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"></i>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5c63f2]/30 focus:border-[#5c63f2] transition-all"
                  placeholder="Masukkan password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>

            {/* CAPTCHA */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Verifikasi Keamanan <span className="text-red-500">*</span>
              </label>
              <div ref={captchaRef} />
              <p className="mt-1.5 text-xs text-gray-500">
                Selesaikan CAPTCHA untuk melanjutkan login.
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || (!captchaToken && captchaReady)}
              className="w-full bg-gradient-to-r from-[#5c63f2] to-[#7b5cf7] text-white py-3 rounded-lg font-semibold hover:shadow-lg hover:shadow-[#5c63f2]/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <i className="fa-solid fa-spinner animate-spin"></i>
                  Masuk...
                </span>
              ) : !captchaToken && captchaReady ? (
                'Selesaikan CAPTCHA dulu'
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <i className="fa-solid fa-right-to-bracket"></i>
                  Masuk
                </span>
              )}
            </button>
          </form>

          {/* Register Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Belum punya akun?{' '}
              <Link href="/register" className="text-[#5c63f2] font-semibold hover:underline">
                Daftar sekarang
              </Link>
            </p>
          </div>

          {/* Info */}
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <i className="fa-solid fa-circle-info text-blue-500 mt-0.5"></i>
              <p className="text-xs text-blue-700">
                Anda bisa login menggunakan email atau nomor HP yang terdaftar saat pendaftaran akun.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

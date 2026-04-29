'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Script from 'next/script'
import { useAuth } from '@/components/AuthProvider'

export default function RegisterPage() {
  const router = useRouter()
  const { user, register } = useAuth()

  const [nama, setNama] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [passwordErrors, setPasswordErrors] = useState<string[]>([])
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

  // Real-time password validation
  const getPasswordChecks = () => {
    return [
      { label: 'Minimal 8 karakter', valid: password.length >= 8 },
      { label: 'Huruf kecil (a-z)', valid: /[a-z]/.test(password) },
      { label: 'Huruf besar (A-Z)', valid: /[A-Z]/.test(password) },
      { label: 'Angka (0-9)', valid: /[0-9]/.test(password) },
      { label: 'Karakter spesial (!@#$%...)', valid: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password) },
    ]
  }

  const isPasswordStrong = () => getPasswordChecks().every(c => c.valid)
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setPasswordErrors([])

    if (!nama.trim() || !email.trim() || !phone.trim() || !password || !confirmPassword) {
      setError('Mohon isi semua data!')
      return
    }

    if (!isPasswordStrong()) {
      setError('Password belum memenuhi semua persyaratan')
      return
    }

    if (password !== confirmPassword) {
      setError('Konfirmasi password tidak cocok')
      return
    }

    setLoading(true)

    const result = await register({
      nama: nama.trim(),
      email: email.trim(),
      phone: phone.trim(),
      password,
      confirmPassword,
      captchaToken,
    })

    if (result.success) {
      setSuccess(true)
      setTimeout(() => {
        router.push('/profile')
      }, 1500)
    } else {
      setError(result.error || 'Registrasi gagal')
      if (result.passwordErrors) {
        setPasswordErrors(result.passwordErrors)
      }
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
          <h1 className="text-2xl font-bold text-green-600 mb-2">Registrasi Berhasil!</h1>
          <p className="text-gray-600 mb-4">Akun Anda telah dibuat. Mengalihkan ke halaman profil...</p>
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
              <i className="fa-solid fa-user-plus text-white text-2xl"></i>
            </div>
            <h1 className="text-2xl font-bold text-[#1c2340]">Daftar Akun</h1>
            <p className="text-gray-500 text-sm mt-1">
              Buat akun untuk melihat riwayat pesanan
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6 flex items-start gap-2">
              <i className="fa-solid fa-circle-exclamation text-red-500 mt-0.5"></i>
              <div>
                <p className="text-sm text-red-700 font-medium">{error}</p>
                {passwordErrors.length > 0 && (
                  <ul className="mt-1 text-xs text-red-600 list-disc list-inside">
                    {passwordErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nama */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Nama Lengkap <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <i className="fa-solid fa-user absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"></i>
                <input
                  type="text"
                  required
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5c63f2]/30 focus:border-[#5c63f2] transition-all"
                  placeholder="Masukkan nama lengkap"
                  maxLength={100}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Email <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <i className="fa-solid fa-envelope absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"></i>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5c63f2]/30 focus:border-[#5c63f2] transition-all"
                  placeholder="contoh@email.com"
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Nomor HP <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <i className="fa-solid fa-phone absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"></i>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5c63f2]/30 focus:border-[#5c63f2] transition-all"
                  placeholder="08xxxxxxxxxx"
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
                  placeholder="Buat password yang kuat"
                  maxLength={64}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>

              {/* Password strength indicators */}
              {password.length > 0 && (
                <div className="mt-2 bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <p className="text-xs font-semibold text-gray-600 mb-2">Persyaratan password:</p>
                  <div className="grid grid-cols-1 gap-1">
                    {getPasswordChecks().map((check, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <i className={`fa-solid ${check.valid ? 'fa-circle-check text-green-500' : 'fa-circle-xmark text-red-400'} text-xs`}></i>
                        <span className={`text-xs ${check.valid ? 'text-green-700' : 'text-gray-500'}`}>
                          {check.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Konfirmasi Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <i className="fa-solid fa-lock absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"></i>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full pl-10 pr-12 py-2.5 border rounded-lg focus:ring-2 transition-all ${
                    confirmPassword.length > 0
                      ? passwordsMatch
                        ? 'border-green-400 focus:ring-green-200 focus:border-green-500'
                        : 'border-red-400 focus:ring-red-200 focus:border-red-500'
                      : 'border-gray-300 focus:ring-[#5c63f2]/30 focus:border-[#5c63f2]'
                  }`}
                  placeholder="Ulangi password"
                  maxLength={64}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <i className={`fa-solid ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
              {confirmPassword.length > 0 && (
                <p className={`mt-1 text-xs flex items-center gap-1 ${passwordsMatch ? 'text-green-600' : 'text-red-500'}`}>
                  <i className={`fa-solid ${passwordsMatch ? 'fa-circle-check' : 'fa-circle-xmark'}`}></i>
                  {passwordsMatch ? 'Password cocok' : 'Password tidak cocok'}
                </p>
              )}
            </div>

            {/* CAPTCHA */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Verifikasi Keamanan <span className="text-red-500">*</span>
              </label>
              <div ref={captchaRef} />
              <p className="mt-1.5 text-xs text-gray-500">
                Selesaikan CAPTCHA untuk melanjutkan pendaftaran.
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || (!captchaToken && captchaReady) || !isPasswordStrong() || !passwordsMatch}
              className="w-full bg-gradient-to-r from-[#5c63f2] to-[#7b5cf7] text-white py-3 rounded-lg font-semibold hover:shadow-lg hover:shadow-[#5c63f2]/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <i className="fa-solid fa-spinner animate-spin"></i>
                  Mendaftarkan...
                </span>
              ) : !captchaToken && captchaReady ? (
                'Selesaikan CAPTCHA dulu'
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <i className="fa-solid fa-user-plus"></i>
                  Daftar Sekarang
                </span>
              )}
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Sudah punya akun?{' '}
              <Link href="/login" className="text-[#5c63f2] font-semibold hover:underline">
                Masuk di sini
              </Link>
            </p>
          </div>

          {/* Info */}
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <i className="fa-solid fa-circle-info text-blue-500 mt-0.5"></i>
              <p className="text-xs text-blue-700">
                Pendaftaran akun bersifat opsional. Anda tetap bisa berbelanja tanpa akun, 
                namun akun diperlukan untuk melihat riwayat pesanan.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

'use client'

import { useCart } from '@/components/CartProvider'
import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import Script from 'next/script'
import { resolveWebPrice } from '@/lib/pricing'

export default function CheckoutPage() {
  const { items, total, clearCart } = useCart()
  const { user } = useAuth()
  const router = useRouter()
  const getItemPrice = (product: any) => resolveWebPrice(product)
  const normalizeEmail = (email: string) => String(email || '').trim().toLowerCase()
  const isValidEmail = (email: string) => /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalizeEmail(email))
  const [customerName, setCustomerName] = useState(user?.nama || '')
  const [customerEmail, setCustomerEmail] = useState(user?.email || '')
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '')
  const [loading, setLoading] = useState(false)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string>('')
  const [captchaReady, setCaptchaReady] = useState(false)
  const captchaRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<number | null>(null)

  // Render (or re-render) the hCaptcha widget into captchaRef
  const renderCaptcha = () => {
    const hc = (window as any).hcaptcha
    if (!hc || !captchaRef.current) return

    // Remove old widget if present
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

  // On every mount: reset state and render captcha
  useEffect(() => {
    setIsProcessingPayment(false)
    setLoading(false)
    setCaptchaToken('')
    setCaptchaReady(false)
    widgetIdRef.current = null

    // hCaptcha script may already be loaded from a previous page visit
    // (Next.js client-side navigation doesn't re-trigger <Script onLoad>).
    // Poll briefly until window.hcaptcha appears, then render.
    let attempts = 0
    const tryRender = () => {
      if ((window as any).hcaptcha && captchaRef.current) {
        renderCaptcha()
        return
      }
      attempts++
      if (attempts < 30) setTimeout(tryRender, 200) // try for up to 6 seconds
    }
    // Small delay to let the DOM ref attach
    setTimeout(tryRender, 100)

    return () => { attempts = 999 } // cancel on unmount
  }, [])

  useEffect(() => {
    // Redirect if cart is empty (but not during payment processing)
    if (items.length === 0 && !isProcessingPayment) {
      const timer = setTimeout(() => {
        if (items.length === 0 && !isProcessingPayment) {
          router.push('/cart')
        }
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [items, router, isProcessingPayment])

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const normalizedCustomerName = String(customerName || '').trim()
    const normalizedCustomerEmail = normalizeEmail(customerEmail)
    const normalizedCustomerPhone = String(customerPhone || '').trim()

    if (!normalizedCustomerName || !normalizedCustomerEmail || !normalizedCustomerPhone) {
      alert('Mohon isi semua data!')
      return
    }

    if (!isValidEmail(normalizedCustomerEmail)) {
      alert('Email tidak valid. Gunakan email aktif agar salinan item bisa dikirim.')
      return
    }

    setLoading(true)
    setIsProcessingPayment(true)

    try {
      // Create transaction
      console.log('Creating checkout request with:', {
        customerName: normalizedCustomerName,
        customerEmail: normalizedCustomerEmail,
        customerPhone: normalizedCustomerPhone,
        itemsCount: items.length,
      })
      
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items,
          customerName: normalizedCustomerName,
          customerEmail: normalizedCustomerEmail,
          customerPhone: normalizedCustomerPhone,
          captchaToken,
        }),
      })

      console.log('Checkout response status:', response.status)
      const data = await response.json()
      console.log('Checkout response data:', data)
      console.log('Has qrString:', !!data.qrString)
      console.log('Has qrUrl:', !!data.qrUrl)

      if (!response.ok) {
        resetCaptcha()
        throw new Error(data.error || 'Gagal membuat transaksi')
      }

      // Direct QRIS Charge response
      if (data.qrString || data.qrUrl) {
        console.log('Processing Direct QRIS response')
        
        // For now, create a simple page to display QRIS
        const qrCodeUrl = data.qrUrl || `https://api.midtrans.com/v2/${data.orderId}/qr/v2`
        console.log('Redirecting to order-pending with qrUrl:', qrCodeUrl)
        
        // Clear cart after successful transaction creation
        clearCart()
        
        // Redirect to order-pending page which will show QRIS
        await router.push(`/order-pending?orderId=${data.orderId}&qrString=${encodeURIComponent(data.qrString || '')}&qrUrl=${encodeURIComponent(data.qrUrl || '')}&transactionId=${encodeURIComponent(data.transactionId || '')}`)
        return
      }

      // Fallback to Snap if it's available
      const snap = (window as any).snap
      if (!snap || !data.snapToken) {
        console.log('Snap not available or no token, proceeding with Direct QRIS response')
        // Direct QRIS is already available, no need for Snap
      } else {
        console.log('Opening Snap payment with token:', data.snapToken)
        
        snap.pay(data.snapToken, {
          onSuccess: function (result: any) {
            console.log('Payment success:', result)
            clearCart()
            router.push(`/order-success?orderId=${data.orderId}`)
          },
          onPending: function (result: any) {
            console.log('Payment pending:', result)
            clearCart()
            router.push(`/order-pending?orderId=${data.orderId}`)
          },
          onError: function (result: any) {
            console.log('Payment error:', result)
            alert('Pembayaran gagal, silakan coba lagi')
            setLoading(false)
          },
          onClose: function () {
            console.log('Snap closed')
            setLoading(false)
            setIsProcessingPayment(false)
          },
        })
        return
      }
    } catch (error: any) {
      console.error('Checkout error:', error)
      alert(error.message || 'Terjadi kesalahan, silakan coba lagi')
      setLoading(false)
      setIsProcessingPayment(false)
      resetCaptcha()
    }
  }

  if (items.length === 0 && !isProcessingPayment) {
    return null
  }

  return (
    <>
      <Script
        src="https://app.midtrans.com/snap/snap.js"
        data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY}
        strategy="afterInteractive"
      />

      <Script
        src="https://js.hcaptcha.com/1/api.js?render=explicit&recaptchacompat=off"
        strategy="afterInteractive"
        onLoad={() => {
          // First-time load: render captcha if ref is ready
          if (captchaRef.current && !(widgetIdRef.current !== null)) {
            renderCaptcha()
          }
        }}
      />

      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Checkout</h1>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Customer Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-6">Informasi Pembeli</h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Nama Lengkap <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Masukkan nama lengkap"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="contoh@email.com"
                    autoComplete="email"
                  />
                  <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-2">
                    Gunakan email yang aktif dan valid. Salinan item digital pembelian akan dikirim ke email ini setelah pembayaran sukses.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">
                    No. Telepon <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="08xxxxxxxxxx"
                  />
                </div>

                <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mt-6">
                  <div className="flex items-start gap-3">
                    <svg className="w-6 h-6 text-primary-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <h3 className="font-semibold text-primary-800 mb-1">
                        Metode Pembayaran: QRIS
                      </h3>
                      <p className="text-sm text-primary-700">
                        Anda akan diarahkan ke halaman pembayaran untuk scan QR code. Pembayaran dapat dilakukan melalui aplikasi e-wallet atau mobile banking.
                      </p>
                    </div>
                  </div>
                </div>

                {/* CAPTCHA */}
                <div className="mt-6">
                  <label className="block text-sm font-semibold mb-2">
                    Verifikasi Keamanan <span className="text-red-500">*</span>
                  </label>
                  <div ref={captchaRef} />
                  <p className="mt-2 text-xs text-gray-600">
                    Selesaikan challenge CAPTCHA untuk melanjutkan pembayaran.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || (!captchaToken && captchaReady)}
                  className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed mt-6"
                >
                  {loading ? 'Memproses...' : !captchaToken && captchaReady ? 'Selesaikan CAPTCHA dulu' : 'Bayar Sekarang'}
                </button>
              </form>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-24">
              <h2 className="text-xl font-bold mb-4">Ringkasan Pesanan</h2>
              
              <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                {items.map((item) => (
                  <div key={item.product.id} className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {item.product.nama}
                      <br />
                      <span className="text-xs text-gray-400">
                        {formatPrice(getItemPrice(item.product))} x {item.quantity}
                      </span>
                    </span>
                    <span className="font-semibold">
                      {formatPrice(getItemPrice(item.product) * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4 mb-4">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Subtotal</span>
                  <span>{formatPrice(total)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Biaya Admin</span>
                  <span>Rp 0</span>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary-600">{formatPrice(total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

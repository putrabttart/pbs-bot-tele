'use client'

import { useCart } from '@/components/CartProvider'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import Script from 'next/script'

export default function CheckoutPage() {
  const { items, total, clearCart } = useCart()
  const router = useRouter()
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [snapLoaded, setSnapLoaded] = useState(false)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)

  useEffect(() => {
    // Reset payment state when page mounts (fresh checkout session)
    setIsProcessingPayment(false)
    setLoading(false)
  }, [])

  useEffect(() => {
    // Redirect if cart is empty (but not during payment processing)
    if (items.length === 0 && !isProcessingPayment) {
      router.push('/cart')
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

    if (!customerName || !customerEmail || !customerPhone) {
      alert('Mohon isi semua data!')
      return
    }

    setLoading(true)
    setIsProcessingPayment(true)

    try {
      // ✅ Create transaction (DO NOT include QR in request data)
      console.log('Creating checkout request with:', {
        customerName,
        customerEmail,
        customerPhone,
        itemsCount: items.length,
      })

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items,  // ← items with product data (harga will be validated server-side)
          customerName,
          customerEmail,
          customerPhone,
        }),
      })

      console.log('Checkout response status:', response.status)
      const data = await response.json()
      console.log('Checkout response:', {
        success: data.success,
        orderId: data.orderId,
        transactionId: data.transactionId,
        amount: data.amount,
        // ✅ NO qrString or qrUrl in response
      })

      if (!response.ok) {
        throw new Error(data.error || 'Gagal membuat transaksi')
      }

      // ✅ SECURITY FIX: Clear cart first, then redirect WITHOUT QR in URL
      clearCart()

      // ✅ Redirect to order-pending WITHOUT qrString/qrUrl in URL
      // Frontend will fetch QR from backend after redirect
      console.log('Redirecting to order-pending...')
      await router.push(`/order-pending?orderId=${data.orderId}&transactionId=${data.transactionId}`)

    } catch (error: any) {
      console.error('Checkout error:', error)
      alert(error.message || 'Terjadi kesalahan, silakan coba lagi')
      setLoading(false)
      setIsProcessingPayment(false)
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
        onLoad={() => setSnapLoaded(true)}
        strategy="afterInteractive"
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
                  />
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

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                  <div className="flex items-start gap-3">
                    <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <h3 className="font-semibold text-blue-800 mb-1">
                        Metode Pembayaran: QRIS
                      </h3>
                      <p className="text-sm text-blue-700">
                        Anda akan diarahkan ke halaman pembayaran untuk scan QR code. Pembayaran dapat dilakukan melalui aplikasi e-wallet atau mobile banking.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed mt-6"
                >
                  {loading ? 'Memproses...' : 'Bayar Sekarang'}
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
                        {formatPrice(item.product.harga)} x {item.quantity}
                      </span>
                    </span>
                    <span className="font-semibold">
                      {formatPrice(item.product.harga * item.quantity)}
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

'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

function OrderPendingInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  // ✅ Only get orderId from URL, NOT qrString/qrUrl
  const orderId = searchParams.get('orderId')
  const transactionId = searchParams.get('transactionId')
  
  const [checking, setChecking] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [timeLeft, setTimeLeft] = useState(15 * 60) // 15 minutes
  const [expiryTs, setExpiryTs] = useState<number | null>(null)
  const [autoCheckCount, setAutoCheckCount] = useState(0)
  const [orderData, setOrderData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // ✅ Fetch order data from backend (including QR if pending)
  useEffect(() => {
    if (!orderId) {
      router.push('/')
      return
    }

    const fetchOrderData = async () => {
      try {
        setLoading(true)
        console.log('[ORDER-PENDING] Fetching order data:', orderId)

        const response = await fetch(`/api/order/${orderId}`)
        
        if (!response.ok) {
          throw new Error('Order not found')
        }

        const data = await response.json()
        console.log('[ORDER-PENDING] Order data received:', {
          orderId: data.order?.orderId,
          status: data.order?.status,
          hasQr: !!data.qr?.qrUrl,
        })

        setOrderData(data.order)

        // ✅ If order is pending and has transaction_id, build QR proxy URL
        if (data.qr?.transactionId) {
          const proxyUrl = `/api/qris/${data.qr.transactionId}`
          console.log('[ORDER-PENDING] Transaction ID from API, proxy URL:', proxyUrl)
          setQrCodeUrl(proxyUrl)

          // Set expiry timestamp
          const expiryKey = `qris_expiry_${orderId}`
          const existing = localStorage.getItem(expiryKey)
          let expiry = existing ? Number(existing) : NaN

          if (!expiry || Number.isNaN(expiry)) {
            expiry = Date.now() + 15 * 60 * 1000
            localStorage.setItem(expiryKey, String(expiry))
          }

          setExpiryTs(expiry)
          console.log('[ORDER-PENDING] QR loaded from backend API')
        } else if (data.order?.status !== 'pending' && data.order?.status !== 'pending_payment' && data.order?.status !== 'unpaid') {
          console.log('[ORDER-PENDING] Order already processed, redirecting...')
          
          if (data.order?.status === 'paid' || data.order?.status === 'completed') {
            router.push(`/order-success?orderId=${orderId}`)
          } else {
            router.push(`/order-failed?orderId=${orderId}`)
          }
        } else {
          console.warn('[ORDER-PENDING] No QR data available')
          setError('Data QR tidak tersedia. Coba muat ulang halaman.')
        }

        setLoading(false)
      } catch (err: any) {
        console.error('[ORDER-PENDING] Error fetching order:', err.message)
        setError('Gagal memuat data pesanan')
        setLoading(false)
      }
    }

    fetchOrderData()
  }, [orderId, router])

  // Countdown timer
  useEffect(() => {
    if (!qrCodeUrl || !expiryTs) return

    const updateTime = () => {
      const diffMs = expiryTs - Date.now()
      const diffSec = Math.max(0, Math.floor(diffMs / 1000))
      setTimeLeft(diffSec)
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [qrCodeUrl, expiryTs])

  // Auto-check payment status every 10 seconds
  useEffect(() => {
    if (!orderId || !transactionId) return

    const checkStatus = async () => {
      try {
        const response = await fetch('/api/payment-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id: orderId,
            transaction_id: transactionId,
          }),
        })

        const data = await response.json()
        console.log('[ORDER-PENDING] Payment status:', data.status)

        if (data.status === 'settlement' || data.status === 'capture') {
          console.log('✅ Payment successful! Redirecting...')
          router.push(`/order-success?orderId=${orderId}`)
        } else if (['cancel', 'deny', 'expire'].includes(data.status)) {
          console.log('❌ Payment failed:', data.status)
          router.push(`/order-failed?orderId=${orderId}&reason=${data.status}`)
        }
        setAutoCheckCount((prev) => prev + 1)
      } catch (error) {
        console.error('[ORDER-PENDING] Auto-check error:', error)
      }
    }

    // Check immediately on mount
    checkStatus()

    // Then check every 10 seconds
    const interval = setInterval(checkStatus, 10000)

    // Clean up after 30 minutes (standard QRIS timeout)
    const timeout = setTimeout(() => {
      clearInterval(interval)
    }, 30 * 60 * 1000)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [orderId, transactionId, router])

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price)
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const handleCancel = async () => {
    if (!window.confirm('Yakin ingin membatalkan pesanan ini?')) return

    setCancelling(true)
    try {
      // TODO: Implement cancel order API
      console.log('[ORDER-PENDING] Cancel order:', orderId)
      alert('Pembatalan sedang diproses...')
      router.push('/')
    } catch (error) {
      console.error('Cancel error:', error)
      alert('Gagal membatalkan pesanan')
      setCancelling(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-slate-200 border-t-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-900 font-semibold text-lg">Memuat data pesanan...</p>
          <p className="text-xs text-slate-500 mt-2">Invoice: {orderId}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
          <div className="flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mx-auto mb-4">
            <span className="text-red-600 text-xl font-bold">!</span>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 text-center mb-2">Terjadi Kesalahan</h3>
          <p className="text-slate-600 text-center mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors active:scale-95"
          >
            Muat Ulang Halaman
          </button>
        </div>
      </div>
    )
  }

  if (!orderId) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          {/* Header Card */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h1 className="text-3xl font-bold text-slate-900 mb-1 text-center">Pembayaran Pending</h1>
            <p className="text-slate-600 text-center ">Invoice #{orderId}</p>
          </div>

          {/* Timer Alert */}
          <div className="bg-green-50 border-2 border-green-300 rounded-xl p-6 mb-8 shadow-sm">
            <div className="text-center">
              <p className="text-sm font-medium text-slate-600 mb-3">Waktu tersisa</p>
              {timeLeft > 0 ? (
                <p className="text-5xl font-mono font-bold text-green-700">{formatTime(timeLeft)}</p>
              ) : (
                <p className="text-3xl font-bold text-red-600">Waktu Expired</p>
              )}
            </div>
          </div>

          {/* QR Code Section */}
          {qrCodeUrl && (
            <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
              <h3 className="text-lg font-semibold text-center text-slate-900 mb-6">QR Code Pembayaran</h3>
              <div className="flex justify-center mb-6">
                <div className="bg-gray-100 p-4 rounded-lg border-2 border-gray-200">
                  <img
                    src={qrCodeUrl}
                    alt="QRIS QR Code"
                    width={280}
                    height={280}
                    className="rounded"
                  />
                </div>
              </div>
              <p className="text-center text-slate-600 text-sm mb-6">
                Silakan scan QR Code QRIS di bawah menggunakan aplikasi e-wallet atau mobile banking Anda.
              </p>
              
              {/* Amount Box */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-4 text-center">
                <p className="text-xs font-medium text-slate-600 mb-1">Total Pembayaran</p>
                <p className="text-2xl font-bold text-blue-900">
                  {orderData?.total_amount ? formatPrice(orderData.total_amount) : 'Rp 0'}
                </p>
              </div>
            </div>
          )}

          {/* Order Details */}
          {orderData && (
            <div className="bg-white rounded-xl shadow-md p-6 mb-8">
              <h3 className="text-lg font-semibold text-slate-900 mb-6 pb-4 border-b-2 border-gray-200">Detail Pesanan</h3>

              {/* Customer Info */}
              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-slate-600 font-medium">Nama Pemesan</span>
                  <span className="text-slate-900 font-semibold">{orderData.customer_name || '-'}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-slate-600 font-medium">Email</span>
                  <span className="text-slate-900 text-sm font-semibold">{orderData.customer_email || '-'}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-600 font-medium">Nomor Telepon</span>
                  <span className="text-slate-900 font-semibold">{orderData.customer_phone || '-'}</span>
                </div>
              </div>

              {/* Items List */}
              {orderData.items && orderData.items.length > 0 && (
                <div className="border-t-2 border-gray-200 pt-6">
                  <h4 className="font-semibold text-slate-900 mb-4">Produk</h4>
                  <div className="space-y-3">
                    {orderData.items.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center py-3 border-b border-gray-100 last:border-0">
                        <div>
                          <p className="text-slate-900 font-medium">{item.product_name || 'Produk'}</p>
                          <p className="text-slate-500 text-sm">Jumlah: {item.quantity} unit</p>
                        </div>
                        <p className="text-slate-900 font-bold whitespace-nowrap ml-4">
                          {formatPrice(item.price * item.quantity)}
                        </p>
                      </div>
                    ))}
                  </div>
                  
                  {/* Total */}
                  <div className="flex justify-between items-center mt-6 pt-6 border-t-2 border-gray-200">
                    <span className="text-lg font-semibold text-slate-900">Total:</span>
                    <span className="text-2xl font-bold text-blue-600">{formatPrice(orderData.total_amount)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-center">
            <p className="text-sm text-blue-900">
              <span className="font-semibold block mb-1">Status Pembayaran Otomatis</span>
              Kami akan mengecek status pembayaran Anda setiap 10 detik. Halaman akan otomatis diperbarui saat pembayaran berhasil.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 mb-8">
            <button
              onClick={() => window.location.reload()}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors active:scale-95 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Status
            </button>
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="flex-1 bg-red-100 text-red-700 py-3 rounded-lg font-semibold hover:bg-red-200 transition-colors disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              {cancelling ? 'Membatalkan...' : 'Batalkan Pesanan'}
            </button>
          </div>

          {/* Footer */}
          <div className="text-center text-sm text-slate-500">
            <p>
              Jika QR Code sudah expired, silakan{' '}
              <Link href="/cart" className="text-blue-600 hover:underline font-semibold">
                kembali ke keranjang
              </Link>{' '}
              dan buat pesanan baru.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function OrderPendingPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <OrderPendingInner />
    </Suspense>
  )
}

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

        // ✅ If order is pending and has QR from API, display it
        if (data.qr?.qrUrl) {
          setQrCodeUrl(data.qr.qrUrl)

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
      <div className="container mx-auto px-4 py-8 flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p>Memuat data pesanan...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700"
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
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Pembayaran Pending</h1>
          <p className="text-gray-600">Order #{orderId}</p>
        </div>

        {/* Status Card */}
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="animate-pulse bg-yellow-400 w-3 h-3 rounded-full"></div>
            <h2 className="text-lg font-semibold text-yellow-800">Menunggu Pembayaran</h2>
          </div>
          <p className="text-yellow-700 mb-2">
            Silakan scan QR Code di bawah menggunakan aplikasi e-wallet atau mobile banking Anda.
          </p>
          {timeLeft > 0 && (
            <p className="text-sm text-yellow-600">
              Waktu tersisa: <span className="font-mono font-bold">{formatTime(timeLeft)}</span>
            </p>
          )}
        </div>

        {/* QR Code Display */}
        {qrCodeUrl && (
          <div className="bg-white rounded-lg shadow-lg p-8 mb-6 text-center">
            <h3 className="text-lg font-semibold mb-4">QR Code QRIS</h3>
            <div className="flex justify-center mb-4">
              <img
                src={qrCodeUrl}
                alt="QRIS QR Code"
                width={300}
                height={300}
                className="border-2 border-gray-200 rounded-lg"
              />
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Scan dengan kamera atau aplikasi pembayaran Anda
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-700 font-medium">
                Total Pembayaran: <br />
                <span className="text-2xl text-blue-900 font-bold">
                  {orderData?.totalAmount ? formatPrice(orderData.totalAmount) : 'Loading...'}
                </span>
              </p>
            </div>
          </div>
        )}

        {/* Order Details */}
        {orderData && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Detail Pesanan</h3>

            <div className="space-y-3 mb-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Nama</span>
                <span className="font-semibold">{orderData.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Email</span>
                <span className="font-semibold text-sm">{orderData.customerEmail}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Jumlah Items</span>
                <span className="font-semibold">
                  {orderData.items?.length || 0} produk
                </span>
              </div>
            </div>

            {orderData.items && orderData.items.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3 text-sm">Item Pesanan:</h4>
                <div className="space-y-2">
                  {orderData.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        {item.product_name} × {item.quantity}
                      </span>
                      <span className="font-semibold">
                        {formatPrice(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Auto Check Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-center">
          <p className="text-sm text-blue-700">
            ✅ Kami otomatis mengecek status pembayaran setiap 10 detik.
            <br />
            Halaman akan otomatis update saat pembayaran diterima.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={() => window.location.reload()}
            className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            🔄 Refresh Status
          </button>
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="flex-1 bg-red-100 text-red-700 py-3 rounded-lg font-semibold hover:bg-red-200 transition-colors disabled:opacity-50"
          >
            {cancelling ? 'Membatalkan...' : '❌ Batalkan'}
          </button>
        </div>

        {/* Footer Note */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            Jika QRIS sudah expired, silakan{' '}
            <Link href="/cart" className="text-primary-600 hover:underline">
              kembali ke keranjang
            </Link>{' '}
            dan buat pesanan baru.
          </p>
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

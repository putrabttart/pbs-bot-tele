"use client";
import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

function OrderPendingInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const orderId = searchParams.get('orderId')
  const qrString = searchParams.get('qrString')
  const qrUrl = searchParams.get('qrUrl')
  const transactionId = searchParams.get('transactionId')
  const [checking, setChecking] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [timeLeft, setTimeLeft] = useState(15 * 60) // 15 minutes in seconds (default)
  const [expiryTs, setExpiryTs] = useState<number | null>(null)
  const [autoCheckCount, setAutoCheckCount] = useState(0)

  useEffect(() => {
    if (!orderId) {
      router.push('/')
    }

    // Generate QR code image if qrString exists
    if (qrString) {
      // Use a QR code API to generate image from string
      const encodedQr = encodeURIComponent(qrString)
      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodedQr}`
      setQrCodeUrl(qrImageUrl)

      // Persist expiry timestamp per order to survive refresh
      const expiryKey = `qris_expiry_${orderId}`
      const existing = expiryKey ? localStorage.getItem(expiryKey) : null
      let expiry = existing ? Number(existing) : NaN

      // If no stored expiry or invalid, set new 15 minutes from now
      if (!expiry || Number.isNaN(expiry)) {
        expiry = Date.now() + 15 * 60 * 1000
        if (expiryKey) {
          localStorage.setItem(expiryKey, String(expiry))
        }
      }

      setExpiryTs(expiry)
    }
  }, [orderId, qrString, router])

  // Countdown timer based on persisted expiry
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
    if (!orderId && !transactionId) return

    const checkStatus = async () => {
      try {
        const response = await fetch('/api/payment-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            order_id: orderId,
            transaction_id: transactionId 
          }),
        })

        const data = await response.json()

        if (data.status === 'settlement' || data.status === 'capture') {
          console.log('✅ Payment successful! Redirecting...')
          router.push(`/order-success?orderId=${orderId}`)
        } else if (data.status === 'cancel' || data.status === 'deny' || data.status === 'expire') {
          console.log('❌ Payment failed:', data.status)
          router.push(`/order-failed?orderId=${orderId}&reason=${data.status}`)
        }
        // If still pending, continue polling
        setAutoCheckCount(prev => prev + 1)
      } catch (error) {
        console.error('Auto-check error:', error)
      }
    }

    // Check immediately on mount
    checkStatus()

    // Then check every 10 seconds
    const interval = setInterval(checkStatus, 10000)

    return () => clearInterval(interval)
  }, [orderId, transactionId, router])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const downloadQRCode = async () => {
    const sourceUrl = qrUrl || qrCodeUrl
    if (!sourceUrl) return

    const triggerDownload = (blob: Blob) => {
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `QRIS-${orderId || 'payment'}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)
    }

    try {
      // Try direct fetch (works if CORS allowed)
      const res = await fetch(sourceUrl, { mode: 'cors' })
      if (res.ok) {
        const blob = await res.blob()
        triggerDownload(blob)
        return
      }
      throw new Error(`Fetch failed with status ${res.status}`)
    } catch (err) {
      console.warn('Fetch download failed, trying canvas workaround:', err)
    }

    try {
      // Canvas fallback (requires CORS-enabled image)
      const img = document.createElement('img')
      img.crossOrigin = 'anonymous'
      img.src = `${sourceUrl}${sourceUrl.includes('?') ? '&' : '?'}_=${Date.now()}`

      await new Promise((resolve, reject) => {
        img.onload = () => resolve(null)
        img.onerror = reject
      })

      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas context not available')
      ctx.drawImage(img, 0, 0)

      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve))
      if (blob) {
        triggerDownload(blob)
        return
      }
      throw new Error('Failed to convert canvas to blob')
    } catch (err) {
      console.error('Canvas download failed:', err)
    }

    // Last fallback: open the image in same tab for manual save
    const link = document.createElement('a')
    link.href = sourceUrl
    link.download = `QRIS-${orderId || 'payment'}.png`
    link.target = '_self'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
  const handleCancelOrder = async () => {
    if (!orderId) return

    const confirmed = confirm('Apakah Anda yakin ingin membatalkan pesanan ini? Stok akan dikembalikan dan Anda perlu checkout ulang.')
    if (!confirmed) return

    setCancelling(true)
    try {
      const response = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok) {
        alert('✓ Pesanan dibatalkan dan stok telah dikembalikan.')
        router.push('/cart')
      } else {
        alert('Gagal membatalkan pesanan: ' + (data.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Error cancelling order:', error)
      alert('Terjadi kesalahan saat membatalkan pesanan.')
    } finally {
      setCancelling(false)
    }
  }
  const checkPaymentStatus = async () => {
    if (!orderId && !transactionId) return
    
    setChecking(true)
    try {
      const response = await fetch('/api/payment-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          order_id: orderId,
          transaction_id: transactionId 
        }),
      })

      const data = await response.json()

      if (data.status === 'settlement' || data.status === 'capture') {
        console.log('✅ Payment successful!')
        alert('✅ Pembayaran berhasil! Pesanan Anda akan segera diproses.')
        router.push(`/order-success?orderId=${orderId}`)
      } else if (data.status === 'cancel' || data.status === 'deny' || data.status === 'expire') {
        console.log('❌ Payment failed:', data.status)
        router.push(`/order-failed?orderId=${orderId}&reason=${data.status}`)
      } else if (data.status === 'pending') {
        alert('⏳ Pembayaran masih pending. Mohon tunggu atau coba lagi dalam beberapa saat.')
      } else {
        alert('Status pembayaran: ' + (data.statusMessage || data.status))
      }
    } catch (error) {
      console.error('Error checking status:', error)
      alert('Gagal memeriksa status pembayaran. Mohon coba lagi.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-6 md:py-12 pb-24 md:pb-12">
      <div className="max-w-2xl mx-auto">
        {qrCodeUrl && qrString ? (
          // QRIS Payment Display
          <div className="bg-white rounded-lg shadow-md p-4 md:p-8">
            <h1 className="text-2xl md:text-3xl font-bold text-center mb-6 md:mb-8">Selesaikan Pembayaran QRIS</h1>
            
            <div className="space-y-4 md:space-y-6">
              {/* Countdown Timer */}
              <div className={`rounded-lg p-4 md:p-6 text-center border-2 ${
                timeLeft > 300 
                  ? 'bg-blue-50 border-blue-200' 
                  : timeLeft > 60
                  ? 'bg-yellow-50 border-yellow-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <p className={`text-sm font-medium mb-2 ${
                  timeLeft > 300 
                    ? 'text-blue-700' 
                    : timeLeft > 60
                    ? 'text-yellow-700'
                    : 'text-red-700'
                }`}>
                  Waktu Tersisa
                </p>
                <p className={`text-3xl md:text-4xl font-bold font-mono ${
                  timeLeft > 300 
                    ? 'text-blue-600' 
                    : timeLeft > 60
                    ? 'text-yellow-600'
                    : 'text-red-600'
                }`}>
                  {formatTime(timeLeft)}
                </p>
                <p className="text-xs md:text-sm text-gray-600 mt-2">
                  QR Code akan kedaluwarsa dalam waktu di atas
                </p>
              </div>

              {/* QR Code */}
              <div className="bg-gray-50 rounded-lg p-4 md:p-6 text-center">
                <p className="text-gray-600 mb-4 text-sm md:text-base">Scan QR Code dengan aplikasi pembayaran Anda</p>
                <div className="relative inline-block justify-center">
                  <img 
                    src={qrCodeUrl} 
                    alt="QRIS QR Code" 
                    className="w-64 h-64 md:w-80 md:h-80 border-2 border-gray-200 rounded-lg"
                  />
                </div>
              </div>

              {/* Order Info */}
              <div className="bg-gray-50 rounded-lg p-3 md:p-4 space-y-2 text-sm md:text-base">
                <div className="flex justify-between">
                  <span className="text-gray-600">ID Pesanan:</span>
                  <span className="font-mono font-bold text-xs md:text-base break-all">{orderId}</span>
                </div>
                {transactionId && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Transaction ID:</span>
                    <span className="font-mono font-bold text-xs md:text-sm break-all">{transactionId}</span>
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2 text-sm md:text-base">Cara Pembayaran:</h3>
                <ol className="text-xs md:text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>Buka aplikasi e-wallet atau mobile banking Anda</li>
                  <li>Pilih fitur "Scan QRIS" atau "Bayar dengan QRIS"</li>
                  <li>Arahkan kamera ke QR Code di atas</li>
                  <li>Verifikasi nominal dan informasi penjual</li>
                  <li>Selesaikan pembayaran dengan PIN atau biometrik Anda</li>
                </ol>
              </div>

              {/* Buttons */}
              <div className="space-y-3">
                <button
                  onClick={downloadQRCode}
                  className="w-full bg-gray-600 text-white py-2.5 md:py-3 rounded-lg font-semibold hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 text-sm md:text-base"
                >
                  <i className="fa-solid fa-download"></i>
                  Download QRIS
                </button>

                <button
                  onClick={checkPaymentStatus}
                  disabled={checking}
                  className="w-full bg-primary-600 text-white py-2.5 md:py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:bg-gray-400 text-sm md:text-base"
                >
                  {checking ? (
                    <>
                      <i className="fa-solid fa-spinner animate-spin mr-2"></i>
                      Memeriksa...
                    </>
                  ) : (
                    '✓ Sudah Membayar? Cek Status'
                  )}
                </button>
                
                <button
                  onClick={handleCancelOrder}
                  disabled={cancelling}
                  className="w-full bg-red-500 text-white py-2.5 md:py-3 rounded-lg font-semibold hover:bg-red-600 transition-colors disabled:bg-gray-400 text-sm md:text-base flex items-center justify-center gap-2"
                >
                  {cancelling ? (
                    <>
                      <i className="fa-solid fa-spinner animate-spin"></i>
                      Membatalkan...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-ban"></i>
                      Batalkan Pesanan
                    </>
                  )}
                </button>
                
                <Link
                  href="/"
                  className="block w-full bg-white border-2 border-gray-300 text-gray-700 py-2.5 md:py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors text-center text-sm md:text-base"
                >
                  Kembali ke Beranda
                </Link>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-xs md:text-sm text-yellow-800">
                <p className="font-semibold mb-1">⏱️ Penting:</p>
                <p>QR Code ini berlaku selama 15 menit. Jika waktu habis, silakan melakukan checkout ulang.</p>
                <div className="mt-3 pt-3 border-t border-yellow-300 flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span>Status pembayaran dicek otomatis setiap 10 detik</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Fallback: Generic Pending Payment
          <div className="max-w-md mx-auto text-center bg-white rounded-lg shadow-md p-6 md:p-8">
            {/* Pending Icon */}
            <div className="w-16 h-16 md:w-20 md:h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6">
              <svg
                className="w-10 h-10 md:w-12 md:h-12 text-yellow-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>

            <h1 className="text-2xl md:text-3xl font-bold text-yellow-600 mb-2">
              Menunggu Pembayaran
            </h1>
            <p className="text-sm md:text-base text-gray-600 mb-4 md:mb-6">
              Pesanan Anda sedang menunggu pembayaran. Silakan selesaikan pembayaran untuk melanjutkan.
            </p>

            {orderId && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4 md:mb-6">
                <p className="text-xs md:text-sm text-gray-600 mb-1">ID Pesanan</p>
                <p className="text-lg md:text-xl font-mono font-bold break-all">{orderId}</p>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={checkPaymentStatus}
                disabled={checking}
                className="w-full bg-primary-600 text-white py-2.5 md:py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:bg-gray-400 text-sm md:text-base"
              >
                {checking ? 'Memeriksa...' : 'Cek Status Pembayaran'}
              </button>
              
              <Link
                href="/"
                className="block w-full bg-white border-2 border-gray-300 text-gray-700 py-2.5 md:py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors text-sm md:text-base"
              >
                Kembali ke Beranda
              </Link>
            </div>

            <div className="mt-6 md:mt-8 pt-4 md:pt-6 border-t text-left">
              <h3 className="font-semibold text-sm md:text-base mb-2">Catatan:</h3>
              <ul className="text-xs md:text-sm text-gray-600 space-y-1">
                <li>• Selesaikan pembayaran dalam waktu yang ditentukan</li>
                <li>• Jika sudah membayar, klik tombol "Cek Status Pembayaran"</li>
                <li>• Pesanan akan otomatis dibatalkan jika tidak dibayar</li>
              </ul>
            </div>
          </div>
        )}
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

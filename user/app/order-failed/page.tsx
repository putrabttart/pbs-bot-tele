'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function OrderFailed() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const orderId = searchParams.get('orderId')
  const reason = searchParams.get('reason') || 'unknown'
  const [releasing, setReleasing] = useState(false)

  useEffect(() => {
    if (!orderId) {
      router.push('/')
    }
  }, [orderId, router])

  const handleReleaseStock = async () => {
    if (!orderId) return

    setReleasing(true)
    try {
      const response = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok) {
        alert('✓ Stok produk telah dikembalikan. Anda bisa checkout ulang.')
        router.push('/cart')
      } else {
        alert('Gagal mengembalikan stok: ' + (data.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Error releasing stock:', error)
      alert('Terjadi kesalahan saat mengembalikan stok.')
    } finally {
      setReleasing(false)
    }
  }

  const getReasonText = () => {
    switch (reason.toLowerCase()) {
      case 'cancel':
        return 'Pembayaran Dibatalkan'
      case 'deny':
        return 'Pembayaran Ditolak'
      case 'expire':
        return 'Pembayaran Kadaluwarsa'
      default:
        return 'Pembayaran Gagal'
    }
  }

  const getReasonDescription = () => {
    switch (reason.toLowerCase()) {
      case 'cancel':
        return 'Pembayaran Anda telah dibatalkan. Jika ini tidak disengaja, silakan coba checkout ulang.'
      case 'deny':
        return 'Pembayaran Anda ditolak oleh sistem pembayaran. Silakan periksa saldo atau coba metode pembayaran lain.'
      case 'expire':
        return 'Waktu pembayaran telah habis. QR Code QRIS berlaku selama 15 menit.'
      default:
        return 'Terjadi masalah dengan pembayaran Anda. Silakan coba lagi.'
    }
  }

  return (
    <div className="container mx-auto px-4 py-6 md:py-12 pb-24 md:pb-12">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg border border-[#e5e7ff] p-6 md:p-8">
          {/* Failed Icon */}
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="fa-solid fa-circle-xmark text-5xl text-red-500"></i>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-red-600 text-center mb-3">
            {getReasonText()}
          </h1>

          {/* Description */}
          <p className="text-center text-[#374151] mb-6">
            {getReasonDescription()}
          </p>

          {/* Order Info */}
          {orderId && (
            <div className="bg-[#f4f5ff] rounded-xl p-4 mb-6 border border-[#e5e7ff]">
              <div className="flex justify-between items-center">
                <span className="text-sm text-[#6b7280]">ID Pesanan:</span>
                <span className="font-mono font-bold text-[#141a33] break-all">{orderId}</span>
              </div>
            </div>
          )}

          {/* Status Badge */}
          <div className="flex justify-center mb-6">
            <span className="px-4 py-2 rounded-full bg-red-100 text-red-700 text-sm font-semibold">
              Status: {reason.toUpperCase()}
            </span>
          </div>

          {/* Important Notice */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <i className="fa-solid fa-triangle-exclamation text-yellow-600 text-xl mt-0.5"></i>
              <div>
                <h3 className="font-semibold text-yellow-900 mb-2">Penting!</h3>
                <p className="text-sm text-yellow-800 mb-3">
                  Produk yang Anda pesan masih dalam status reserved. Untuk mengembalikan stok agar bisa dibeli customer lain atau Anda checkout ulang, klik tombol "Kembalikan Stok" di bawah.
                </p>
                <p className="text-xs text-yellow-700">
                  Jika tidak dikembalikan, stok akan otomatis dirilis setelah 30 menit.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleReleaseStock}
              disabled={releasing}
              className="w-full bg-gradient-to-r from-[#5c63f2] to-[#7b5cf7] text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {releasing ? (
                <>
                  <i className="fa-solid fa-spinner animate-spin"></i>
                  Memproses...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-rotate-left"></i>
                  Kembalikan Stok & Coba Lagi
                </>
              )}
            </button>

            <Link
              href="/cart"
              className="block w-full bg-white border-2 border-[#e5e7ff] text-[#1c2340] py-3 rounded-xl font-semibold hover:bg-[#f4f5ff] transition-colors text-center"
            >
              <i className="fa-solid fa-cart-shopping mr-2"></i>
              Lihat Keranjang
            </Link>

            <Link
              href="/"
              className="block w-full bg-white border-2 border-[#e5e7ff] text-[#6b7280] py-3 rounded-xl font-semibold hover:bg-gray-50 transition-colors text-center"
            >
              Kembali ke Beranda
            </Link>
          </div>

          {/* Help Section */}
          <div className="mt-8 pt-6 border-t border-[#e5e7ff]">
            <h3 className="font-semibold text-[#141a33] mb-3 text-center">Butuh Bantuan?</h3>
            <p className="text-sm text-[#6b7280] text-center mb-4">
              Jika Anda mengalami kendala atau memiliki pertanyaan, hubungi admin kami
            </p>
            <a
              href="https://wa.me/6282340915319?text=Halo%20min%2C%20saya%20mengalami%20masalah%20dengan%20pembayaran%20order%20"
              target="_blank"
              className="flex items-center justify-center gap-2 w-full bg-[#25D366] text-white py-3 rounded-xl font-semibold hover:bg-[#20ba5a] transition-colors"
            >
              <i className="fa-brands fa-whatsapp text-xl"></i>
              Chat Admin via WhatsApp
            </a>
          </div>

          {/* Timeline Info */}
          <div className="mt-6 bg-[#f4f5ff] rounded-xl p-4 border border-[#e5e7ff]">
            <h4 className="font-semibold text-sm text-[#141a33] mb-3">Apa yang terjadi selanjutnya?</h4>
            <div className="space-y-2 text-sm text-[#374151]">
              <div className="flex items-start gap-2">
                <i className="fa-solid fa-circle-check text-[#5c63f2] mt-0.5"></i>
                <span>Klik "Kembalikan Stok" untuk melepas reserved items</span>
              </div>
              <div className="flex items-start gap-2">
                <i className="fa-solid fa-circle-check text-[#5c63f2] mt-0.5"></i>
                <span>Produk akan kembali tersedia untuk dibeli</span>
              </div>
              <div className="flex items-start gap-2">
                <i className="fa-solid fa-circle-check text-[#5c63f2] mt-0.5"></i>
                <span>Anda bisa checkout ulang dengan item yang sama atau berbeda</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

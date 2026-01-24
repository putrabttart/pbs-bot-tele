'use client'

import { useCart } from '@/components/CartProvider'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function CartPage() {
  const { items, updateQuantity, removeFromCart, total } = useCart()
  const router = useRouter()

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price)
  }

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8 md:py-12 pb-24 md:pb-12">
        <div className="max-w-md mx-auto text-center bg-white rounded-lg shadow-md p-6 md:p-8">
          <div className="w-20 h-20 md:w-24 md:h-24 mx-auto mb-4 md:mb-6 bg-gray-100 rounded-full flex items-center justify-center">
            <i className="fa-solid fa-cart-shopping text-4xl md:text-5xl text-gray-300"></i>
          </div>
          <h2 className="text-xl md:text-2xl font-bold mb-2">Keranjang Kosong</h2>
          <p className="text-sm md:text-base text-gray-600 mb-4 md:mb-6">
            Belum ada produk di keranjang Anda
          </p>
          <Link
            href="/"
            className="inline-block bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors text-sm md:text-base"
          >
            Mulai Belanja
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 md:py-8">
      <h1 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8">Keranjang Belanja</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-3 md:space-y-4">
          {items.map((item) => (
            <div
              key={item.product.id}
              className="bg-white rounded-lg shadow-md p-3 md:p-4 flex flex-col sm:flex-row gap-3 md:gap-4"
            >
              {/* Product Image */}
              <div className="relative w-full sm:w-24 md:w-28 h-48 sm:h-24 md:h-28 flex-shrink-0 bg-gradient-to-br from-[#f2f3ff] via-white to-[#ecebff] rounded-lg overflow-hidden flex items-center justify-center p-3 sm:p-2">
                {item.product.ikon ? (
                  <Image
                    src={item.product.ikon}
                    alt={item.product.nama}
                    fill
                    className="object-contain p-2"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#8c95ff]">
                    <i className="fa-solid fa-box-archive text-5xl sm:text-3xl md:text-4xl"></i>
                  </div>
                )}
              </div>

              {/* Product Info & Controls */}
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <Link
                    href={`/product/${item.product.id}`}
                    className="font-semibold text-base md:text-lg hover:text-primary-600 line-clamp-2"
                  >
                    {item.product.nama}
                  </Link>
                  {item.product.kategori && (
                    <p className="text-xs md:text-sm text-gray-500 mt-1">{item.product.kategori}</p>
                  )}
                  <p className="text-primary-600 font-bold mt-2">
                    {formatPrice(item.product.harga)}
                  </p>
                </div>

                {/* Bottom Row: Quantity & Delete */}
                <div className="flex items-center justify-between mt-3 md:mt-2">
                  <div className="flex items-center gap-1 md:gap-2 bg-gray-50 rounded-lg p-1">
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                      className="w-8 h-8 md:w-9 md:h-9 rounded border border-gray-300 hover:bg-gray-200 flex items-center justify-center text-sm font-semibold transition-colors"
                    >
                      −
                    </button>
                    <span className="w-8 md:w-10 text-center font-semibold text-sm">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      disabled={item.quantity >= item.product.stok}
                      className="w-8 h-8 md:w-9 md:h-9 rounded border border-gray-300 hover:bg-gray-200 flex items-center justify-center text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      +
                    </button>
                  </div>

                  <div className="text-right flex flex-col items-end gap-2">
                    <p className="font-bold text-base md:text-lg">
                      {formatPrice(item.product.harga * item.quantity)}
                    </p>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-red-500 hover:text-red-700 text-sm font-medium transition-colors flex items-center gap-1"
                    >
                      <i className="fa-solid fa-trash-can text-sm"></i>
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-md p-4 md:p-6 sticky top-20 md:top-24">
            <h2 className="text-lg md:text-xl font-bold mb-4">Ringkasan Belanja</h2>
            
            <div className="space-y-2 md:space-y-3 mb-4 max-h-48 md:max-h-64 overflow-y-auto">
              {items.map((item) => (
                <div key={item.product.id} className="flex justify-between text-xs md:text-sm">
                  <span className="text-gray-600 line-clamp-1">
                    {item.product.nama} (x{item.quantity})
                  </span>
                  <span className="font-semibold flex-shrink-0 ml-2">
                    {formatPrice(item.product.harga * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t pt-4 mb-4 md:mb-6">
              <div className="flex justify-between text-base md:text-lg font-bold">
                <span>Total</span>
                <span className="text-primary-600">{formatPrice(total)}</span>
              </div>
            </div>

            <button
              onClick={() => router.push('/checkout')}
              className="w-full bg-primary-600 text-white py-2.5 md:py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors text-sm md:text-base"
            >
              Lanjut ke Pembayaran
            </button>

            <Link
              href="/"
              className="block text-center text-primary-600 text-sm md:text-base mt-3 md:mt-4 hover:underline"
            >
              Lanjut Belanja
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

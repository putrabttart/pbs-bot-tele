'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { Database } from '@/lib/database.types'
import { useCart } from './CartProvider'

type Product = Database['public']['Tables']['products']['Row']

interface ProductCardProps {
  product: Product
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = useCart()
  const [imgError, setImgError] = useState(false)
  const Swal = typeof window !== 'undefined' ? (window as any).Swal : null

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price)
  }

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault()

    if (product.stok === 0) {
      Swal?.fire({
        icon: 'error',
        title: 'Stok habis',
        text: 'Produk sudah tidak tersedia.',
        confirmButtonColor: '#5c63f2',
      })
      return
    }

    addToCart(product, 1)

    Swal?.fire({
      icon: 'success',
      title: 'Ditambahkan ke keranjang',
      text: `${product.nama}`,
      timer: 1500,
      showConfirmButton: false,
    })
  }

  return (
    <Link href={`/product/${product.id}`}>
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-xl transition-all duration-300 h-full flex flex-col group border border-[#e5e7ff] hover:-translate-y-2">
        {/* Product Image */}
        <div className="relative h-48 bg-gradient-to-br from-[#f2f3ff] via-white to-[#ecebff] overflow-hidden flex items-center justify-center p-4">
          {product.ikon && !imgError ? (
            <Image
              src={product.ikon}
              alt={product.nama}
              width={150}
              height={150}
              className="object-contain group-hover:scale-110 transition-transform duration-300"
              onError={() => setImgError(true)}
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[#8c95ff]">
              <i className="fa-solid fa-box-archive text-5xl"></i>
            </div>
          )}

          {/* Top Accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#5c63f2] via-[#7b5cf7] to-[#4f5be6]"></div>

          {/* Category Badge */}
          {product.kategori && (
            <div className="absolute top-3 right-3 bg-gradient-to-r from-[#5c63f2] to-[#7b5cf7] text-white px-3 py-1 rounded-full text-xs font-semibold shadow-md">
              <i className="fa-solid fa-layer-group mr-1"></i>
              {product.kategori}
            </div>
          )}

          {/* Stock Badge */}
          <div className="absolute bottom-3 left-3 text-xs font-semibold px-3 py-1 rounded-full shadow-md flex items-center gap-1 bg-white/90 text-[#1c2340] border border-[#e5e7ff]">
            <i className="fa-solid fa-boxes-stacked"></i>
            Stok {product.stok}
          </div>
        </div>

        {/* Product Info */}
        <div className="p-5 flex-1 flex flex-col">
          {/* Product Name */}
          <h3 className="font-bold text-lg mb-2 line-clamp-2 text-[#141a33] group-hover:text-[#5c63f2] transition-colors">
            {product.nama}
          </h3>

          {/* Description */}
          <p className="text-[#6b7280] text-sm mb-3 italic">
            Klik Detail untuk menampilkan detail produk
          </p>

          {/* Stock */}
          {product.stok > 0 && (
            <div className="flex items-center gap-2 text-xs font-semibold text-[#1c2340] mb-3">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#eef0ff] text-[#3c3fa8]">
                <i className="fa-solid fa-boxes-stacked"></i>
                Stok {product.stok}
              </span>
            </div>
          )}

          {/* Price and Action */}
          <div className="mt-auto">
            <div className="flex items-baseline gap-2 mb-3">
              <p className="text-2xl font-extrabold bg-gradient-to-r from-[#5c63f2] to-[#7b5cf7] bg-clip-text text-transparent">
                {formatPrice(product.harga)}
              </p>
            </div>

            <div className="flex gap-2">
              <Link
                href={`/product/${product.id}`}
                className="px-4 py-2.5 rounded-lg font-semibold border border-[#e5e7ff] text-[#1c2340] bg-white hover:bg-[#f4f5ff] transition-all"
              >
                <span className="inline-flex items-center gap-2">
                  <i className="fa-solid fa-circle-info"></i>
                  Detail
                </span>
              </Link>
              <button
                onClick={handleAddToCart}
                disabled={product.stok === 0}
                className={`flex-1 py-2.5 px-4 rounded-lg font-bold transition-all transform ${
                  product.stok === 0
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-[#5c63f2] to-[#7b5cf7] text-white shadow-md hover:shadow-lg hover:scale-[1.02]'
                }`}
              >
                <span className="inline-flex items-center gap-2 justify-center">
                  <i className="fa-solid fa-cart-plus"></i>
                  {product.stok === 0 ? 'Habis' : 'Tambah'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}

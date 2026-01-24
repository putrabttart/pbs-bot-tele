'use client'

import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { useCart } from '@/components/CartProvider'
import { Database } from '@/lib/database.types'

type Product = Database['public']['Tables']['products']['Row']

export default function ProductDetail() {
  const params = useParams()
  const router = useRouter()
  const { addToCart } = useCart()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    fetchProduct()
  }, [params.id])

  async function fetchProduct() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', params.id)
        .single()

      if (error) throw error
      setProduct(data)
    } catch (error) {
      console.error('Error fetching product:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price)
  }

  const handleAddToCart = () => {
    if (product) {
      addToCart(product, quantity)
      
      // Show toast notification
      const toast = document.createElement('div')
      toast.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50'
      toast.textContent = `${quantity} produk ditambahkan ke keranjang!`
      document.body.appendChild(toast)
      
      setTimeout(() => {
        toast.remove()
      }, 2000)
      
      setQuantity(1)
    }
  }

  const handleBuyNow = () => {
    if (product) {
      addToCart(product, quantity)
      router.push('/cart')
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-gray-200 h-96 rounded-lg"></div>
            <div className="space-y-4">
              <div className="h-8 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-20 bg-gray-200 rounded"></div>
              <div className="h-10 bg-gray-200 rounded w-1/3"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Produk tidak ditemukan</h1>
          <button
            onClick={() => router.push('/')}
            className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700"
          >
            Kembali ke Katalog
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="mb-6 text-sm text-gray-600">
        <button onClick={() => router.push('/')} className="hover:text-primary-600">
          Katalog
        </button>
        {product.kategori && (
          <>
            <span className="mx-2">/</span>
            <span>{product.kategori}</span>
          </>
        )}
        <span className="mx-2">/</span>
        <span className="text-gray-900">{product.nama}</span>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Product Image */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#e5e7ff] p-8 flex items-center justify-center">
          <div className="relative w-full max-w-md h-96">
            {product.ikon ? (
              <div className="w-full h-full rounded-2xl bg-gradient-to-br from-[#f2f3ff] via-white to-[#ecebff] p-8 flex items-center justify-center">
                <Image
                  src={product.ikon}
                  alt={product.nama}
                  width={400}
                  height={400}
                  className="object-contain w-full h-full"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                    const parent = target.parentElement
                    if (parent) {
                      parent.innerHTML = '<div class="w-full h-full flex items-center justify-center"><i class="fa-solid fa-box-archive text-[8rem] text-[#8c95ff]"></i></div>'
                    }
                  }}
                />
              </div>
            ) : (
              <div className="w-full h-full rounded-2xl bg-gradient-to-br from-[#f2f3ff] via-white to-[#ecebff] flex items-center justify-center">
                <i className="fa-solid fa-box-archive text-[8rem] text-[#8c95ff]"></i>
              </div>
            )}
          </div>
        </div>

        {/* Product Info */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#e5e7ff] p-6">
          {product.kategori && (
            <span className="inline-block px-3 py-1 rounded-full bg-[#eef0ff] text-[#5c63f2] text-sm font-semibold mb-3">
              {product.kategori}
            </span>
          )}
          
          <h1 className="text-3xl font-bold text-[#141a33] mb-4">{product.nama}</h1>
          
          <div className="mb-6">
            <p className="text-4xl font-bold text-[#5c63f2]">
              {formatPrice(product.harga)}
            </p>
          </div>

          {/* Stock Info */}
          <div className="mb-6">
            <p className="text-[#374151] flex items-center gap-2">
              <span className="font-semibold text-[#141a33]">Stok:</span>
              {product.stok > 0 ? (
                <span className="px-2 py-1 rounded-full bg-[#d1fae5] text-[#065f46] text-sm font-semibold">
                  {product.stok} tersedia
                </span>
              ) : (
                <span className="px-2 py-1 rounded-full bg-[#fee2e2] text-[#991b1b] text-sm font-semibold">Habis</span>
              )}
            </p>
          </div>

          {/* Description */}
          {product.deskripsi && (
            <div className="mb-6">
              <h2 className="font-semibold text-lg mb-3">Deskripsi Produk</h2>
              <ul className="space-y-2">
                {product.deskripsi
                  .split(/\|\||,/)
                  .map((item) => item.trim())
                  .filter((item) => item.length > 0)
                  .map((item, index) => (
                    <li key={index} className="flex items-start gap-2 text-gray-700">
                      <i className="fa-solid fa-circle-check text-[#5c63f2] mt-1 flex-shrink-0"></i>
                      <span>{item}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {/* Quantity Selector */}
          {product.stok > 0 && (
            <div className="mb-6">
              <label className="block font-semibold text-[#141a33] mb-3">Jumlah</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 rounded-xl border border-[#e5e7ff] hover:bg-[#eef0ff] hover:border-[#5c63f2] hover:text-[#5c63f2] flex items-center justify-center transition-all"
                >
                  <i className="fa-solid fa-minus text-sm"></i>
                </button>
                <input
                  type="number"
                  min="1"
                  max={product.stok}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Math.min(product.stok, parseInt(e.target.value) || 1)))}
                  className="w-20 h-10 text-center border border-[#e5e7ff] rounded-xl font-semibold focus:border-[#5c63f2] focus:ring-2 focus:ring-[#5c63f2]/20 outline-none"
                />
                <button
                  onClick={() => setQuantity(Math.min(product.stok, quantity + 1))}
                  className="w-10 h-10 rounded-xl border border-[#e5e7ff] hover:bg-[#eef0ff] hover:border-[#5c63f2] hover:text-[#5c63f2] flex items-center justify-center transition-all"
                >
                  <i className="fa-solid fa-plus text-sm"></i>
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleAddToCart}
              disabled={product.stok === 0}
              className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all ${
                product.stok === 0
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-white border-2 border-[#5c63f2] text-[#5c63f2] hover:bg-[#eef0ff] shadow-sm hover:shadow-md'
              }`}
            >
              <i className="fa-solid fa-cart-plus mr-2"></i>
              Tambah ke Keranjang
            </button>
            <button
              onClick={handleBuyNow}
              disabled={product.stok === 0}
              className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all ${
                product.stok === 0
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-[#5c63f2] to-[#7b5cf7] text-white hover:shadow-lg shadow-md'
              }`}
            >
              <i className="fa-solid fa-bolt mr-2"></i>
              Beli Sekarang
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

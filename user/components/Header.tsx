'use client'

import Link from 'next/link'
import { useCart } from './CartProvider'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Database } from '@/lib/database.types'

type Product = Database['public']['Tables']['products']['Row']

export default function Header() {
  const { itemCount } = useCart()
  const pathname = usePathname()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // Close search when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Search products
  useEffect(() => {
    async function searchProducts() {
      if (searchQuery.trim().length < 2) {
        setSearchResults([])
        return
      }

      setIsSearching(true)
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('aktif', true)
          .or(`nama.ilike.%${searchQuery}%,deskripsi.ilike.%${searchQuery}%,kategori.ilike.%${searchQuery}%`)
          .limit(8) as { data: Product[] | null; error: any }

        if (!error && data) {
          // Fetch stock for results
          const codes = data.map(p => p.kode)
          const { data: itemCounts } = await supabase
            .from('product_items')
            .select('product_code, status')
            .in('product_code', codes)

          const availableMap = new Map<string, number>()
          itemCounts?.forEach((item: any) => {
            if (item.status === 'available') {
              availableMap.set(item.product_code, (availableMap.get(item.product_code) || 0) + 1)
            }
          })

          const productsWithStock = data.map(p => ({
            ...p,
            stok: availableMap.get(p.kode) || 0
          }))

          setSearchResults(productsWithStock)
        }
      } catch (error) {
        console.error('Search error:', error)
      } finally {
        setIsSearching(false)
      }
    }

    const debounceTimer = setTimeout(searchProducts, 300)
    return () => clearTimeout(debounceTimer)
  }, [searchQuery])

  const handleSearchClick = () => {
    setIsSearchOpen(!isSearchOpen)
    if (!isSearchOpen) {
      setTimeout(() => document.getElementById('search-input')?.focus(), 100)
    }
  }

  const formatPrice = (price: number | null) => {
    if (!price) return 'Hubungi Admin'
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(price)
  }

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-[#e5e7ff] shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <span className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#5c63f2] via-[#6b57f6] to-[#4f5be6] text-white flex items-center justify-center shadow-lg">
              <i className="fa-solid fa-bolt text-lg"></i>
            </span>
            <div className="flex flex-col leading-none">
              <span className="text-xs tracking-wide text-[#6b57f6] font-semibold">Putra BTT</span>
              <span className="text-xl font-extrabold text-[#1c2340]">Store</span>
            </div>
          </Link>

          {/* Search Icon - Visible on all screens */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSearchClick}
              className={`px-3 py-2 rounded-full transition-all flex items-center gap-2 ${
                isSearchOpen
                  ? 'text-white bg-gradient-to-r from-[#5c63f2] to-[#7b5cf7] shadow-md'
                  : 'text-[#1c2340] hover:text-[#5c63f2] hover:bg-[#eef0ff]'
              }`}
              aria-label="Cari Produk"
            >
              <i className="fa-solid fa-magnifying-glass"></i>
            </button>
          </div>

          {/* Search Icon & Navigation - Hide on mobile */}
          <div className="hidden md:flex items-center gap-2">
            {/* Search Icon */}
            <button
              onClick={handleSearchClick}
              className={`px-4 py-2 rounded-full transition-all flex items-center gap-2 ${
                isSearchOpen
                  ? 'text-white bg-gradient-to-r from-[#5c63f2] to-[#7b5cf7] shadow-md'
                  : 'text-[#1c2340] hover:text-[#5c63f2] hover:bg-[#eef0ff]'
              }`}
              aria-label="Cari Produk"
            >
              <i className="fa-solid fa-magnifying-glass"></i>
            </button>

            <nav className="flex items-center gap-2 text-sm font-semibold">
            <Link
              href="/"
              className={`px-4 py-2 rounded-full transition-all flex items-center gap-2 ${
                pathname === '/'
                  ? 'text-white bg-gradient-to-r from-[#5c63f2] to-[#7b5cf7] shadow-md'
                  : 'text-[#1c2340] hover:text-[#5c63f2] hover:bg-[#eef0ff]'
              }`}
            >
              <i className="fa-solid fa-grip"></i>
              Katalog
            </Link>
            <Link
              href="/cart"
              className={`relative px-4 py-2 rounded-full transition-all flex items-center gap-2 ${
                pathname === '/cart'
                  ? 'text-white bg-gradient-to-r from-[#5c63f2] to-[#7b5cf7] shadow-md'
                  : 'text-[#1c2340] hover:text-[#5c63f2] hover:bg-[#eef0ff]'
              }`}
            >
              <i className="fa-solid fa-cart-shopping"></i>
              Keranjang
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 rounded-full bg-[#f43f5e] text-white text-xs flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </Link>
            </nav>
          </div>
        </div>

        {/* Search Dropdown */}
        {isSearchOpen && (
          <div ref={searchRef} className="absolute top-full left-0 right-0 mt-2 mx-2 md:mx-4 md:max-w-2xl md:left-1/2 md:-translate-x-1/2 bg-white rounded-2xl shadow-2xl border border-[#e5e7ff] overflow-hidden z-50 animate-fadeIn">
            {/* Search Input */}
            <div className="p-4 border-b border-[#e5e7ff]">
              <div className="relative">
                <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-[#7b5cf7]"></i>
                <input
                  id="search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari produk (Netflix, YouTube, Spotify...)"
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-[#e5e7ff] focus:border-[#5c63f2] focus:ring-2 focus:ring-[#5c63f2]/20 outline-none transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('')
                      setSearchResults([])
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6b7280] hover:text-[#1c2340]"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                )}
              </div>
            </div>

            {/* Search Results */}
            <div className="max-h-96 overflow-y-auto">
              {isSearching ? (
                <div className="p-8 text-center">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#5c63f2] border-r-transparent"></div>
                  <p className="mt-3 text-[#6b7280]">Mencari produk...</p>
                </div>
              ) : searchQuery.trim().length < 2 ? (
                <div className="p-8 text-center">
                  <i className="fa-solid fa-magnifying-glass text-4xl text-[#d1d5db] mb-3"></i>
                  <p className="text-[#6b7280]">Ketik minimal 2 karakter untuk mencari</p>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="divide-y divide-[#e5e7ff]">
                  {searchResults.map((product) => (
                    <Link
                      key={product.id}
                      href={`/?search=${encodeURIComponent(searchQuery)}#products`}
                      onClick={() => {
                        setIsSearchOpen(false)
                        // Don't clear search query - let page.tsx handle it
                        // Smooth scroll to products section
                        setTimeout(() => {
                          const productsSection = document.getElementById('products')
                          if (productsSection) {
                            productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
                          }
                        }, 100)
                      }}
                      className="flex items-center gap-4 p-4 hover:bg-[#f4f5ff] transition-colors"
                    >
                      {/* Product Icon */}
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#f2f3ff] via-white to-[#ecebff] flex items-center justify-center flex-shrink-0">
                        <i className="fa-solid fa-box-archive text-[#8c95ff] text-xl"></i>
                      </div>

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-[#141a33] truncate">{product.nama}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm font-bold text-[#5c63f2]">{formatPrice(product.harga)}</span>
                          {product.kategori && (
                            <>
                              <span className="text-[#d1d5db]">•</span>
                              <span className="text-xs text-[#6b7280] bg-[#f4f5ff] px-2 py-0.5 rounded-full">{product.kategori}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Stock Badge */}
                      <div className="flex-shrink-0">
                        {product.stok > 0 ? (
                          <span className="px-2 py-1 rounded-full bg-[#d1fae5] text-[#065f46] text-xs font-semibold">
                            Stok: {product.stok}
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full bg-[#fee2e2] text-[#991b1b] text-xs font-semibold">
                            Habis
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <i className="fa-solid fa-box-open text-4xl text-[#d1d5db] mb-3"></i>
                  <p className="text-[#6b7280] font-semibold mb-1">Produk tidak ditemukan</p>
                  <p className="text-sm text-[#9ca3af]">Coba kata kunci lain atau lihat katalog lengkap</p>
                  <Link
                    href="/#products"
                    onClick={() => {
                      setIsSearchOpen(false)
                      setSearchQuery('')
                    }}
                    className="inline-block mt-4 px-4 py-2 bg-gradient-to-r from-[#5c63f2] to-[#7b5cf7] text-white rounded-lg text-sm font-semibold hover:shadow-lg transition-shadow"
                  >
                    Lihat Semua Produk
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

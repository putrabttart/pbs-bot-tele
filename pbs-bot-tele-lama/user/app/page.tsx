"use client";
import { Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import ProductCard from '@/components/ProductCard'
import { Database } from '@/lib/database.types'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

type Product = Database['public']['Tables']['products']['Row']

function HomeInner() {
  const searchParams = useSearchParams()
  const searchQuery = searchParams.get('search') || ''
  
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [categories, setCategories] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Fetch fresh setiap kali page mount (avoid stale cache)
    fetchProducts({ silent: false })
    
    // Set up periodic refresh setiap 30 detik untuk update stok (silent)
    const interval = setInterval(() => {
      console.log('[Katalog] Refreshing products...')
      fetchProducts({ silent: true })
    }, 30000)
    
    return () => clearInterval(interval)
  }, [])

  async function fetchProducts({ silent = false } = {}) {
    try {
      if (!silent) {
        setLoading(true)
        setError(null)
      }
      
      console.log('Fetching products from Supabase...')
      
      // Add cache busting parameter
      const timestamp = new Date().getTime()
      
      const { data, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .eq('aktif', true)  // Only show active products
        .order('nama') as { data: Product[] | null; error: any }

      if (fetchError) {
        console.error('Supabase error:', fetchError)
        setError(`Database error: ${fetchError.message}`)
        throw fetchError
      }

      console.log('Products fetched:', data?.length || 0)

      // Fetch actual available stock from product_items
      if (data && data.length > 0) {
        const { data: itemCounts, error: itemsError } = await supabase
          .from('product_items')
          .select('product_code, status')

        if (!itemsError && itemCounts) {
          const availableMap = new Map<string, number>()
          itemCounts.forEach((item: any) => {
            if (item.status === 'available') {
              availableMap.set(item.product_code, (availableMap.get(item.product_code) || 0) + 1)
            }
          })

          // Update products with real available stock
          const productsWithRealStock = data.map(p => ({
            ...p,
            stok: availableMap.get(p.kode) || 0
          }))
          setProducts(productsWithRealStock)
        } else {
          setProducts(data)
        }
      } else {
        setProducts([])
      }
      
      // Extract unique categories
      const uniqueCategories = Array.from(
        new Set((data || []).map(p => p.kategori).filter(Boolean))
      ) as string[]
      setCategories(uniqueCategories)
    } catch (error: any) {
      console.error('Error fetching products:', error)
      if (!silent) {
        setError(error?.message || 'Failed to load products')
      }
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }

  // Filter by search query first, then by category
  let filteredProducts = products
  
  if (searchQuery) {
    filteredProducts = products.filter(p => 
      p.nama?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.deskripsi?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.kategori?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  } else if (selectedCategory !== 'all') {
    filteredProducts = products.filter(p => p.kategori === selectedCategory)
  }
  
  // Auto-scroll to products when search is active
  useEffect(() => {
    if (searchQuery) {
      setTimeout(() => {
        const productsSection = document.getElementById('products')
        if (productsSection) {
          productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 300)
    }
  }, [searchQuery])

  return (
      <>
        {/* ===== HERO SECTION ===== */}
        <section className="py-16 md:py-20 bg-gradient-to-br from-[#0f1229] via-[#13183a] to-[#0f1229] text-white border-b border-[#1e2448]">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="grid lg:grid-cols-2 gap-10 items-center">
              <div className="flex flex-col gap-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/15 text-xs font-semibold uppercase tracking-wide w-fit">
                  <i className="fa-solid fa-wand-magic-sparkles text-[#9aa3ff]"></i>
                  Produk digital cepat, aman, dan bergaransi
                </div>

                <div>
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight">
                    Putra BTT Store
                    <br />
                    <span className="bg-gradient-to-r from-[#6b57f6] via-[#5c63f2] to-[#4f5be6] bg-clip-text text-transparent">
                      Aman, Cepat, Terpercaya
                    </span>
                  </h1>
                  <p className="text-base md:text-lg text-white/80 max-w-xl mt-4">
                    Netflix, YouTube Premium, Spotify, Canva Pro, CapCut, dan lainnya—diproses cepat dengan dukungan admin yang jelas dan ramah.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mt-6">
                  <div className="p-4 rounded-2xl bg-white/10 border border-white/15 hover:bg-white/15 transition-colors">
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-white/80 mb-2">
                      <i className="fa-solid fa-layer-group text-[#7b5cf7]"></i>
                      <span>Produk siap beli</span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold">{products.length}+</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/10 border border-white/15 hover:bg-white/15 transition-colors">
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-white/80 mb-2">
                      <i className="fa-solid fa-bolt text-[#7b5cf7]"></i>
                      <span>Estimasi proses</span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold">1-10 menit</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/10 border border-white/15 hover:bg-white/15 transition-colors sm:col-span-2 lg:col-span-1">
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-white/80 mb-2">
                      <i className="fa-solid fa-star text-[#f6d84c]"></i>
                      <span>Kepuasan</span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold">4.9 / 5</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link href="#products" className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#5c63f2] to-[#7b5cf7] font-semibold shadow-lg shadow-[#5c63f2]/30 hover:translate-y-[-2px] transition-transform">
                    Lihat Harga & Produk
                  </Link>
                  <a
                    href="https://wa.me/6282340915319"
                    target="_blank"
                    className="px-6 py-3 rounded-xl border border-white/40 text-white font-semibold hover:bg-white/10 transition-colors"
                  >
                    <i className="fa-brands fa-whatsapp mr-2"></i>
                    Chat Admin
                  </a>
                </div>
              </div>

              <div className="hidden lg:block">
                <div className="relative p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur">
                  <div className="absolute -top-6 -left-6 h-16 w-16 rounded-2xl bg-gradient-to-br from-[#5c63f2] to-[#7b5cf7] blur-2xl opacity-60"></div>
                  <div className="absolute -bottom-6 -right-6 h-16 w-16 rounded-2xl bg-gradient-to-br from-[#5c63f2] to-[#4f5be6] blur-2xl opacity-60"></div>
                  <div className="relative grid grid-cols-2 gap-3 text-[#0f1229]">
                    <div className="p-4 rounded-2xl bg-white shadow-md border border-[#e5e7ff]">
                      <div className="text-sm font-semibold text-[#3c3fa8] mb-1">Flow Otomatis</div>
                      <div className="text-lg font-bold">Bayar → Akun Dikirim</div>
                      <p className="text-sm text-[#374151] mt-1">Integrasi Midtrans + Supabase</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white shadow-md border border-[#e5e7ff]">
                      <div className="text-sm font-semibold text-[#3c3fa8] mb-1">Stok Real-time</div>
                      <div className="text-lg font-bold">Reserve & Finalize</div>
                      <p className="text-sm text-[#374151] mt-1">Sejalan dengan bot Telegram</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white shadow-md border border-[#e5e7ff] col-span-2 flex items-center gap-3">
                      <span className="h-12 w-12 rounded-xl bg-[#eef0ff] text-[#5c63f2] flex items-center justify-center">
                        <i className="fa-solid fa-shield-halved"></i>
                      </span>
                      <div>
                        <div className="text-lg font-bold text-[#141a33]">Garansi Masa Pakai</div>
                        <p className="text-sm text-[#374151]">Dibantu sampai akun aktif dan stabil</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

      {/* ===== STEPS SECTION ===== */}
      <section className="py-16 bg-gradient-to-br from-[#f4f5ff] to-white">
        <div className="container mx-auto px-4 max-w-6xl">
          <h2 className="text-3xl font-bold text-[#141a33] text-center mb-4">Cara Order di Putra BTT Store</h2>
          <p className="text-[#1f2937] text-center mb-12">Empat langkah singkat sampai akunmu aktif</p>

          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[{
              title: 'Pilih Produk',
              desc: 'Telusuri katalog dan pilih paket sesuai kebutuhan.',
              icon: 'fa-magnifying-glass'
            }, {
              title: 'Tambah ke Keranjang',
              desc: 'Klik tambah untuk mengunci stok dan lanjut checkout.',
              icon: 'fa-cart-plus'
            }, {
              title: 'Bayar via QRIS',
              desc: 'Selesaikan pembayaran aman dengan QRIS Midtrans.',
              icon: 'fa-qrcode'
            }, {
              title: 'Akun Dikirim',
              desc: 'Item digital dikirim otomatis di web setelah pembayaran sukses.',
              icon: 'fa-rocket'
            }].map((step, idx) => (
              <div key={step.title} className="relative h-full">
                <div className="flex h-full min-h-[220px] flex-col items-center text-center gap-3 rounded-2xl bg-white shadow-sm border border-[#e5e7ff] px-6 py-7">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#5c63f2] to-[#7b5cf7] text-white flex items-center justify-center text-xl font-bold">
                    <i className={`fa-solid ${step.icon}`}></i>
                  </div>
                  <h3 className="font-bold text-[#141a33]">{idx + 1}. {step.title}</h3>
                  <p className="text-sm text-[#374151]">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PRODUCTS SECTION ===== */}
      <section id="products" className="py-6 bg-white">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Products Header */}
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#141a33] mb-4">
              {searchQuery ? `Hasil Pencarian: "${searchQuery}"` : 'Produk Digital Terpilih'}
            </h2>
            <p className="text-[#1f2937] max-w-2xl mx-auto">
              {searchQuery 
                ? `Menampilkan ${filteredProducts.length} produk yang cocok dengan pencarian Anda`
                : 'Akses premium dengan harga ramah dan stok yang sinkron langsung dari database.'
              }
            </p>
            {searchQuery && (
              <Link
                href="/"
                className="inline-flex items-center gap-2 mt-4 text-[#5c63f2] hover:text-[#4f5be6] font-semibold text-sm"
              >
                <i className="fa-solid fa-arrow-left"></i>
                Lihat Semua Produk
              </Link>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-8 bg-[#fef2f2] border border-[#fecaca] text-[#b91c1c] px-6 py-4 rounded-xl flex items-start gap-3">
              <i className="fa-solid fa-triangle-exclamation mt-1"></i>
              <div>
                <p className="font-semibold">Gagal memuat produk</p>
                <p className="text-sm mt-1">{error}</p>
                <button 
                  onClick={() => fetchProducts({ silent: false })}
                  className="mt-3 text-sm font-semibold underline hover:no-underline"
                >
                  Coba Lagi
                </button>
              </div>
            </div>
          )}

          {/* Products Grid */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl shadow-sm h-96 animate-pulse border border-[#e5e7ff]">
                  <div className="w-full h-48 bg-gradient-to-br from-[#eef0ff] to-[#e1e5ff]"></div>
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-[#e1e5ff] rounded"></div>
                    <div className="h-4 bg-[#e1e5ff] rounded w-2/3"></div>
                    <div className="h-8 bg-[#e1e5ff] rounded mt-4"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : !error ? (
            <div className="text-center py-20 bg-[#f4f5ff] rounded-2xl border border-[#e5e7ff]">
              <div className="text-5xl text-[#7b5cf7] mb-4">
                <i className="fa-solid fa-box-open"></i>
              </div>
              <h3 className="text-2xl font-bold text-[#141a33] mb-2">
                {selectedCategory === 'all' ? 'Belum Ada Produk' : 'Tidak Ada Produk di Kategori Ini'}
              </h3>
              <p className="text-[#374151] mb-6">
                {selectedCategory === 'all' 
                  ? 'Produk akan segera ditambahkan. Pantau terus!' 
                  : 'Coba pilih kategori lain atau lihat semua produk'}
              </p>
              {selectedCategory !== 'all' && (
                <button
                  onClick={() => setSelectedCategory('all')}
                  className="px-6 py-2 bg-gradient-to-r from-[#5c63f2] to-[#7b5cf7] text-white rounded-lg font-semibold shadow-md hover:shadow-lg transition-colors"
                >
                  Lihat Semua Produk
                </button>
              )}
            </div>
          ) : null}
        </div>
      </section>

      {/* ===== BENEFITS SECTION ===== */}
      <section className="py-16 bg-gradient-to-br from-[#f4f5ff] to-white">
        <div className="container mx-auto px-4 max-w-6xl">
          <h2 className="text-3xl font-bold text-[#141a33] text-center mb-4">Kenapa Putra BTT Store?</h2>
          <p className="text-[#1f2937] text-center mb-12 max-w-2xl mx-auto">
            Fokus pada kejelasan, kecepatan, dan keamanan supaya kamu tinggal pakai tanpa ribet.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="rounded-2xl p-6 border border-[#e5e7ff] bg-gradient-to-br from-[#f4f5ff] to-white shadow-sm hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-xl bg-[#eef0ff] text-[#5c63f2] flex items-center justify-center mb-4">
                <i className="fa-solid fa-shield-halved"></i>
              </div>
              <h3 className="font-bold text-[#141a33] mb-2">Aman & Transparan</h3>
              <p className="text-sm text-[#374151]">Sudah melayani ratusan pelanggan dengan jejak transaksi yang jelas.</p>
            </div>

            <div className="rounded-2xl p-6 border border-[#e5e7ff] bg-gradient-to-br from-[#f4f5ff] to-white shadow-sm hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-xl bg-[#eef0ff] text-[#7b5cf7] flex items-center justify-center mb-4">
                <i className="fa-solid fa-bolt"></i>
              </div>
              <h3 className="font-bold text-[#141a33] mb-2">Proses Kilat</h3>
              <p className="text-sm text-[#374151]">Estimasi 1–10 menit dengan update status yang mudah dipantau.</p>
            </div>

            <div className="rounded-2xl p-6 border border-[#e5e7ff] bg-gradient-to-br from-[#f4f5ff] to-white shadow-sm hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-xl bg-[#eef0ff] text-[#5c63f2] flex items-center justify-center mb-4">
                <i className="fa-solid fa-shield-halved"></i>
              </div>
              <h3 className="font-bold text-[#141a33] mb-2">Garansi Masa Pakai</h3>
              <p className="text-sm text-[#374151]">Jika ada kendala, dibantu sampai akun aktif dan stabil sesuai paket.</p>
            </div>

            <div className="rounded-2xl p-6 border border-[#e5e7ff] bg-gradient-to-br from-[#f4f5ff] to-white shadow-sm hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-xl bg-[#eef0ff] text-[#7b5cf7] flex items-center justify-center mb-4">
                <i className="fa-solid fa-headset"></i>
              </div>
              <h3 className="font-bold text-[#141a33] mb-2">Support Ramah</h3>
              <p className="text-sm text-[#374151]">Admin sigap menjelaskan perbedaan paket supaya kamu pilih yang tepat.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS SECTION ===== */}
      {!loading && products.length > 0 && (
        <section className="py-16 bg-gradient-to-br from-[#f4f5ff] to-white">
          <div className="container mx-auto px-4 max-w-6xl">
            <h2 className="text-3xl font-bold text-[#141a33] text-center mb-4">Apa Kata Pelanggan?</h2>
            <p className="text-[#1f2937] text-center mb-12">Testimoni real setelah aktivasi akun digital</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[{
                quote: 'Proses cepat, admin ramah, dan dibantu sampai akun aktif. Bakal langganan lagi.',
                name: 'R*** – Lombok',
                info: 'YouTube Premium 3 Bulan'
              }, {
                quote: 'Buat tugas kampus jadi lebih gampang. Harganya masih masuk akal buat kantong mahasiswa.',
                name: 'S*** – Mahasiswa',
                info: 'Canva Pro + CapCut Pro'
              }, {
                quote: 'Sudah beberapa kali perpanjang, sejauh ini aman dan selalu dibantu kalau ada kendala.',
                name: 'A*** – Freelancer',
                info: 'Netflix & Spotify'
              }].map((t) => (
                <div key={t.name} className="bg-white rounded-2xl p-6 border border-[#e5e7ff] shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-1 text-[#f6c344] mb-3">
                    {[1,2,3,4,5].map(n => <i key={n} className="fa-solid fa-star"></i>)}
                  </div>
                  <p className="text-[#1f2937] mb-4 leading-relaxed">“{t.quote}”</p>
                  <p className="text-sm font-semibold text-[#141a33]">{t.name}</p>
                  <p className="text-xs text-[#374151]">{t.info}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== FAQ SECTION ===== */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-3xl font-bold text-[#141a33] text-center mb-4">Pertanyaan yang Sering Diajukan</h2>
          <p className="text-[#1f2937] text-center mb-12">Masih ragu atau bingung? Cek dulu beberapa pertanyaan umum berikut.</p>

          <div className="space-y-4">
            <details className="group bg-[#f4f5ff] border border-[#e5e7ff] rounded-xl overflow-hidden">
              <summary className="cursor-pointer p-5 font-semibold text-[#141a33] flex items-center justify-between hover:bg-[#eef0ff] transition-colors">
                <span>Berapa lama proses order biasanya?</span>
                <i className="fa-solid fa-chevron-down text-[#5c63f2] group-open:rotate-180 transition-transform"></i>
              </summary>
              <div className="px-5 pb-5 text-[#374151]">
                <p>Estimasi proses 1-10 menit pada jam operasional (08.00 - 23.00 WITA). Di luar jam tersebut, pesanan akan diproses keesokan harinya.</p>
              </div>
            </details>

            <details className="group bg-[#f4f5ff] border border-[#e5e7ff] rounded-xl overflow-hidden">
              <summary className="cursor-pointer p-5 font-semibold text-[#141a33] flex items-center justify-between hover:bg-[#eef0ff] transition-colors">
                <span>Kalau akun bermasalah di tengah masa langganan bagaimana?</span>
                <i className="fa-solid fa-chevron-down text-[#5c63f2] group-open:rotate-180 transition-transform"></i>
              </summary>
              <div className="px-5 pb-5 text-[#374151]">
                <p>Jika akun bermasalah di masa garansi, akan dibantu sampai selesai sesuai ketentuan yang berlaku. Langsung hubungi admin untuk penanganan cepat.</p>
              </div>
            </details>

            <details className="group bg-[#f4f5ff] border border-[#e5e7ff] rounded-xl overflow-hidden">
              <summary className="cursor-pointer p-5 font-semibold text-[#141a33] flex items-center justify-between hover:bg-[#eef0ff] transition-colors">
                <span>Metode pembayaran yang tersedia apa saja?</span>
                <i className="fa-solid fa-chevron-down text-[#5c63f2] group-open:rotate-180 transition-transform"></i>
              </summary>
              <div className="px-5 pb-5 text-[#374151]">
                <p>Kami menerima pembayaran via QRIS (semua e-wallet dan mobile banking yang mendukung QRIS).</p>
              </div>
            </details>

            <details className="group bg-[#f4f5ff] border border-[#e5e7ff] rounded-xl overflow-hidden">
              <summary className="cursor-pointer p-5 font-semibold text-[#141a33] flex items-center justify-between hover:bg-[#eef0ff] transition-colors">
                <span>Apakah akun bisa dipakai di banyak perangkat?</span>
                <i className="fa-solid fa-chevron-down text-[#5c63f2] group-open:rotate-180 transition-transform"></i>
              </summary>
              <div className="px-5 pb-5 text-[#374151]">
                <p>Tergantung jenis produk dan paket yang dibeli. Untuk detail penggunaan, silakan tanyakan ke admin sebelum order atau cek deskripsi produk.</p>
              </div>
            </details>

            <details className="group bg-[#f4f5ff] border border-[#e5e7ff] rounded-xl overflow-hidden">
              <summary className="cursor-pointer p-5 font-semibold text-[#141a33] flex items-center justify-between hover:bg-[#eef0ff] transition-colors">
                <span>Apakah ini akun legal?</span>
                <i className="fa-solid fa-chevron-down text-[#5c63f2] group-open:rotate-180 transition-transform"></i>
              </summary>
              <div className="px-5 pb-5 text-[#374151]">
                <p>Kami menyediakan akses berlangganan premium melalui metode legal sesuai kebijakan penyedia layanan. Semua akun dijamin aman dan sesuai terms of service.</p>
              </div>
            </details>
          </div>

          <div className="mt-8 text-center p-6 bg-gradient-to-br from-[#f4f5ff] to-white border border-[#e5e7ff] rounded-2xl">
            <p className="text-[#374151] mb-4">Masih ada yang ingin ditanyakan?</p>
            <p className="text-sm text-[#6b7280] mb-6">Kalau pertanyaanmu belum terjawab, kamu bisa langsung hubungi admin lewat WhatsApp. Jelaskan kebutuhanmu, nanti akan direkomendasikan paket yang paling pas.</p>
            <a
              href="https://wa.me/6282340915319?text=Halo%20min%2C%20saya%20mau%20tanya%20dulu%20sebelum%20order%20produk%20digital."
              target="_blank"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#5c63f2] to-[#7b5cf7] text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all"
            >
              <i className="fa-brands fa-whatsapp"></i>
              Tanya Admin Sekarang
            </a>
          </div>
        </div>
      </section>

      {/* ===== CTA SECTION ===== */}
      <section className="py-16 bg-gradient-to-br from-[#0f1229] via-[#13183a] to-[#0f1229] text-white">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Hubungi & Ikuti Putra BTT Store</h2>
            <p className="text-lg text-white/80 mb-2">
              Untuk info promo terbaru, update layanan, dan panduan lengkap, kamu bisa menyimpan kontak dan follow channel berikut.
            </p>
            <div className="inline-block mt-4 px-4 py-2 bg-white/10 border border-white/20 rounded-lg">
              <p className="text-sm font-semibold">Jam operasional: <span className="text-[#9aa3ff]">08.00 – 23.00 WITA</span></p>
              <p className="text-xs text-white/70 mt-1">Di luar jam tersebut, respon mungkin sedikit lebih lambat.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <a
              href="https://wa.me/6282340915319"
              target="_blank"
              className="group p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#25D366] flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <i className="fa-brands fa-whatsapp text-white text-2xl"></i>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-1">WhatsApp Admin</h3>
                  <p className="text-sm text-white/70">Tanya produk, cek harga, dan konfirmasi pembayaran.</p>
                </div>
                <i className="fa-solid fa-arrow-right text-white/50 group-hover:text-white group-hover:translate-x-1 transition-all"></i>
              </div>
            </a>

            <a
              href="https://chat.whatsapp.com/your-group-link"
              target="_blank"
              className="group p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#25D366] flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <i className="fa-solid fa-users text-white text-xl"></i>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-1">WhatsApp Group</h3>
                  <p className="text-sm text-white/70">Informasi terbaru mengenai produk dan promo.</p>
                </div>
                <i className="fa-solid fa-arrow-right text-white/50 group-hover:text-white group-hover:translate-x-1 transition-all"></i>
              </div>
            </a>

            <a
              href="https://t.me/AutoOrderPBS_bot"
              target="_blank"
              className="group p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#0088cc] flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <i className="fa-brands fa-telegram text-white text-2xl"></i>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-1">Telegram Bot Auto Order</h3>
                  <p className="text-sm text-white/70">Pesan produk digital otomatis lewat Telegram.</p>
                </div>
                <i className="fa-solid fa-arrow-right text-white/50 group-hover:text-white group-hover:translate-x-1 transition-all"></i>
              </div>
            </a>

            <a
              href="https://putrabttstore.web.id"
              target="_blank"
              className="group p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#5c63f2] to-[#7b5cf7] flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <i className="fa-solid fa-globe text-white text-xl"></i>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-1">Website Putra BTT Store</h3>
                  <p className="text-sm text-white/70">Informasi lengkap produk & layanan terbaru.</p>
                </div>
                <i className="fa-solid fa-arrow-right text-white/50 group-hover:text-white group-hover:translate-x-1 transition-all"></i>
              </div>
            </a>
          </div>
        </div>
      </section>
    </>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomeInner />
    </Suspense>
  )
}

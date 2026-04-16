"use client";
import { Suspense } from 'react'
import { useEffect, useState } from 'react'
import ProductCard from '@/components/ProductCard'
import { Database } from '@/lib/database.types'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

type Product = Database['public']['Tables']['products']['Row']

type HeroSlide = {
  badge: string
  title: string
  highlight: string
  description: string
  image: string
}

const HERO_SLIDES: HeroSlide[] = [
  {
    badge: 'Aktivasi Kilat',
    title: 'Akun Premium Siap Dalam Hitungan Menit',
    highlight: 'Cepat, Aman, Transparan',
    description:
      'Netflix, YouTube Premium, Spotify, Canva Pro, CapCut, dan layanan digital lain diproses cepat dengan alur order yang jelas.',
    image:
      'https://putrabttstore.web.id/01PBS.png',
  },
  {
    badge: 'Sistem Otomatis',
    title: 'Bayar Sekali, Status Pesanan Terpantau Jelas',
    highlight: 'Midtrans + Sinkron Stok Real-time',
    description:
      'Kombinasi checkout aman dan sinkronisasi database menjaga stok tetap akurat dari proses reserve sampai finalize order.',
    image:
      'https://putrabttstore.web.id/02PBS.png',
  },
  {
    badge: 'Support Ramah',
    title: 'Beli Tenang Karena Ada Admin Siap Bantu',
    highlight: 'Garansi Sampai Akun Aktif',
    description:
      'Tim support membantu dari pemilihan paket sampai akun stabil dipakai, jadi kamu tidak bingung saat ada kendala.',
    image:
      'https://putrabttstore.web.id/03PBS.png',
  },
]

function HomeInner() {
  const searchParams = useSearchParams()
  const searchQuery = searchParams.get('search') || ''
  
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [categories, setCategories] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [activeSlide, setActiveSlide] = useState(0)
  const [isSliderPaused, setIsSliderPaused] = useState(false)

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

  useEffect(() => {
    if (isSliderPaused) return

    const sliderInterval = setInterval(() => {
      setActiveSlide((current) => (current + 1) % HERO_SLIDES.length)
    }, 5500)

    return () => clearInterval(sliderInterval)
  }, [isSliderPaused])

  const goToNextSlide = () => {
    setActiveSlide((current) => (current + 1) % HERO_SLIDES.length)
  }

  const goToPrevSlide = () => {
    setActiveSlide((current) => (current - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)
  }

  async function fetchProducts({ silent = false } = {}) {
    try {
      if (!silent) {
        setLoading(true)
        setError(null)
      }
      
      const res = await fetch('/api/catalog-products?aktifOnly=true', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to fetch products')

      const data = (json?.data || []) as Product[]
      setProducts(data)
      
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
        <section className="overflow-hidden">
          <div className="mx-auto w-full max-w-[1200px]">
            <div
              className="relative aspect-[5/2] w-full max-h-[480px]"
              onMouseEnter={() => setIsSliderPaused(true)}
              onMouseLeave={() => setIsSliderPaused(false)}
            >
              {HERO_SLIDES.map((slide, idx) => {
                const isActive = idx === activeSlide

                return (
                  <article
                    key={slide.title}
                    className={`absolute inset-0 overflow-hidden transition-opacity duration-500 ease-out ${
                      isActive
                        ? 'z-30 opacity-100'
                        : 'z-10 opacity-0 pointer-events-none'
                    }`}
                    aria-hidden={!isActive}
                  >
                    <img
                      src={slide.image}
                      alt={slide.title}
                      className="h-full w-full object-cover"
                    />
                    <div className={`absolute inset-0 ${isActive ? 'bg-black/10' : 'bg-black/35'}`}></div>
                  </article>
                )
              })}

              <button
                type="button"
                onClick={goToPrevSlide}
                className="absolute left-2 top-1/2 z-40 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-[#111b2d]/75 text-white backdrop-blur transition-colors hover:bg-[#111b2d]/95 sm:left-4 sm:h-10 sm:w-10"
                aria-label="Slide sebelumnya"
              >
                <i className="fa-solid fa-chevron-left"></i>
              </button>

              <button
                type="button"
                onClick={goToNextSlide}
                className="absolute right-2 top-1/2 z-40 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-[#111b2d]/75 text-white backdrop-blur transition-colors hover:bg-[#111b2d]/95 sm:right-4 sm:h-10 sm:w-10"
                aria-label="Slide berikutnya"
              >
                <i className="fa-solid fa-chevron-right"></i>
              </button>

              <div className="absolute bottom-2 left-1/2 z-40 flex -translate-x-1/2 gap-2 sm:bottom-4">
                {HERO_SLIDES.map((slide, idx) => (
                  <button
                    key={slide.title}
                    type="button"
                    onClick={() => setActiveSlide(idx)}
                    aria-label={`Pilih banner ${idx + 1}`}
                    className={`h-2.5 rounded-full transition-all duration-300 ${
                      activeSlide === idx
                        ? 'w-8 bg-[#2f89ff] shadow-[0_0_16px_rgba(47,137,255,0.7)]'
                        : 'w-2.5 bg-white/45 hover:bg-white/80'
                    }`}
                  ></button>
                ))}
              </div>
            </div>
          </div>
        </section>

      {/* ===== PRODUCTS SECTION ===== */}
      <section id="products" className="bg-white py-3 sm:py-6">
        <div className="container mx-auto max-w-6xl px-3 sm:px-4">
          {/* Products Header */}
          <div className="mb-5 text-center sm:mb-12">
            <h2 className="mb-3 text-2xl font-bold leading-tight text-[#141a33] sm:mb-4 sm:text-3xl">
              {searchQuery ? `Hasil Pencarian: "${searchQuery}"` : 'Produk Digital Terpilih'}
            </h2>
            <p className="mx-auto max-w-2xl text-sm text-[#1f2937] sm:text-base">
              {searchQuery 
                ? `Menampilkan ${filteredProducts.length} produk yang cocok dengan pencarian Anda`
                : 'Akses premium dengan harga ramah dan stok yang sinkron langsung dari database.'
              }
            </p>
            {searchQuery && (
              <Link
                href="/"
                className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#5c63f2] hover:text-[#4f5be6] sm:mt-4"
              >
                <i className="fa-solid fa-arrow-left"></i>
                Lihat Semua Produk
              </Link>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 flex items-start gap-2 rounded-xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-[#b91c1c] sm:mb-8 sm:gap-3 sm:px-6 sm:py-4">
              <i className="fa-solid fa-triangle-exclamation mt-1"></i>
              <div>
                <p className="font-semibold">Gagal memuat produk</p>
                <p className="mt-1 text-xs sm:text-sm">{error}</p>
                <button 
                  onClick={() => fetchProducts({ silent: false })}
                  className="mt-2 text-sm font-semibold underline hover:no-underline sm:mt-3"
                >
                  Coba Lagi
                </button>
              </div>
            </div>
          )}

          {/* Products Grid */}
          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-[290px] animate-pulse rounded-xl border border-[#e5e7ff] bg-white shadow-sm sm:h-96 sm:rounded-2xl">
                  <div className="h-36 w-full bg-gradient-to-br from-[#eef0ff] to-[#e1e5ff] sm:h-48"></div>
                  <div className="space-y-3 p-3 sm:p-4">
                    <div className="h-4 bg-[#e1e5ff] rounded"></div>
                    <div className="h-4 bg-[#e1e5ff] rounded w-2/3"></div>
                    <div className="h-8 bg-[#e1e5ff] rounded mt-4"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
              {filteredProducts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : !error ? (
            <div className="rounded-2xl border border-[#e5e7ff] bg-[#f4f5ff] px-4 py-14 text-center sm:px-6 sm:py-20">
              <div className="mb-4 text-4xl text-[#7b5cf7] sm:text-5xl">
                <i className="fa-solid fa-box-open"></i>
              </div>
              <h3 className="mb-2 text-xl font-bold text-[#141a33] sm:text-2xl">
                {selectedCategory === 'all' ? 'Belum Ada Produk' : 'Tidak Ada Produk di Kategori Ini'}
              </h3>
              <p className="mb-6 text-sm text-[#374151] sm:text-base">
                {selectedCategory === 'all' 
                  ? 'Produk akan segera ditambahkan. Pantau terus!' 
                  : 'Coba pilih kategori lain atau lihat semua produk'}
              </p>
              {selectedCategory !== 'all' && (
                <button
                  onClick={() => setSelectedCategory('all')}
                  className="rounded-lg bg-gradient-to-r from-[#5c63f2] to-[#7b5cf7] px-5 py-2.5 font-semibold text-white shadow-md transition-colors hover:shadow-lg sm:px-6"
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

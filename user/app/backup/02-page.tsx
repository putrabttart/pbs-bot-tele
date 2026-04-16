"use client";
import { Suspense } from 'react'
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
    fetchProducts({ silent: false })
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
      const res = await fetch('/api/catalog-products?aktifOnly=true', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to fetch products')
      const data = (json?.data || []) as Product[]
      setProducts(data)
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
    <div className="bg-[#fcfcff] overflow-x-hidden">
      {/* ===== HERO SECTION ===== */}
      <section className="relative pt-8 pb-20 md:pt-32 md:pb-32 bg-[#0a0d1d] text-white overflow-hidden">
        {/* Animated Background Orbs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#5c63f2] opacity-20 blur-[120px] rounded-full"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-[#7b5cf7] opacity-20 blur-[100px] rounded-full"></div>
        </div>

        <div className="container mx-auto px-3 max-w-7xl relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <div className="flex flex-col gap-8 lg:w-3/5 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-[#a5b4fc] text-sm font-medium w-fit mx-auto lg:mx-0 backdrop-blur-sm animate-fade-in">
                <span className="flex h-2 w-2 rounded-full bg-green-400 animate-pulse"></span>
                Trusted Digital Partner — Sejak 2021
              </div>

              <div className="space-y-4">
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[1.]">
                  Putra BTT Store<br />
                  <span className="bg-gradient-to-r from-[#818cf8] via-[#c084fc] to-[#818cf8] bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
                    Digital Market
                  </span>
                </h1>
                <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-light">
                  Solusi kebutuhan digital premium Anda. Netflix, YouTube, Spotify, hingga Tools Desain dan AI—diproses kilat dengan sistem otomatis yang sangat cepat.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                <Link href="#products" className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg shadow-[0_0_20px_rgba(79,70,229,0.4)] hover:translate-y-[-2px] transition-all duration-300 active:scale-95">
                  Mulai Langganan
                </Link>
                <a
                  href="https://wa.me/6282340915319"
                  target="_blank"
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold text-lg hover:bg-white/10 transition-all duration-300"
                >
                  <i className="fa-brands fa-whatsapp mr-2 text-green-400"></i>
                  Hubungi Admin
                </a>
              </div>

              <div className="grid grid-cols-3 gap-8 pt-4 border-t border-white/5">
                <div>
                  <div className="text-2xl md:text-3xl font-bold">{products.length}+</div>
                  <div className="text-xs md:text-sm text-slate-500 uppercase tracking-widest font-semibold">Produk</div>
                </div>
                <div>
                  <div className="text-2xl md:text-3xl font-bold">3m</div>
                  <div className="text-xs md:text-sm text-slate-500 uppercase tracking-widest font-semibold">Avg Process</div>
                </div>
                <div>
                  <div className="text-2xl md:text-3xl font-bold">4.9</div>
                  <div className="text-xs md:text-sm text-slate-500 uppercase tracking-widest font-semibold">Rating</div>
                </div>
              </div>
            </div>

            <div className="hidden lg:block lg:w-2/5">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
                <div className="relative p-8 rounded-[2.5rem] bg-[#12162b] border border-white/10 backdrop-blur-xl">
                  <div className="space-y-6">
                    <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center gap-5">
                      <div className="w-12 h-12 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xl">
                        <i className="fa-solid fa-bolt"></i>
                      </div>
                      <div>
                        <div className="font-bold text-lg">Instant Delivery</div>
                        <p className="text-sm text-slate-400">Bayar & terima akun otomatis</p>
                      </div>
                    </div>
                    <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center gap-5">
                      <div className="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center text-xl">
                        <i className="fa-solid fa-shield-check"></i>
                      </div>
                      <div>
                        <div className="font-bold text-lg">Full Warranty</div>
                        <p className="text-sm text-slate-400">Garansi penuh selama langganan</p>
                      </div>
                    </div>
                    <div className="mt-4 p-4 rounded-xl bg-indigo-600/10 border border-indigo-500/20">
                      <div className="flex justify-between text-xs font-bold text-indigo-300 uppercase mb-3">
                        <span>Live Activity</span>
                        <span className="animate-pulse">● Live</span>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between p-2 rounded bg-white/5">
                          <span className="text-slate-300">New order: Netflix 1bln</span>
                          <span className="text-indigo-400 font-mono">Just now</span>
                        </div>
                        <div className="flex justify-between p-2 rounded bg-white/5">
                          <span className="text-slate-300">Payment success</span>
                          <span className="text-indigo-400 font-mono">2m ago</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== STEPS SECTION ===== */}
      <section className="py-8 bg-white">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-sm font-bold text-indigo-600 uppercase tracking-widest">Process</h2>
            <h3 className="text-4xl font-extrabold text-slate-900">Mulai Dalam Hitungan Menit</h3>
            <p className="text-slate-500 max-w-xl mx-auto">Kami memangkas birokrasi. Pilih, bayar, dan nikmati layanan premium Anda secara langsung.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { title: 'Pilih Produk', desc: 'Jelajahi berbagai paket premium terbaik.', icon: 'fa-magnifying-glass', color: 'bg-blue-500' },
              { title: 'Checkout QRIS', desc: 'Bayar aman & cepat via Midtrans QRIS.', icon: 'fa-qrcode', color: 'bg-indigo-500' },
              { title: 'Verifikasi Otomatis', desc: 'Sistem mendeteksi pembayaran seketika.', icon: 'fa-check-double', color: 'bg-purple-500' },
              { title: 'Terima Pesanan', desc: 'Akun dikirim langsung ke dashboard Anda.', icon: 'fa-rocket', color: 'bg-pink-500' }
            ].map((step, idx) => (
              <div key={step.title} className="group relative">
                {idx < 3 && <div className="hidden lg:block absolute top-12 left-[60%] w-[80%] h-[2px] bg-slate-100 z-0"></div>}
                <div className="relative z-10 flex flex-col items-center text-center space-y-6">
                  <div className={`w-20 h-20 rounded-3xl ${step.color} shadow-lg shadow-indigo-200 flex items-center justify-center text-3xl text-white group-hover:scale-110 transition-transform duration-500`}>
                    <i className={`fa-solid ${step.icon}`}></i>
                  </div>
                  <div className="space-y-2 px-4">
                    <h4 className="text-xl font-bold text-slate-900">{idx + 1}. {step.title}</h4>
                    <p className="text-slate-500 text-sm leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PRODUCTS SECTION ===== */}
      <section id="products" className="py-8 bg-slate-50/50">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
            <div className="space-y-3">
              <h2 className="text-4xl font-black text-slate-900">
                {searchQuery ? `Hasil: "${searchQuery}"` : 'Katalog Premium'}
              </h2>
              <p className="text-slate-500">
                {searchQuery ? `Ditemukan ${filteredProducts.length} produk.` : 'Produk legal, harga termurah, dan stok terupdate.'}
              </p>
            </div>
            
            <div className="flex gap-2 p-1.5 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-x-auto no-scrollbar">
              <button 
                onClick={() => setSelectedCategory('all')}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${selectedCategory === 'all' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                Semua
              </button>
              {categories.map(cat => (
                <button 
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${selectedCategory === cat ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {error ? (
            <div className="p-8 rounded-3xl bg-red-50 border border-red-100 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto text-2xl">
                <i className="fa-solid fa-circle-exclamation"></i>
              </div>
              <h3 className="text-xl font-bold text-red-900">Gagal Memuat Katalog</h3>
              <p className="text-red-700">{error}</p>
              <button onClick={() => fetchProducts()} className="px-6 py-2 bg-red-600 text-white rounded-xl font-bold">Coba Lagi</button>
            </div>
          ) : loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white rounded-[2rem] p-4 shadow-sm border border-slate-100 animate-pulse">
                  <div className="aspect-[4/3] bg-slate-100 rounded-2xl mb-6"></div>
                  <div className="space-y-3 h-20">
                    <div className="h-4 bg-slate-100 rounded-full w-3/4"></div>
                    <div className="h-4 bg-slate-100 rounded-full w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {filteredProducts.map(product => (
                <div key={product.id} className="group h-full">
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center bg-white rounded-[3rem] border border-slate-200 border-dashed">
              <div className="w-24 h-24 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-6 text-4xl text-slate-300">
                <i className="fa-solid fa-box-open"></i>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Produk Tidak Ditemukan</h3>
              <p className="text-slate-500 mb-8">Maaf, kami sedang mengupdate stok untuk kategori ini.</p>
              <button onClick={() => setSelectedCategory('all')} className="text-indigo-600 font-bold hover:underline">Kembali ke Semua Produk</button>
            </div>
          )}
        </div>
      </section>

      {/* ===== BENEFITS SECTION ===== */}
      <section className="py-24 bg-white border-y border-slate-100">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <h2 className="text-sm font-bold text-indigo-600 uppercase tracking-widest">Why Us</h2>
                <h3 className="text-4xl font-black text-slate-900 leading-tight">Standar Baru Belanja Produk Digital</h3>
                <p className="text-lg text-slate-500 leading-relaxed">Kami menggabungkan kenyamanan teknologi dengan keandalan dukungan manusia. Hasilnya? Pengalaman tanpa celah.</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                {[
                  { title: 'Transparansi', desc: 'Jejak pesanan tercatat rapi di database sistem.', icon: 'fa-eye' },
                  { title: 'Sistem Kilat', desc: 'Auto-processing memastikan akun dikirim segera.', icon: 'fa-bolt-lightning' },
                  { title: 'Safe Access', desc: 'Metode legal sesuai ToS penyedia layanan.', icon: 'fa-shield-halved' },
                  { title: 'Human Support', desc: 'Admin nyata, bukan sekadar bot otomatis.', icon: 'fa-user-tie' }
                ].map(item => (
                  <div key={item.title} className="p-6 rounded-2xl bg-slate-50 border border-slate-100 hover:border-indigo-200 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center mb-4 text-sm">
                      <i className={`fa-solid ${item.icon}`}></i>
                    </div>
                    <h4 className="font-bold text-slate-900 mb-1">{item.title}</h4>
                    <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
               <div className="absolute -inset-4 bg-indigo-500/10 rounded-full blur-3xl opacity-50"></div>
               <div className="relative rounded-[3rem] overflow-hidden shadow-2xl shadow-indigo-200 border-8 border-white">
                 <img src="https://images.unsplash.com/photo-1633356122544-f134324a6cee?q=80&w=2070&auto=format&fit=crop" alt="Premium Tech" className="w-full h-auto grayscale-[0.2] hover:grayscale-0 transition-all duration-700" />
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS SECTION ===== */}
      <section className="py-24 bg-[#fcfcff]">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="text-center mb-16 space-y-3">
             <h2 className="text-4xl font-black text-slate-900">Suara Pelanggan</h2>
             <p className="text-slate-500">Ribuan aktivasi telah kami bantu setiap bulannya.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { quote: 'Gak nyangka secepat ini. Bayar, langsung dapet login. Netflix saya aman sudah 3 bulan.', name: 'Rudy S.', loc: 'Lombok', role: 'Movie Enthusiast' },
              { quote: 'Canva Pro-nya murah banget dibanding langganan sendiri. Sangat membantu buat tugas desain saya.', name: 'Sarah W.', loc: 'Jakarta', role: 'Graphic Designer' },
              { quote: 'Udah langganan Spotify & YouTube di sini setahun. Gak pernah ada kendala, adminnya gercep.', name: 'Andi P.', loc: 'Surabaya', role: 'Freelancer' }
            ].map((t, idx) => (
              <div key={idx} className="p-8 rounded-[2.5rem] bg-white border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300">
                <div className="flex gap-1 text-amber-400 mb-6">
                  {[...Array(5)].map((_, i) => <i key={i} className="fa-solid fa-star text-xs"></i>)}
                </div>
                <p className="text-slate-700 text-lg italic mb-8 leading-relaxed">"{t.quote}"</p>
                <div className="flex items-center gap-4 pt-6 border-t border-slate-50">
                   <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black">{t.name[0]}</div>
                   <div>
                      <div className="font-bold text-slate-900">{t.name}</div>
                      <div className="text-xs text-slate-400 uppercase tracking-wider">{t.role}</div>
                   </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FAQ SECTION ===== */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6 max-w-3xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-slate-900">Sering Ditanyakan</h2>
          </div>

          <div className="space-y-4">
            {[
              { q: 'Berapa lama proses order biasanya?', a: 'Estimasi proses 1-10 menit pada jam operasional (08.00 - 23.00 WITA). Sistem kami bekerja secara otomatis untuk mendeteksi pembayaran QRIS Anda.' },
              { q: 'Apakah ini akun legal dan aman?', a: 'Ya, kami menggunakan metode berlangganan resmi dan legal. Semua akun dijamin aman selama Anda mengikuti panduan penggunaan yang kami berikan.' },
              { q: 'Bagaimana jika akun bermasalah?', a: 'Kami memberikan garansi masa pakai penuh. Jika terjadi kendala, silakan hubungi admin via WhatsApp untuk penanganan atau penggantian unit baru.' },
              { q: 'Metode pembayaran apa saja yang diterima?', a: 'Saat ini kami mendukung QRIS yang bisa dibayar melalui aplikasi bank manapun (BCA, Mandiri, BNI, dll) maupun e-wallet (Gopay, OVO, Dana, LinkAja).' }
            ].map((faq, i) => (
              <details key={i} className="group bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden transition-all">
                <summary className="p-6 font-bold text-slate-900 flex justify-between items-center cursor-pointer hover:bg-slate-100/50 list-none">
                  {faq.q}
                  <span className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-xs group-open:rotate-180 transition-transform">
                    <i className="fa-solid fa-chevron-down"></i>
                  </span>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed text-sm border-t border-slate-100 pt-4">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA SECTION ===== */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="relative rounded-[3rem] bg-[#0a0d1d] p-8 md:p-16 overflow-hidden text-center lg:text-left">
            <div className="absolute top-0 right-0 w-[40%] h-full bg-indigo-600 opacity-20 blur-[100px] pointer-events-none"></div>
            
            <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-12">
              <div className="space-y-6 max-w-2xl">
                <h2 className="text-4xl md:text-5xl font-black text-white leading-tight">
                  Tingkatkan Level Digital Anda Hari Ini
                </h2>
                <p className="text-slate-400 text-lg font-light">
                  Jangan buang waktu dengan harga mahal. Dapatkan akses premium sekarang dan bergabunglah dengan 5,000+ pelanggan puas kami.
                </p>
                <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
                   <Link href="#products" className="px-8 py-4 bg-white text-indigo-900 rounded-2xl font-black hover:bg-indigo-50 transition-all">Mulai Belanja</Link>
                   <a href="https://wa.me/6282340915319" className="px-8 py-4 bg-white/10 text-white rounded-2xl font-black border border-white/20 hover:bg-white/20 transition-all">Tanya Admin</a>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <a href="https://t.me/AutoOrderPBS_bot" target="_blank" className="p-6 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group text-center">
                  <i className="fa-brands fa-telegram text-3xl text-[#0088cc] mb-3 group-hover:scale-110 transition-transform"></i>
                  <div className="text-xs font-bold text-white uppercase tracking-tighter">Telegram Bot</div>
                </a>
                <a href="https://chat.whatsapp.com/your-group-link" target="_blank" className="p-6 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group text-center">
                  <i className="fa-solid fa-users text-3xl text-green-400 mb-3 group-hover:scale-110 transition-transform"></i>
                  <div className="text-xs font-bold text-white uppercase tracking-tighter">WA Community</div>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Footer minimalis */}
      <footer className="py-12 bg-white border-t border-slate-100 text-center">
        <p className="text-slate-400 text-sm font-medium">© 2024 Putra BTT Store. All rights reserved.</p>
        <div className="flex justify-center gap-6 mt-4 text-slate-300">
           <i className="fa-brands fa-instagram hover:text-pink-500 cursor-pointer transition-colors"></i>
           <i className="fa-brands fa-tiktok hover:text-black cursor-pointer transition-colors"></i>
           <i className="fa-brands fa-facebook hover:text-blue-600 cursor-pointer transition-colors"></i>
        </div>
      </footer>

      {/* Tailwind Specific Animations */}
      <style jsx global>{`
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient {
          background-size: 200% auto;
          animation: gradient 3s linear infinite;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#0a0d1d]">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <HomeInner />
    </Suspense>
  )
}
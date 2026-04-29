# PBS User Store - Web Pembelian

Web aplikasi e-commerce untuk user dengan fitur lengkap dari katalog hingga pembayaran QRIS.

## 🚀 Fitur

- ✅ **Katalog Produk** - Menampilkan semua produk dari database Supabase
- ✅ **Filter Kategori** - Filter produk berdasarkan kategori
- ✅ **Detail Produk** - Informasi lengkap produk dengan gambar
- ✅ **Shopping Cart** - Keranjang belanja dengan update quantity real-time
- ✅ **Checkout** - Form checkout dengan validasi
- ✅ **Pembayaran QRIS** - Integrasi Midtrans untuk pembayaran QRIS only
- ✅ **Order Tracking** - Status pesanan dan konfirmasi pembayaran
- ✅ **Email Delivery Copy** - Salinan item digital otomatis ke email customer setelah payment sukses
- ✅ **Responsive Design** - UI yang optimal di semua device

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase
- **Payment**: Midtrans (QRIS)
- **State Management**: React Context API

## 📦 Installation

1. Install dependencies:
```bash
npm install
```

2. Setup environment variables:
Buat file `.env.local` dan isi dengan:
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Midtrans Configuration
MIDTRANS_SERVER_KEY=your_midtrans_server_key
MIDTRANS_CLIENT_KEY=your_midtrans_client_key
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=your_midtrans_client_key
MIDTRANS_IS_PRODUCTION=false

# SMTP (Email Delivery)
SMTP_URL=
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
SMTP_FROM_NAME=Putra BTT Store
SMTP_FROM_EMAIL=your_sender_email@example.com
ORDER_EMAIL_MAX_ATTEMPTS=3
ORDER_EMAIL_RETRY_DELAY_MS=1000
```

> **Tip**: Anda bisa copy credentials dari file `.env` di folder `bot-telegram` atau `dashboard`.

3. Run development server:
```bash
npm run dev
```

Web akan berjalan di `http://localhost:3001`

## 📁 Struktur Project

```
user/
├── app/
│   ├── api/
│   │   ├── checkout/          # API untuk create transaction
│   │   └── payment-status/    # API untuk cek status payment
│   ├── cart/                  # Halaman keranjang
│   ├── checkout/              # Halaman checkout
│   ├── order-success/         # Halaman sukses
│   ├── order-pending/         # Halaman pending
│   ├── product/[id]/          # Halaman detail produk
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx               # Halaman katalog
├── components/
│   ├── CartProvider.tsx       # Context untuk cart
│   ├── Header.tsx             # Header dengan cart icon
│   └── ProductCard.tsx        # Card produk
├── lib/
│   ├── database.types.ts      # TypeScript types untuk Supabase
│   └── supabase.ts            # Supabase client
└── package.json
```

## 🔄 Flow Aplikasi

1. **Home (Katalog)** - User melihat produk, bisa filter by kategori
2. **Product Detail** - User klik produk untuk lihat detail
3. **Add to Cart** - User tambah produk ke keranjang (bisa dari katalog atau detail)
4. **Cart** - User review items, update quantity, atau hapus item
5. **Checkout** - User isi data (nama, email, phone)
6. **Payment** - User scan QRIS untuk bayar
7. **Success/Pending** - Konfirmasi status pembayaran

## 🎨 Fitur UI/UX

- **Header sticky** dengan cart badge showing item count
- **Loading skeletons** saat fetch data
- **Toast notifications** saat add to cart
- **Empty states** untuk cart kosong
- **Stock indicators** (Stok Terbatas, Habis)
- **Category pills** untuk filter
- **Responsive grid** (1-4 columns tergantung screen size)
- **Smooth transitions** dan hover effects

## 💳 Pembayaran

Aplikasi menggunakan **Midtrans Snap** dengan metode pembayaran **QRIS only**.

Flow pembayaran:
1. User submit checkout form
2. Backend create order di database
3. Backend request snap token ke Midtrans
4. Midtrans Snap popup muncul dengan QR code
5. User scan dan bayar
6. Callback dari Midtrans update status order
7. Stock produk dikurangi otomatis saat payment success
8. Item digital tetap tampil di halaman sukses
9. Salinan item digital dikirim otomatis ke email customer (idempotent + retry)

## 🗃️ Database Schema

Aplikasi menggunakan table berikut di Supabase:

- **products** - Data produk
- **orders** - Data pesanan
- **order_items** - Item dalam pesanan

Untuk detail setup fitur email delivery, lihat dokumen [EMAIL-DELIVERY-SETUP.md](EMAIL-DELIVERY-SETUP.md).

## 🚀 Production Deployment

1. Build production:
```bash
npm run build
```

2. Start production server:
```bash
npm start
```

3. Environment variables untuk production:
   - Set `MIDTRANS_IS_PRODUCTION=true`
   - Gunakan production keys dari Midtrans
   - Ganti Snap URL ke production: `https://app.midtrans.com/snap/snap.js`

## 📝 Notes

- Port default: `3001` (agar tidak konflik dengan dashboard di `3000`)
- Cart tersimpan di `localStorage`
- Semua harga dalam IDR (Rupiah)
- Images menggunakan Next.js Image optimization
- Support semua e-wallet yang support QRIS (GoPay, OVO, Dana, dll)

## 🔗 Integrasi dengan Project Lain

Web ini terintegrasi dengan:
- **Bot Telegram** - Sharing database Supabase
- **Dashboard** - Sharing database Supabase
- Product management dilakukan via Dashboard
- Orders visible di Dashboard dan Bot

## 🐛 Troubleshooting

**Snap tidak muncul?**
- Check Midtrans client key sudah benar
- Check browser console untuk errors
- Pastikan Snap script loaded (cek network tab)

**Payment tidak update?**
- Check Midtrans webhook settings
- Verify server key dan client key match
- Check order status di Midtrans dashboard

**Produk tidak muncul?**
- Verify Supabase connection
- Check products table `is_active = true`
- Check browser console untuk errors

## 📄 License

MIT License - Free to use and modify

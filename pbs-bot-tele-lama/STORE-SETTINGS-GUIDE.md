# Store Settings Guide

## Overview
Dashboard admin sekarang memiliki fitur **Store Settings** yang memungkinkan Anda mengonfigurasi toko langsung dari halaman settings tanpa perlu edit file `.env`.

## Lokasi Settings
1. Login ke dashboard admin
2. Klik **Settings** di sidebar
3. Scroll ke bagian **Store Settings** (bagian paling atas)

## Pengaturan yang Tersedia

### 📝 Basic Information

#### **Store Name**
- Nama toko yang ditampilkan di bot dan dashboard
- Contoh: `Putra Btt Store`

#### **Store Description**
- Deskripsi singkat tentang toko Anda
- Contoh: `Toko Digital Terpercaya #1`

#### **Support Contact**
- Kontak support untuk customer
- Format: `@username` atau `+62xxx`
- Contoh: `@aryadwinata543`

#### **Catalog Banner URL**
- URL gambar banner untuk katalog produk
- Upload gambar ke: Imgur, ImgBB, atau hosting lain
- Format: `https://example.com/banner.jpg`
- **Tip:** Kosongkan untuk menonaktifkan banner

---

### 🖥️ Display Settings

#### **Items Per Page**
- Jumlah produk yang ditampilkan per halaman di katalog
- Min: 5, Max: 50
- Default: `10`

#### **Grid Columns**
- Jumlah kolom untuk tampilan grid produk
- Min: 2, Max: 8
- Default: `5`

---

### 💳 Payment Settings

#### **Payment Expiry (minutes)**
- Waktu expired untuk pembayaran (dalam menit)
- Min: 5, Max: 60
- Default: `15`
- Setelah waktu ini, order akan otomatis dibatalkan

#### **Currency**
- Mata uang yang digunakan
- Pilihan:
  - IDR (Indonesian Rupiah)
  - USD (US Dollar)
  - EUR (Euro)
  - MYR (Malaysian Ringgit)
- Default: `IDR`

---

### ✨ Features

#### **Enable Promo Codes**
- ✅ Aktifkan: User bisa menggunakan kode promo/diskon
- ❌ Nonaktifkan: Fitur promo code tidak tersedia

#### **Enable Referral System**
- ✅ Aktifkan: User bisa mereferensikan teman dan dapat reward
- ❌ Nonaktifkan: Sistem referral dimatikan

#### **Enable Analytics**
- ✅ Aktifkan: Tracking perilaku user dan data penjualan
- ❌ Nonaktifkan: Analytics tidak direkam

#### **Enable Favorites**
- ✅ Aktifkan: User bisa menyimpan produk favorit
- ❌ Nonaktifkan: Fitur favorites tidak tersedia

---

## Cara Menyimpan Settings

1. Ubah nilai yang ingin Anda update
2. Klik tombol **Save Settings** di bawah form
3. Tunggu notifikasi "Settings saved successfully!"
4. Settings akan langsung aktif tanpa perlu restart bot

---

## Database Migration

### Setup Pertama Kali

Jika baru pertama kali setup, jalankan migration berikut di **Supabase SQL Editor**:

1. Buka **Supabase Dashboard** → **SQL Editor**
2. Klik **New Query**
3. Copy-paste isi file: `supabase/migrations/005_settings_table.sql`
4. Klik **Run**

Migration akan:
- ✅ Membuat tabel `settings`
- ✅ Setup Row Level Security (RLS)
- ✅ Insert default settings dari .env
- ✅ Create trigger untuk auto-update timestamp

---

## Integasi dengan Bot

Bot akan otomatis membaca settings dari database dengan fallback ke `.env`:

```javascript
const { getAppSettings, getAppSetting } = require('./src/services/appSettings')

// Get all settings
const settings = await getAppSettings()
console.log(settings.store_name) // "Putra Btt Store"

// Get specific setting
const storeName = await getAppSetting('store_name')
```

### Cache Mechanism
- Settings di-cache selama 1 menit
- Mengurangi load database
- Auto-refresh setelah TTL expired

---

## Best Practices

### 🎨 Banner Image
- Ukuran rekomendasi: **1200x400px** atau **1920x600px**
- Format: JPG, PNG, WebP
- Size: < 500KB untuk loading cepat
- Upload ke:
  - [Imgur](https://imgur.com/upload)
  - [ImgBB](https://imgbb.com/)
  - [GitHub Pages](https://pages.github.com/)

### ⚡ Performance
- **Items Per Page**: 10-15 untuk pengalaman terbaik
- **Payment Expiry**: 15-30 menit cukup optimal
- **Grid Columns**: 3-5 untuk mobile-friendly

### 🔒 Security
- Hanya admin yang bisa akses halaman settings
- Settings sensitif (API keys, tokens) tetap di `.env`
- RLS policy protect data dari unauthorized access

---

## Troubleshooting

### Settings tidak tersimpan?
1. Cek koneksi ke Supabase
2. Pastikan migration sudah dijalankan
3. Cek RLS policies di Supabase

### Settings tidak muncul di bot?
1. Wait 1 menit (cache TTL)
2. Restart bot jika perlu
3. Cek logs untuk error

### Default settings muncul terus?
1. Cek tabel `settings` di Supabase apakah ada data
2. Jalankan migration jika belum
3. Pastikan koneksi database OK

---

## Environment Variables Priority

**Prioritas loading:**
1. **Database Settings** (dari Supabase) ✨
2. **Environment Variables** (dari .env)
3. **Default Hardcoded** (fallback)

Settings di database akan **override** settings di `.env`.

---

## Support

Jika ada masalah, hubungi support atau buat issue di GitHub repository.

**Happy selling! 🚀**

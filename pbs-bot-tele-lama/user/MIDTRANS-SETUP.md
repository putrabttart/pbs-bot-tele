# Midtrans Setup Guide

Untuk mengaktifkan sistem pembayaran QRIS di PBS Store, Anda perlu mengonfigurasi Midtrans API credentials.

## Langkah-langkah Setup

### 1. Buat Akun Midtrans
- Kunjungi https://account.midtrans.com/register
- Daftar dengan email Anda
- Verifikasi email Anda

### 2. Dapatkan API Credentials
- Login ke Midtrans Dashboard
- Navigasi ke: **Settings → Access Keys** atau **Pengaturan → Kunci Akses**
- Anda akan melihat:
  - **Server Key** (simpan ini dengan aman!)
  - **Client Key** (dapat dipublikasikan)

### 3. Tentukan Mode (Sandbox vs Production)
- **Sandbox**: Untuk testing/development
- **Production**: Untuk live/production

#### Untuk Testing (Sandbox):
```
Mode: Sandbox
URL: https://app.sandbox.midtrans.com
```

#### Untuk Production:
```
Mode: Production  
URL: https://app.midtrans.com
```

### 4. Update Environment Variables

Edit file `.env.local` di folder `/user`:

```env
# Untuk Testing (Sandbox) - RECOMMENDED
MIDTRANS_SERVER_KEY=SB-Mid-server-[YOUR_SANDBOX_SERVER_KEY]
MIDTRANS_CLIENT_KEY=SB-Mid-client-[YOUR_SANDBOX_CLIENT_KEY]
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=SB-Mid-client-[YOUR_SANDBOX_CLIENT_KEY]
MIDTRANS_IS_PRODUCTION=false

# Atau untuk Production
MIDTRANS_SERVER_KEY=Mid-server-[YOUR_PRODUCTION_SERVER_KEY]
MIDTRANS_CLIENT_KEY=Mid-client-[YOUR_PRODUCTION_CLIENT_KEY]
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=Mid-client-[YOUR_PRODUCTION_CLIENT_KEY]
MIDTRANS_IS_PRODUCTION=true
```

### 5. Testing Credentials

Untuk test awal, Anda bisa gunakan test account yang sudah ada di Midtrans:

**Sandbox Server Key:**
```
SB-Mid-server-VLuaKmcLFh6PqAzfqe3Bqt3-
```

**Sandbox Client Key:**
```
SB-Mid-client-v0VMnbmf6dce4jGy
```

### 6. Restart Server
```bash
# Berhentikan server (Ctrl+C)
npm run dev
```

### 7. Test Payment Flow

1. Buka http://localhost:3001
2. Pilih produk dan add to cart
3. Klik checkout
4. Isi form dengan data:
   - Nama: Test User
   - Email: test@example.com
   - No. Telepon: 08123456789
5. Klik "Bayar Sekarang"
6. Pilih QRIS untuk pembayaran

### 8. Test Payment di Sandbox

Untuk test pembayaran di Sandbox Midtrans:

**Nomor Kartu Kredit Test:**
- Card Number: 4811111111111114
- CVV: 123
- Exp Date: 12/25

**E-wallet Test:**
- QRIS: Gunakan scanner QRIS biasa di app e-wallet

## Troubleshooting

### Error: "Transaksi tidak ditemukan"
- Pastikan Midtrans credentials benar
- Pastikan isProduction setting sesuai dengan mode credentials
- Cek apakah sandboxnya aktif di dashboard Midtrans

### Error: "Could not connect to Midtrans"
- Pastikan internet connection aktif
- Cek apakah URL Midtrans API accessible
- Verifikasi Server Key dan Client Key tidak ada typo

### QRIS tidak muncul
- Pastikan `enabled_payments: ['qris']` sudah diset di API
- Cek apakah merchant account sudah enable QRIS
- Verifikasi di dashboard Midtrans → Settings → Payment Channels

## Documentation

- Midtrans Docs: https://docs.midtrans.com
- QRIS Payment: https://docs.midtrans.com/reference/snap-api#enabled-payments
- Testing: https://docs.midtrans.com/reference/test-card-numbers

## Support

Jika ada masalah:
1. Check console browser (F12) untuk error messages
2. Check terminal untuk server logs
3. Hubungi Midtrans support: support@midtrans.com

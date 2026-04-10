# Email Delivery Setup (Salinan Item Digital ke Email Customer)

## Ringkasan
Fitur ini menambahkan pengiriman otomatis salinan item digital ke email customer setelah pembayaran sukses.

Flow yang dipertahankan:
1. Customer checkout dan bayar.
2. Item digital tetap ditampilkan di halaman sukses seperti sebelumnya.
3. Sistem juga mengirim salinan item ke email customer.

## Analisa Flow Saat Ini
Sumber flow utama:
- Checkout create order: `user/app/api/checkout/route.ts`
- Payment webhook success/fail: `user/app/api/webhook/route.ts`
- Halaman sukses (display item): `user/app/order-success/page.tsx`
- API order details untuk halaman sukses: `user/app/api/orders/[orderId]/route.ts`

Flow lama sudah memakai:
- Validasi signature Midtrans.
- Finalize item setelah payment sukses.
- Simpan item data ke `order_items`.
- Tampilkan item di halaman sukses.

## Perubahan yang Ditambahkan

### 1) Database (Idempotency + Retry State)
Migration baru:
- `supabase/migrations/011_add_order_delivery_email_tracking.sql`

Kolom baru di table `orders`:
- `delivery_email_status` (`pending`/`processing`/`sent`/`failed`)
- `delivery_email_attempts`
- `delivery_email_last_attempt_at`
- `delivery_email_last_error`
- `delivery_email_sent_at`

Tujuan:
- Mencegah email terkirim dua kali saat webhook dipanggil ulang.
- Menyimpan status gagal agar bisa dicoba lagi saat webhook retry.

### 2) Backend Email Service
File baru:
- `user/lib/email/order-delivery-template.ts`
- `user/lib/email/smtp-delivery.ts`

Fitur:
- Validasi email customer.
- Template email berisi:
  - Nama produk
  - Detail item digital
  - Nomor order
  - Tanggal transaksi
  - Pesan bahwa email adalah salinan pembelian
- SMTP sending dengan retry (default 3 attempt, exponential backoff).

### 3) Webhook Payment Success Integration
File update:
- `user/app/api/webhook/route.ts`

Perubahan:
- Saat status payment sukses (`capture`/`settlement`), sistem tetap menjalankan flow lama.
- Setelah itu, webhook mencoba claim lock email delivery berbasis DB.
- Jika claim berhasil:
  - Build payload item dari order + order_items + notes.
  - Kirim email via SMTP dengan retry.
  - Update status email ke `sent` atau `failed`.
- Jika claim gagal (sudah sent/processing), email tidak dikirim ulang.

### 4) Validasi Email Checkout
File update:
- `user/app/checkout/page.tsx`
- `user/app/api/checkout/route.ts`
- `user/app/api/orders/search/route.ts`

Perubahan:
- Email dinormalisasi (trim + lowercase).
- Validasi format email di frontend dan backend.
- Warning jelas di halaman checkout agar customer mengisi email aktif dan valid.

## Setup SMTP
Tambahkan env berikut pada `user/.env.local`:

```env
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

Catatan:
- Anda bisa pakai `SMTP_URL` jika provider memberi connection string.
- Jika `SMTP_URL` diisi, konfigurasi host/port/user/pass akan diabaikan.
- Untuk Gmail, gunakan App Password (bukan password akun biasa).
- Jika App Password Gmail terlihat ber-spasi (contoh: `abcd efgh ijkl mnop`), boleh tetap ditempel apa adanya. Sistem akan normalisasi otomatis.

## Catatan Webhook (Penting)
Email otomatis utama dipicu dari webhook payment sukses.

Untuk local/dev, pastikan web store juga menerima callback Midtrans:
- Set `MIDTRANS_DEV_WEBHOOK_URL` mengarah ke endpoint web store, contoh:
   - `https://domain-ngrok-anda/api/webhook`
- Atau set Notification URL Midtrans langsung ke endpoint web store jika tidak memakai append header.

Jika webhook web store tidak masuk, sistem sekarang punya fallback di endpoint order details saat status sudah completed + item sudah ready.

## Jalankan Migration
Jalankan migration `011_add_order_delivery_email_tracking.sql` ke database Supabase Anda.

Pastikan kolom baru muncul di table `orders` sebelum test payment success.

## Checklist Testing
1. Checkout dengan email valid.
2. Selesaikan payment sampai status sukses.
3. Verifikasi item tetap tampil di halaman sukses.
4. Verifikasi email masuk ke inbox customer.
5. Cek table `orders`:
   - `delivery_email_status = sent`
   - `delivery_email_sent_at` terisi.
6. Uji duplicate webhook callback:
   - Email tidak terkirim dua kali.
7. Uji email gagal (mis. SMTP dimatikan sementara):
   - Status menjadi `failed`.
   - `delivery_email_last_error` terisi.

## Keamanan
- Item tidak dikirim via email sebelum payment sukses.
- Validasi email dilakukan sebelum pengiriman.
- Idempotency lock mencegah duplicate email pada webhook retry.
- Retry mechanism menangani kegagalan sementara SMTP.

## Kompatibilitas
- Flow lama tampilan item di web tidak diubah.
- Perubahan schema hanya menambah kolom baru (non-breaking).
- Tidak ada perubahan pada struktur item delivery lama selain penambahan channel email.

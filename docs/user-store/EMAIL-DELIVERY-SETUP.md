# Email Delivery Setup (Resend)

Dokumen ini menjelaskan migrasi email delivery customer dari SMTP/Gmail ke Resend tanpa mengubah flow checkout, payment webhook, dan delivery item.

## Tujuan

- Provider email utama: Resend.
- Flow transaksi tetap sama (non-breaking).
- Idempotency email delivery tetap aktif.
- SMTP lama tetap bisa dijadikan fallback jika diperlukan.

## Arsitektur Flow (Tetap)

1. Customer checkout dan bayar.
2. Midtrans kirim notifikasi ke bot webhook.
3. Bot forward webhook ke web user (`/api/webhook`).
4. Web finalize item digital seperti biasa.
5. Web kirim salinan item digital ke email customer via provider email aktif.

Referensi implementasi:

- Email service provider-agnostic: `user/lib/email/smtp-delivery.ts`
- Trigger email dari payment webhook: `user/app/api/webhook/route.ts`
- Endpoint test provider/email: `user/app/api/test-email/route.ts`

## Environment Variables

Gunakan konfigurasi berikut di `user/.env.local` (lokal) dan Railway Variables (production):

```env
# Select provider: resend | smtp
EMAIL_PROVIDER=resend

# Shared test target (optional)
EMAIL_TEST_TO=

# Resend (utama)
RESEND_API_KEY=
RESEND_FROM_NAME=Putra BTT Store
RESEND_FROM_EMAIL=onboarding@resend.dev
RESEND_TEST_TO=

# SMTP fallback (opsional, boleh tetap ada)
SMTP_URL=
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM_NAME=Putra BTT Store
SMTP_FROM_EMAIL=

# Retry config (tetap dipakai)
ORDER_EMAIL_MAX_ATTEMPTS=4
ORDER_EMAIL_RETRY_DELAY_MS=1500
```

Catatan:

- `EMAIL_PROVIDER=resend` wajib agar jalur pengiriman memakai Resend.
- `RESEND_FROM_EMAIL` harus sender yang valid di akun Resend.
- SMTP tidak perlu dihapus; cukup diposisikan sebagai fallback.

## Setup Resend (Lengkap)

### 1) Buat akun dan API key

1. Login/daftar di https://resend.com.
2. Buka menu API Keys.
3. Buat key baru (disarankan scope minimal untuk send email).
4. Simpan ke `RESEND_API_KEY`.

### 2) Verifikasi sender/domain

Opsi A (cepat untuk test awal):

- Gunakan `RESEND_FROM_EMAIL=onboarding@resend.dev`.
- Cocok untuk uji awal integrasi.

Opsi B (direkomendasikan production):

1. Tambahkan domain Anda di Resend.
2. Ikuti instruksi DNS (SPF, DKIM, kemungkinan DMARC).
3. Tunggu status domain menjadi verified.
4. Gunakan `RESEND_FROM_EMAIL` dari domain terverifikasi, contoh: `noreply@domainanda.com`.

### 3) Set env lokal

1. Isi `user/.env.local` dengan nilai Resend di atas.
2. Pastikan `EMAIL_PROVIDER=resend`.
3. Jalankan app:

```bash
cd user
npm install
npm run dev
```

### 4) Uji koneksi + kirim email test

Gunakan endpoint test:

```bash
GET /api/test-email?to=customer@example.com
```

Atau POST JSON:

```json
{
  "to": "customer@example.com",
  "subject": "Test Resend",
  "text": "Email test dari Resend"
}
```

Respons sekarang memuat:

- `provider`
- `provider_connection`
- `smtp_connection` (legacy compatibility)
- `email_send_status`
- `diagnostics`

## Setup Railway (Production)

1. Buka service `user` di Railway.
2. Tambahkan variables berikut:
   - `EMAIL_PROVIDER=resend`
   - `RESEND_API_KEY=<api-key-anda>`
   - `RESEND_FROM_NAME=Putra BTT Store`
   - `RESEND_FROM_EMAIL=<sender-terverifikasi>`
   - `ORDER_EMAIL_MAX_ATTEMPTS=4`
   - `ORDER_EMAIL_RETRY_DELAY_MS=1500`
3. Redeploy service.
4. Jalankan test endpoint `/api/test-email` setelah deploy.

## Midtrans + Bot Forward Tetap Sama

Migrasi provider email tidak mengubah konfigurasi webhook payment:

- Midtrans Notification URL tetap mengarah ke endpoint bot.
- Bot tetap forward ke endpoint web user (`/api/webhook`).
- Hanya layer pengiriman email yang berubah ke Resend.

## Monitoring & Verifikasi

Cek kolom pada tabel `orders`:

- `delivery_email_status` (`pending|processing|sent|failed`)
- `delivery_email_attempts`
- `delivery_email_last_error`
- `delivery_email_sent_at`

Skenario sukses:

- order `completed`
- item berhasil delivered
- `delivery_email_status=sent`

## Troubleshooting Cepat

Jika gagal kirim, lihat `delivery_email_last_error` dan logs:

- `RESEND_CONFIG_ERROR`: env Resend belum lengkap.
- `RESEND_AUTH_FAILED`: API key invalid/tidak punya izin.
- `RESEND_DOMAIN_UNVERIFIED`: sender domain belum verified.
- `RESEND_RATE_LIMITED`: kena rate limit.
- `RESEND_API_ERROR`: gangguan API/network sementara.

Checklist cepat:

1. `EMAIL_PROVIDER` benar `resend`.
2. `RESEND_API_KEY` terisi dan valid.
3. `RESEND_FROM_EMAIL` valid di Resend.
4. Domain sudah verified (untuk production sender).
5. Endpoint `/api/test-email` sukses.

## Rollback Cepat ke SMTP (Jika Darurat)

Jika perlu rollback sementara:

1. Set `EMAIL_PROVIDER=smtp`.
2. Pastikan env SMTP valid.
3. Redeploy.

Flow order/webhook tetap tidak berubah karena interface service email dipertahankan.

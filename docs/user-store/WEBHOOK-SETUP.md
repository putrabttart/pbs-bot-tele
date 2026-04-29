# Setup Webhook Notification untuk Payment

## Cara Kerja System Pembayaran

```
1. User QRIS Payment (Lokal: localhost:3001)
   ↓
2. Backend Create QRIS Transaction (via Midtrans API)
   ↓
3. User Selesaikan Pembayaran di QRIS
   ↓
4. Midtrans Process Pembayaran
   ↓
5. Midtrans Call Webhook Notification → Admin Server
   ↓
6. Webhook Handler Verify & Process
   ↓
7. Update Order Status → Ready to Ship
   ↓
8. Admin Pack & Ship via WhatsApp Bot
```

---

## Setup Local Webhook dengan Ngrok

### Step 1: Install Ngrok

**Option A: Menggunakan npm (Recommended)**
```bash
npm install -g ngrok
```

**Option B: Download dari website**
- https://ngrok.com/download

### Step 2: Jalankan Ngrok

Di terminal baru, jalankan:
```bash
ngrok http 3001
```

Output akan terlihat seperti:
```
ngrok                                       (Ctrl+C to quit)

Session Status  Online
Account         putrabttart@gmail.com
Version         3.3.5
Region          ap (Asia/Pacific)
Forwarding      https://abc123def45.ngrok.io -> http://localhost:3001
Forwarding      http://abc123def45.ngrok.io -> http://localhost:3001

URL Scheme      https
Auth Token      your_token_here
```

**Penting:** Copy URL `https://abc123def45.ngrok.io` (akan berubah setiap kali restart)

### Step 3: Configure Webhook URL di Midtrans Dashboard

1. Login ke https://dashboard.midtrans.com
2. Pergi ke **Settings → Notification URLs** (atau cari "Notification")
3. Isi kolom **Notification URL** dengan:
   ```
   https://abc123def45.ngrok.io/api/webhook
   ```
4. Pilih HTTP Method: `POST`
5. **SAVE/UPDATE**

### Step 4: Test Webhook

Di Midtrans dashboard, ada tombol "Send Test Notification". Klik untuk test.

Check server logs Anda di terminal Next.js untuk verify webhook diterima.

---

## Webhook Handler yang Sudah Diimplementasi

**File:** `app/api/webhook/route.ts`

**Fitur:**
- ✅ Verify signature dari Midtrans (security)
- ✅ Parse payment status (settlement, pending, cancel, etc)
- ✅ Logging untuk debugging
- ✅ Placeholder untuk notifikasi admin

**Response Status:**
- `settlement` → Pembayaran berhasil
- `capture` → Pembayaran berhasil (kartu kredit)
- `pending` → Menunggu pembayaran
- `deny` → Pembayaran ditolak
- `cancel` → User cancel
- `expire` → QR Code expired

---

## Implementasi Pengiriman Item (Future)

Setelah webhook menerima `settlement`/`capture`:

### A. **Notifikasi Admin via WhatsApp Bot**
```javascript
// Di webhook handler, bisa panggil:
await notifyAdmin('payment-success', {
  orderId: 'PBS-123456',
  customerName: 'Arya Dwinata',
  items: [...],
  total: 50000,
})
```

Contoh: Hubungkan dengan bot Telegram/WhatsApp existing untuk:
- Notify admin ada order baru
- Admin confirm & ship
- Update status ke customer

### B. **Order Database (Untuk Tracking)**
Future: Buat table `orders` di Supabase:
```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  order_id TEXT UNIQUE,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  items JSONB,
  total_amount NUMERIC,
  status TEXT, -- pending, paid, shipped, delivered
  midtrans_transaction_id TEXT,
  created_at TIMESTAMP,
  paid_at TIMESTAMP,
  shipped_at TIMESTAMP
);
```

### C. **Email Notification**
```javascript
// Saat payment success:
await sendEmail(customerEmail, {
  subject: 'Pesanan Anda Diterima!',
  body: `Pesanan ${orderId} berhasil dibayar. Barang akan dikirim segera.`
})
```

---

## Testing Flow

### Test 1: QRIS Payment (Lokal)
1. Buka http://localhost:3001
2. Tambah produk → Checkout
3. Isi form → Bayar Sekarang
4. Scan QRIS dengan test credentials

### Test 2: Check Payment Status
1. Di halaman order-pending, klik "Cek Status Pembayaran"
2. System akan query Midtrans API
3. Jika sudah dibayar, redirect ke order-success

### Test 3: Webhook Notification
1. Login Midtrans Dashboard
2. Settings → Notification URLs
3. Klik tombol test
4. Check server logs untuk verify signature & process

---

## Troubleshooting

### Ngrok disconnect / URL berubah
- Ngrok free tier rotate URL setiap ~2 jam
- Solusi: Subscribe ngrok atau update URL di Midtrans setiap kali ngrok restart
- Untuk production: Gunakan domain tetap + subdomain atau IP publik

### Webhook tidak diterima
- Check Midtrans dashboard → Logs/History
- Verify URL di Notification Settings benar
- Ensure firewall not blocking ngrok
- Check console.log di server

### Signature verification failed
- Ensure `MIDTRANS_SERVER_KEY` benar di .env.local
- Check production mode match (isProduction setting)

---

## Production Setup (Nanti)

Ketika live:
1. Deploy ke Railway/Vercel/server publik
2. Update Midtrans Notification URL ke domain publik Anda
3. Implement proper order database
4. Setup WhatsApp/Email notification service
5. Enable SSL/TLS

---

## Related Files

- Webhook Handler: `app/api/webhook/route.ts`
- Payment Status Check: `app/api/payment-status/route.ts`
- Order Pending Page: `app/order-pending/page.tsx`
- Checkout Page: `app/checkout/page.tsx`

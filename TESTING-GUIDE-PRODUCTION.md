# 🧪 TESTING GUIDE - PRODUCTION (store.pbs.web.id)

**Domain:** https://store.pbs.web.id/  
**Tanggal:** Feb 24, 2026  
**Tujuan:** Verifikasi 5 security patches berjalan di production  

---

## 1️⃣ TEST: PRICE TAMPERING PREVENTION
### Tujuan: Pastikan harga tidak bisa diubah dari client

#### Scenario A: Coba hack harga (harus GAGAL)
```bash
curl -X POST https://store.pbs.web.id/api/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "product": {
          "kode": "P001",
          "harga": 1,
          "nama": "iPhone 15"
        },
        "quantity": 1
      }
    ],
    "customerName": "Coba Hack",
    "customerEmail": "hacker@test.com",
    "customerPhone": "081234567890"
  }'
```

#### Expected Response: ✅ PASS
```json
{
  "success": true,
  "orderId": "PBS-1708747200000-abc123",
  "transactionId": "...",
  "amount": 10000000,
  "message": "Order created successfully"
}
```

**Cek penting:**
- ✅ `"amount"` adalah harga dari DATABASE (bukan 1!)
- ✅ Respon TIDAK mengandung `qrString` atau `qrUrl`
- ✅ Status 200 OK

#### ❌ JIKA GAGAL (Indikator Vulnerability)
```json
{
  "error": "Keranjang kosong",
  "status": 400
}
```
- ❌ Product tidak ada di database → tambahkan product dulu!

---

## 2️⃣ TEST: RATE LIMITING
### Tujuan: Pastikan endpoint terlindungi dari spamming

#### Scenario: Kirim 6 request dalam 10 detik (request ke-6 harus ditolak)

**Script bash:**
```bash
#!/bin/bash
for i in {1..6}; do
  echo "Request #$i:"
  curl -X POST https://store.pbs.web.id/api/checkout \
    -H "Content-Type: application/json" \
    -d '{
      "items": [{"product": {"kode": "P001", "harga": 10000}, "quantity": 1}],
      "customerName": "Test'$i'",
      "customerEmail": "test'$i'@test.com",
      "customerPhone": "081234567890"
    }' \
    --silent | jq .

  echo "---"
  sleep 1.5
done
```

#### Expected: ✅ PASS
- Request 1-5: `{"success": true, "orderId": "..."}`
- Request 6: `{"error": "Terlalu banyak request...", "status": 429}`

#### ❌ JIKA GAGAL
- Jika request 6 masih 200 OK → rate limiting belum berjalan
- Cek: Apakah `checkRateLimit()` dipanggil di line 44?

---

## 3️⃣ TEST: SECURE WEBHOOK VALIDATION
### Tujuan: Pastikan webhook validasi amount sebelum fulfillment

#### Scenario: Simulasi webhook dengan amount salah

```bash
# Generate signature (sesuai Midtrans docs)
MIDTRANS_SERVER_KEY="YOUR_SERVER_KEY"
ORDER_ID="PBS-test-webhook-123"
STATUS_CODE="200"
GROSS_AMOUNT="1"

# Signature = SHA512(ORDER_ID + STATUS_CODE + GROSS_AMOUNT + SERVER_KEY)
SIGNATURE=$(echo -n "$ORDER_ID$STATUS_CODE$GROSS_AMOUNT$MIDTRANS_SERVER_KEY" | \
  openssl dgst -sha512 | awk '{print $2}')

echo "Generated Signature: $SIGNATURE"

# Send webhook
curl -X POST https://store.pbs.web.id/api/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "'$ORDER_ID'",
    "status_code": "'$STATUS_CODE'",
    "gross_amount": "'$GROSS_AMOUNT'",
    "signature_key": "'$SIGNATURE'",
    "transaction_status": "settlement",
    "payment_type": "qris"
  }'
```

#### Expected: ✅ PASS
```json
{
  "success": false,
  "error": "Amount mismatch",
  "status": 400
}
```

**Cek penting:**
- ✅ Webhook ditolak (status 400)
- ✅ Cek Database → `fraud_logs` table ada entry baru:
  ```sql
  SELECT * FROM fraud_logs 
  WHERE order_id = 'PBS-test-webhook-123' 
  ORDER BY created_at DESC LIMIT 1;
  ```
  Hasil harus: `expected_amount: 10000000, received_amount: 1, type: 'amount_mismatch'`

#### ❌ JIKA GAGAL
- Webhook diterima (200 OK) → amount validation tidak berjalan
- Cek: Apakah lines 79-93 di `webhook/route.ts` ada validasi amount?

---

## 4️⃣ TEST: QR CODE NOT IN URL
### Tujuan: Pastikan QR tidak exposed di URL/logs

#### Scenario A: Checkout normal, cek redirect

```bash
# Buka di browser atau curl
curl -X POST https://store.pbs.web.id/api/checkout \
  -H "Content-Type: application/json" \
  -d '{...produk valid...}' \
  -L --write-out '\nRedirect URL: %{redirect_url}\n'
```

**Expected:** ✅ PASS
```
Location: /order-pending?orderId=PBS-xxx&transactionId=TXN-xxx
```

**Cek penting:**
- ✅ URL TIDAK mengandung `qrString=` atau `qrUrl=`
- ✅ HANYA ada `orderId` dan `transactionId`

#### ❌ JIKA GAGAL
- URL: `/order-pending?orderId=PBS-xxx&qrString=...&qrUrl=...`
- Cek: Apakah line 73-77 di `checkout/page.tsx` sudah dihapus?

#### Scenario B: Buka halaman order-pending, cek QR source

```bash
# Di browser:
# 1. Buka https://store.pbs.web.id/order-pending?orderId=PBS-xxx&transactionId=TXN-xxx
# 2. Buka DevTools → Console
# 3. Jalankan:
```

```javascript
// Cek apakah QR diambil dari API
console.log(document.querySelector('[data-qr]')?.textContent);

// Cek source di Network tab
// Harus ada request ke: /api/order/PBS-xxx
```

**Expected:** ✅ PASS
- Network tab menunjukkan: `GET /api/order/PBS-xxx` → response dengan QR
- QR TIDAK di DOM saat halaman load (diambil via fetch, bukan hardcoded)

#### ❌ JIKA GAGAL
- QR data hardcoded di URL → masih vulnerable
- Cek: Apakah `page.tsx` menggunakan `useEffect` untuk fetch QR?

---

## 5️⃣ TEST: NEW SECURE ORDER API
### Tujuan: Pastikan `/api/order/:id` endpoint berfungsi

```bash
# Ambil order ID dari test #1
ORDER_ID="PBS-1708747200000-abc123"

# Test endpoint
curl https://store.pbs.web.id/api/order/$ORDER_ID
```

#### Expected: ✅ PASS
```json
{
  "order": {
    "order_id": "PBS-...",
    "customer_name": "...",
    "total_amount": 10000000,
    "status": "pending"
  },
  "qr": {
    "qrUrl": "https://api.sandbox.midtrans.com/v2/qris/...",
    "qrString": "..."
  }
}
```

**Cek penting:**
- ✅ Endpoint responds (200 OK)
- ✅ Response berisi order dan QR data
- ✅ QR HANYA dikirim jika status="pending"

#### Test: Order yang sudah paid (QR harus tidak ada)
```bash
# Set order status jadi 'paid' di database, lalu test lagi
curl https://store.pbs.web.id/api/order/PBS-paid-order-123
```

**Expected:** ✅ PASS
```json
{
  "order": {...},
  "qr": null
}
```

#### ❌ JIKA GAGAL
- 404 error → endpoint belum ada
- Cek: Apakah file `user/app/api/order/[orderId]/route.ts` ada?

---

## 📊 FULL TESTING WORKFLOW

### Pre-Test Checklist (5 min)
```sql
-- Di Supabase SQL editor, jalankan:

-- 1. Pastikan ada products dengan harga yang masuk akal
SELECT COUNT(*), MIN(harga), MAX(harga) FROM products;
-- Hasil: Minimal ada 1 product dengan harga > 1000

-- 2. Pastikan fraud_logs table kosong (sebelum test)
DELETE FROM fraud_logs WHERE created_at < NOW() - INTERVAL '1 day';
SELECT COUNT(*) FROM fraud_logs;
-- Hasil: 0 atau sangat sedikit

-- 3. Catat product yang ada:
SELECT kode, nama, harga, stok FROM products LIMIT 5;
```

### Test Sequence (30-45 min)

**Phase 1: Price Validation (5 min)**
- ✅ Run TEST #1 dengan product_code yang valid
- Verifikasi amount dari DB, bukan client
- ✅ Catat successful order ID

**Phase 2: Rate Limiting (5 min)**
- ✅ Run TEST #2 (6 requests script)
- Verifikasi request ke-6 ditolak
- Tunggu 60 detik, coba lagi 1 request (harus sukses)

**Phase 3: Webhook Validation (5 min)**
- ✅ Run TEST #3 dengan order ID dari Phase 1
- Generate signature yang benar
- Verifikasi webhook ditolak, fraud logged

**Phase 4: QR Security (5 min)**
- ✅ Run TEST #4A (cek URL redirect)
- Pastikan QR TIDAK di URL
- ✅ Run TEST #4B (cek Network tab di DevTools)
- Pastikan QR fetched dari `/api/order/:id`

**Phase 5: Order API (5 min)**
- ✅ Run TEST #5 dengan order ID dari Phase 1
- Verifikasi endpoint working
- Cek QR data yang dikembalikan

**Phase 6: Database Verification (5 min)**
```sql
-- Verifikasi order tercatat dengan benar
SELECT order_id, total_amount, status, created_at 
FROM orders 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC LIMIT 10;

-- Verifikasi fraud logs recorded
SELECT * FROM fraud_logs ORDER BY created_at DESC LIMIT 5;

-- Pastikan TIDAK ada order dengan amount = 1 atau < 1000
SELECT COUNT(*) as suspicious_orders
FROM orders
WHERE total_amount < 1000 AND created_at > NOW() - INTERVAL '1 day';
-- Hasil: 0
```

---

## 🚨 TROUBLESHOOTING

### Problem 1: "Terlalu banyak request" saat TEST #1
**Solusi:**
- Tunggu 60 detik
- Cek apakah ada automated tool hitting endpoint
- Jika rate limit terlalu ketat: adjust line 44 di `checkout/route.ts`

### Problem 2: Webhook TEST tidak bisa dijalankan
**Solusi:**
- Pastikan MIDTRANS_SERVER_KEY punya akses ke webhook testing
- Buat order dulu via UI, ambil order_id yang valid
- Eksekusi TEST #3 dengan order_id yang nyata

### Problem 3: QR tidak muncul di order-pending page
**Solusi:**
```javascript
// Di browser console, cek error:
fetch('/api/order/PBS-xxx')
  .then(r => r.json())
  .then(d => console.log(d))
  .catch(e => console.error(e))
```

- Jika 404: Endpoint belum deployed
- Jika 500: Supabase config issue
- Jika auth error: SERVICE_ROLE_KEY tidak valid

### Problem 4: Database order tidak terbuat
**Solusi:**
```sql
-- Cek error di orders table triggers/constraints
SELECT constraint_name FROM information_schema.table_constraints 
WHERE table_name = 'orders';

-- Cek order yang terakhir dibuat:
SELECT * FROM orders ORDER BY created_at DESC LIMIT 1;
```

### Problem 5: Signature validation failed
**Solusi:**
```bash
# Pastikan signature dihitung dengan benar:
# SHA512(order_id + status_code + gross_amount + server_key)

# Cara benar (MacOS/Linux):
echo -n 'PBS-test123200100000' | openssl dgst -sha512

# Cara benar (Windows) - pastikan format:
$text = 'PBS-test123200100000'
$bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
$sha = [System.Security.Cryptography.SHA512]::Create()
$hash = $sha.ComputeHash($bytes)
[System.BitConverter]::ToString($hash).Replace('-','').ToLower()
```

---

## ✅ SUCCESS INDICATORS

Jika semua test PASS, Anda punya:

| Test | Status | Indikator |
|------|--------|-----------|
| Price Tampering | ✅ | Amount dari DB, bukan client |
| Rate Limiting | ✅ | Request 6+ ditolak 429 |
| Webhook Validation | ✅ | Fraud logged, amount mismatch ditolak |
| QR Secure | ✅ | QR fetched dari API, tidak di URL |
| Order API | ✅ | Endpoint working, QR delivered safely |

**Final Check:**
```sql
SELECT COUNT(*) FROM orders WHERE total_amount = 1;  -- Harus: 0
SELECT COUNT(*) FROM fraud_logs;                     -- Harus: >= 1 (dari test)
```

---

## 📝 TESTING REPORT TEMPLATE

Catat hasil di sini:

```
TEST DATE: ___________
TESTER: ___________
DOMAIN: store.pbs.web.id

TEST 1 - Price Tampering: ☐ PASS / ☐ FAIL
  Notes: ___________

TEST 2 - Rate Limiting: ☐ PASS / ☐ FAIL
  Notes: ___________

TEST 3 - Webhook Validation: ☐ PASS / ☐ FAIL
  Notes: ___________

TEST 4 - QR Secure: ☐ PASS / ☐ FAIL
  Notes: ___________

TEST 5 - Order API: ☐ PASS / ☐ FAIL
  Notes: ___________

OVERALL: ☐ READY FOR PRODUCTION / ☐ NEED FIXES

Issues Found: ___________
```

---

**Created:** Feb 24, 2026  
**Status:** Ready for testing  
**Contact:** DevOps Team

# 🚀 QUICK TEST COMMANDS - store.pbs.web.id

Salin-paste langsung ke terminal untuk test patches.

---

## 🎯 TEST 1: Price Tampering Prevention
### Coba hack harga 1 rupiah (harus gagal)

```bash
curl -X POST https://store.pbs.web.id/api/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "product": {
          "kode": "P001",
          "harga": 1,
          "nama": "Test Product"
        },
        "quantity": 1
      }
    ],
    "customerName": "Security Test User",
    "customerEmail": "test@security.com",
    "customerPhone": "081234567890"
  }' | jq .
```

**Harapan:**
- ✅ `"amount"` >= 10000 (dari DB, bukan 1)
- ✅ Response tidak ada `qrString` atau `qrUrl`
- ✅ Status 200 OK

**Format output yang BENAR:**
```json
{
  "success": true,
  "orderId": "PBS-1708747200000-abc123",
  "transactionId": "1708747200000-abc123",
  "amount": 10000000,
  "message": "Order created successfully"
}
```

---

## 🎯 TEST 2: Rate Limiting (5 req/min)
### Kirim 6 request cepat, no. 6 harus ditolak

**Bash Script (Copy-paste):**
```bash
#!/bin/bash
echo "🧪 Testing rate limiting (5 per minute)..."
for i in {1..6}; do
  echo ""
  echo "Request #$i:"
  curl -X POST https://store.pbs.web.id/api/checkout \
    -H "Content-Type: application/json" \
    -d '{
      "items": [
        {
          "product": {"kode": "P001", "harga": 100000},
          "quantity": 1
        }
      ],
      "customerName": "Test User '$i'",
      "customerEmail": "test'$i'@test.com",
      "customerPhone": "081234567890"
    }' \
    -w "\nStatus: %{http_code}\n" \
    2>/dev/null | jq -r '.error // .success'
  
  sleep 2
done
echo ""
echo "Request 7 setelah tunggu 60 detik (harus berhasil):"
sleep 60
curl -X POST https://store.pbs.web.id/api/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"product": {"kode": "P001", "harga": 100000}, "quantity": 1}],
    "customerName": "Test User Final",
    "customerEmail": "testfinal@test.com",
    "customerPhone": "081234567890"
  }' 2>/dev/null | jq -r '.error // .success'
```

**Harapan:**
- Request 1-5: `true` (berhasil)
- Request 6: `"Terlalu banyak request..."` (ditolak)
- Request 7 (setelah tunggu): `true` (reset setelah 60 detik)

---

## 🎯 TEST 3: Webhook Amount Validation
### Simulasi webhook dengan amount salah

**Step 1: Generate signature (Linux/Mac)**
```bash
ORDER_ID="PBS-test-webhook-123"
GROSS_AMOUNT="1"
SERVER_KEY="YOUR_MIDTRANS_SERVER_KEY"

SIGNATURE=$(echo -n "$ORDER_ID"200"$GROSS_AMOUNT""$SERVER_KEY" | openssl dgst -sha512 | awk '{print $2}')

echo "Signature: $SIGNATURE"
```

**Step 2: Kirim webhook dengan signature**
```bash
curl -X POST https://store.pbs.web.id/api/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "PBS-test-webhook-123",
    "status_code": "200",
    "gross_amount": "1",
    "signature_key": "'$SIGNATURE'",
    "transaction_status": "settlement",
    "transaction_id": "TXN-test-123",
    "payment_type": "qris"
  }' | jq .
```

**Harapan:**
- ✅ Status 400 Bad Request
- ✅ Error: `"Amount mismatch"` atau `"Fraud detected"`
- ✅ Order TIDAK di-update ke status `paid`

**Verifikasi di database:**
```bash
curl "https://your-supabase-url/rest/v1/fraud_logs?order_id=eq.PBS-test-webhook-123" \
  -H "Authorization: Bearer YOUR_ANON_KEY" | jq .
```

---

## 🎯 TEST 4: QR Code Not in URL
### Verifikasi QR tidak expose di URL

**Step 1: Buat order (ambil order ID)**
```bash
curl -X POST https://store.pbs.web.id/api/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"product": {"kode": "P001", "harga": 100000}, "quantity": 1}],
    "customerName": "QR Test",
    "customerEmail": "qr@test.com",
    "customerPhone": "081234567890"
  }' 2>/dev/null | jq -r '.orderId'
```

**Step 2: Cek URL redirect (harus TIDAK ada qrString)**
```bash
# Copykan ke browser atau curl:
https://store.pbs.web.id/order-pending?orderId=PBS-xxxx&transactionId=TXN-xxxx
```

**Harapan:**
- ✅ URL format: `/order-pending?orderId=PBS-xxx&transactionId=TXN-xxx`
- ❌ URL TIDAK boleh ada: `&qrString=...` atau `&qrUrl=...`

**Cek di browser console:**
```javascript
// Buka DevTools (F12) → Console
// Paste:
fetch('/api/order/' + new URLSearchParams(window.location.search).get('orderId'))
  .then(r => r.json())
  .then(d => console.log('QR API Response:', d))
```

Harapan:
```json
{
  "order": {...},
  "qr": {
    "qrUrl": "https://api.sandbox.midtrans.com/v2/qris/...",
    "qrString": "..."
  }
}
```

---

## 🎯 TEST 5: New Order API Endpoint

**Dapatkan order ID dari TEST 1:**
```bash
ORDER_ID=$(curl -s -X POST https://store.pbs.web.id/api/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"product": {"kode": "P001", "harga": 100000}, "quantity": 1}],
    "customerName": "API Test",
    "customerEmail": "api@test.com",
    "customerPhone": "081234567890"
  }' | jq -r '.orderId')

echo "Order ID: $ORDER_ID"
```

**Test endpoint:**
```bash
curl https://store.pbs.web.id/api/order/$ORDER_ID | jq .
```

**Harapan:**
```json
{
  "order": {
    "order_id": "PBS-...",
    "customer_name": "API Test",
    "total_amount": 100000,
    "status": "pending",
    "created_at": "2026-02-24T12:34:56Z"
  },
  "qr": {
    "qrUrl": "https://api.sandbox.midtrans.com/...",
    "qrString": "..."
  }
}
```

---

## 📊 DATABASE VERIFICATION

**Buka Supabase SQL Editor, jalankan:**

**1. Cek orders dibuat dengan harga dari DB:**
```sql
SELECT 
  order_id,
  total_amount,
  status,
  created_at,
  items
FROM orders
ORDER BY created_at DESC
LIMIT 5;
```

**2. Cek fraud_logs untuk test webhook:**
```sql
SELECT 
  order_id,
  type,
  expected_amount,
  received_amount,
  created_at
FROM fraud_logs
ORDER BY created_at DESC
LIMIT 5;
```

**3. Pastikan TIDAK ada Rp1 orders:**
```sql
SELECT COUNT(*) as suspicious_count
FROM orders
WHERE total_amount = 1 OR total_amount < 1000;
-- Result: 0 (aman!)
```

---

## 🎯 ONE-LINER TESTS

**Cek 5 patches sekali jalan:**
```bash
echo "1️⃣ Price validation:" && \
curl -s -X POST https://store.pbs.web.id/api/checkout -H "Content-Type: application/json" -d '{"items":[{"product":{"kode":"P001","harga":1},"quantity":1}],"customerName":"Test","customerEmail":"t@t.com","customerPhone":"081"}' | jq '.amount' && \

echo "2️⃣ Rate limiting (req 6):" && \
for i in {1..6}; do curl -s -X POST https://store.pbs.web.id/api/checkout -H "Content-Type: application/json" -d '{"items":[{"product":{"kode":"P001","harga":100000},"quantity":1}],"customerName":"T'$i'","customerEmail":"t'$i'@t.com","customerPhone":"081"}'; done | tail -1 | jq '.error' && \

echo "3️⃣ QR not in response:" && \
curl -s -X POST https://store.pbs.web.id/api/checkout -H "Content-Type: application/json" -d '{"items":[{"product":{"kode":"P001","harga":100000},"quantity":1}],"customerName":"Test","customerEmail":"t@t.com","customerPhone":"081"}' | jq 'has("qrString") or has("qrUrl")' && \

echo "✅ All tests complete!"
```

---

## 🚨 COMMON CURL ERRORS & FIXES

**Error: `curl: command not found`**
- Windows: Install curl atau gunakan PowerShell `Invoke-WebRequest`
- Alternative: Gunakan Thunder Client atau Postman

**Error: `jq: command not found`**
- Install jq: https://stedolan.github.io/jq/download/
- Alternative: Hilangkan `| jq .` dan lihat raw JSON

**Error: `SSL certificate problem`**
- Tambah flag: `curl ... -k` (skip SSL verification - HANYA untuk test!)

**Error: `Cannot resolve domain`**
- Cek: Domain benar: `store.pbs.web.id`
- Cek: Koneksi internet normal
- Cek: Domain sudah deployed

---

## 📋 TESTING CHECKLIST

Copikan ke notepad, cek saat test:

```
[ ] TEST 1 - Price Tampering: Amount >= 10000, no qrString
[ ] TEST 2 - Rate Limiting: Req 6 ditolak, req 7 sukses
[ ] TEST 3 - Webhook: Fraud logged, order tidak updated
[ ] TEST 4 - QR URL: URL clean, no qrString params
[ ] TEST 5 - Order API: Endpoint respond, QR delivered

[ ] DB - Check orders: total_amount dari DB ✓
[ ] DB - Check fraud_logs: Ada entries dari test ✓
[ ] DB - Check no Rp1: COUNT = 0 ✓

STATUS: ☐ ALL PASS - PRODUCTION READY ✓
```

---

## 💡 TIPS

1. **Paste di PowerShell:** Gunakan `-H` untuk headers (case-sensitive!)
2. **Paste di Terminal:** Gunakan `\` untuk line break
3. **Perlu jq installed?** Install: `sudo apt-get install jq` (Linux) atau `brew install jq` (Mac)
4. **Windows native:** Ganti `jq .` dengan debugging pakai Postman/VS Code Thunder Client
5. **Need to test webhook signature?** Pakai: https://sha-512-hash-generator.online/

---

**Last Updated:** Feb 24, 2026  
**Ready to Test:** YES ✅

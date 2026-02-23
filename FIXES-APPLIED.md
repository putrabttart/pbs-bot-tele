# 🔧 QUICK FIX CHECKLIST

## FIXES YANG SUDAH DILAKUKAN:

### ✅ Fix #1: Order ID Format
**File:** `user/app/api/checkout/route.ts` (Line 147)
- ❌ Sebelum: `PBS-${Date.now()}-${Math.random()...}` → `PBS-1708747200000-fq7cqw`
- ✅ Sesudah: `PBS-${Date.now()}` → `PBS-1708747200000`

### ✅ Fix #2: Order Status  
**File:** `user/app/api/checkout/route.ts` (Line 295)
- ❌ Sebelum: `status: 'pending_payment'`
- ✅ Sesudah: `status: 'pending'`

### ✅ Fix #3: Order API Endpoint
**File:** `user/app/api/order/[orderId]/route.ts` (NEW FILE)
- Created secure endpoint untuk fetch QR tanpa expose di URL
- Status `pending` atau `pending_payment` akan fetch QR dari Midtrans

### ⚠️ Fix #4: Price Validation Debug
**File:** `user/app/api/checkout/route.ts` (Lines 88-105)
- Added detailed console logging to track product lookup
- Logs akan show: `dbPrice` vs `clientPrice`
- Jika `total_amount` masih 1, ini akan reveal masalahnya

---

## STEPS UNTUK VERIFY FIXES:

### 1️⃣ RESTART APLIKASI (WAJIB!)
```bash
# Di terminal Next.js
Ctrl + C   # Stop server

# Tunggu stop selesai, lalu
npm run dev   # Start ulang
```

Tunggu sampai muncul: `Ready in xxx ms`

### 2️⃣ BUAT ORDER BARU
1. Buka https://store.pbs.web.id
2. Pilih product (gunakan `viult` atau product yang ada)
3. Set quantity = 1
4. Ke checkout
5. Isi data customer
6. Klik submit

### 3️⃣ MONITOR CONSOLE LOGS (F12)
Buka DevTools → Console tab

Cari logs:
```
[CHECKOUT] 🔍 Processing item: code=viult, qty=1, clientPrice=1
[CHECKOUT] 🔎 Looking up product in DB with kode="viult"...
[CHECKOUT] DB lookup result: { found: true, dbPrice: 129000, clientPrice: 1, error: null }
[CHECKOUT] ✅ Validated viult: Rp129000 × 1 = Rp129000
```

**Jika logs tidak muncul:** Berarti aplikasi masih memakai file lama → restart lagi

### 4️⃣ CEK SUPABASE (setelah order dibuat ~5 detik)
Query:
```sql
SELECT 
  order_id,
  total_amount,
  status,
  transaction_id,
  created_at
FROM orders
WHERE created_at > NOW() - INTERVAL '5 min'
ORDER BY created_at DESC
LIMIT 1;
```

**Expectation:**
- `order_id`: `PBS-1708747200000` (format simple, NO `-fq7cqw`)
- `total_amount`: `129000` (dari DB, BUKAN 1!)
- `status`: `pending` (BUKAN `pending_payment`)
- `transaction_id`: `a1b2c3d4e5f6...` (dari Midtrans)

### 5️⃣ JIKA MASIH GAGAL:

**Scenario A: total_amount masih 1**
- Berarti product lookup gagal
- Check: Apakah product code di `items` sama dengan di DB?
- Solution: `SELECT DISTINCT kode FROM products LIMIT 10;` lihat format kodenya

**Scenario B: order_id masih punya suffix `-xxx`**
- Berarti file tidak reload
- Solution: Shutdown dev server sepenuhnya (Ctrl+C), tunggu 2 detik, restart

**Scenario C: status masih `pending_payment`**
- File tidak reload
- Cek: File `checkout/route.ts` line 295 sudah berubah?

---

## FILE YANG DIUBAH:

```
✅ d:\Bot\bot-telegram-pbs\user\app\api\checkout\route.ts
   - Line 147: Order ID format
   - Line 148: Comment
   - Lines 88-105: Debug logging
   - Line 295: Status changed to 'pending'

✅ d:\Bot\bot-telegram-pbs\user\app\order-pending\page.tsx
   - Line 68: Add 'unpaid' status check

✅ d:\Bot\bot-telegram-pbs\user\app\api\order\[orderId]\route.ts
   - NEW FILE: Order API endpoint
```

---

## FINAL VERIFICATION:

Setelah checkout baru dan cek Supabase, harusnya:

| Item | Expected | Actual | Status |
|------|----------|--------|--------|
| Order ID format | `PBS-TIMESTAMP` | ? | ⏳ |
| Total Amount | 129000 (dari DB) | ? | ⏳ |
| Order Status | `pending` | ? | ⏳ |
| Transaction ID | Filled | ? | ⏳ |
| Redirect URL | `/order-pending?orderId=...` | ? | ⏳ |

---

## JIKA SEMUA OK:

Berarti patches berhasil!

```sql
-- Final verification
SELECT COUNT(*) FROM orders WHERE total_amount = 1;  
-- Hasilnya: 0 (tidak ada Rp1 orders)

SELECT COUNT(*) FROM orders WHERE order_id LIKE '%-%' AND order_id NOT LIKE 'PBS-%';
-- Hasilnya: 0 (semua order pake format PBS-TIMESTAMP)
```

Setelah semua OK, baru test rate limiting, webhook, QR endpoint, dst.

---

**Status:** 🔴 Pending Verification
**Updated:** Feb 24, 2026

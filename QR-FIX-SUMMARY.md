# 🔧 QUICK FIX - QR tidak tersedia

## Root Cause Ditemukan:

❌ **QR data tidak disimpan di database**
- Checkout endpoint tidak menyimpan `qr_string` dari Midtrans
- Order API endpoint tidak bisa fetch QR tanpa data tersimpan

---

## ✅ FIXES YANG SUDAH DITERAPKAN:

### Fix #1: Checkout Endpoint (route.ts line 305-340)
**What changed:**
- ✅ Added fallback untuk `transaction_id` (misalnya dari `transaction.id`)
- ✅ Extract `qr_string` dari Midtrans response
- ✅ **Simpan `qr_string` ke database** sebelum response

**Code:**
```typescript
const transactionId = transaction.transaction_id || transaction.id || `TXN-${Date.now()}`
const qrString = transaction.qr_string || transaction.actions?.find((a: any) => a.method === 'GET')?.url

// Save to DB
updateData.qr_string = qrString
```

### Fix #2: Order API Endpoint (route.ts line 38-85)
**What changed:**
- ✅ First try to fetch QR dari database (`order.qr_string`)
- ✅ If not in DB, fallback to Midtrans fetch
- ✅ Better error handling

**Code:**
```typescript
if (order.qr_string) {
  // Use stored QR from database
  qrData = { qrUrl: order.qr_string, ... }
} else if (order.transaction_id) {
  // Fallback: fetch from Midtrans
}
```

---

## 📋 ACTION ITEMS:

### Step 1: Check Database Table
Run di Supabase SQL Editor:
```sql
-- Check if qr_string column exists
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'orders' AND column_name = 'qr_string';
```

**If result kosong:**
```sql
ALTER TABLE orders ADD COLUMN qr_string TEXT;
```

### Step 2: Restart Next.js
```bash
# In terminal
Ctrl + C
npm run build
npm run dev
```

### Step 3: Test Checkout
1. Buat order baru
2. Cek console logs untuk verify transaction_id dan qr_string tersimpan
3. Cek Supabase: order harus punya `qr_string` filled

### Step 4: Verify QR Tampil
- Order-pending page harus show QR code sekarang
- Jika masih tidak ada: lihat console error di `/api/order/:id`

---

## 🔍 DEBUG CHECKLIST:

```
[ ] Database column qr_string ada?
    SELECT column_name FROM information_schema.columns WHERE table_name='orders'

[ ] Last order punya qr_string data?
    SELECT order_id, qr_string, transaction_id FROM orders ORDER BY created_at DESC LIMIT 1

[ ] API endpoint bisa fetch order?
    curl https://store.pbs.web.id/api/order/PBS-XXXXX

[ ] Console logs show QR extracted?
    Browser DevTools → check [ORDER API] ✅ Using QR from database

[ ] QR image tampil di page?
    order-pending page harus show image
```

---

## 📊 Expected After Fixes:

**Before:**
```
Console: [ORDER-PENDING] No QR data available ⚠️
Database: order { ...fields..., qr_string: null }
```

**After:**
```
Console: [ORDER-PENDING] QR loaded from backend API ✅
Database: order { ...fields..., qr_string: "https://..." }
Page: QR image displayed ✅
```

---

## ⏱️ Estimated Time to Complete:

- Database migration: 1-2 min
- Restart app: 2-3 min  
- Test: 2-3 min
- **Total: 5-10 minutes**

---

**Status:** ✅ Fixes applied, awaiting your verification
**Next:** Run checks above and confirm QR appears

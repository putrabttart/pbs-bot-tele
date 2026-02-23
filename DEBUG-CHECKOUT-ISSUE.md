# 🔍 DEBUG CHECKOUT ISSUE

## Problem:
- ❌ Order dibuat dengan total Rp 1.000 (client price, bukan DB price)
- ❌ Order ID punya suffix random (sudah diperbaiki ke `PBS-TIMESTAMP`)
- ❌ Status `pending_payment` (sudah diperbaiki, harus `pending` saja)

## Testing Steps:

### Step 1: Check Console Logs
Saat melakukan checkout, cek browser console (F12 → Console tab):

Cari logs yang pattern:
```
[CHECKOUT] 🔍 Processing item: code=..., qty=..., clientPrice=...
[CHECKOUT] 🔎 Looking up product in DB with kode="..."...
[CHECKOUT] DB lookup result: { found: true/false, dbPrice: ..., clientPrice: ..., error: ... }
```

**Harapan:**
- `found: true` (product ditemukan di DB)
- `dbPrice: <HARGA_BENAR>` (misalnya 15000 untuk VIULT)
- `clientPrice: 1` (harga dari client, akan DIABAIKAN)

### Step 2: Check Supabase Orders Table
Query:
```sql
SELECT 
  order_id,
  total_amount,
  status,
  items,
  created_at
FROM orders
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 5;
```

**Harapan:**
- `order_id`: Format `PBS-{timestamp}` (TIDAK ada suffix)
- `total_amount`: Harga dari DB (bukan 1)
- `status`: `pending` (BUKAN `pending_payment`)
- `items`: Berisi product data dengan harga dari DB

### Step 3: Verify Product Code Format
```sql
SELECT kode, nama, harga, stok 
FROM products 
WHERE kode LIKE 'viu%'
ORDER BY kode;
```

**Kemungkinan:**
Jika product code `viult` di DB tapi checkout kirim `viu`, maka lookup akan fail dan order pakai default harga.

---

## Expected vs Actual

### ✅ EXPECTED (Setelah penghapusan harga client)
```
Frontend sends:
{
  items: [{
    product: {
      id: "...",
      kode: "viult",
      nama: "VIU Premium...",
      harga: 1,  ← CLIENT PRICE (akan diabaikan!)
      stok: 10
    },
    quantity: 1
  }]
}

Backend receives → Ignores harga=1
Backend fetches: SELECT harga FROM products WHERE kode='viult'
Backend calculates: totalAmount = 129000 (dari DB!)

Database saves:
{
  order_id: "PBS-1708747200000",  ← NO SUFFIX
  total_amount: 129000,           ← FROM DB!
  status: "pending"               ← NOT pending_payment
}
```

### ❌ ACTUAL (Masalah sekarang)
```
Database shows:
{
  order_id: "PBS-1708747200000-fq7cqw",  ← ADA SUFFIX (SUDAH DIPERBAIKI!)
  total_amount: 1000,                    ← CLIENT PRICE (ERROR!)
  status: "pending_payment"              ← SALAH (SUDAH DIPERBAIKI!)
}
```

---

## Checklist Fix Yang Sudah Dilakukan:

- ✅ Order ID diperbaiki: `PBS-${Date.now()}` (no random suffix)
- ✅ Status diperbaiki: `pending` (not `pending_payment`)
- ✅ Added debug logging untuk trace product lookup
- ✅ Order API endpoint sudah dibuat

## Checklist Untuk Diverifikasi:

- [ ] Restart Next.js dev server (Ctrl+C, npm run dev)
- [ ] Buat order baru
- [ ] Cek console logs untuk verification
- [ ] Check Supabase: order_id format (HARUS `PBS-TIMESTAMP` tanpa suffix)
- [ ] Check Supabase: total_amount (HARUS harga dari DB, bukan 1)
- [ ] Check Supabase: status (HARUS `pending`, bukan `pending_payment`)

---

## Next Action:

1. **Restart aplikasi** (Ctrl+C di terminal, jalankan `npm run dev`)
2. **Lakukan checkout** dengan product yang ada di DB
3. **Salin debug logs** dari browser console
4. **Run Supabase queries** di atas
5. **Lapor hasilnya** untuk further debugging

---

**If problem persists:**
Jika total_amount masih 1 setelah semu ini, berarti:
- Product lookup di backend gagal (product code tidak match)
- Atau ada error saat fetch dari DB yang tidak terlog

Akan buat script untuk monitor Midtrans requests juga.

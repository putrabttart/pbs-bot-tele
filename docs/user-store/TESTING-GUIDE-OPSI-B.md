# 🧪 PANDUAN TESTING - WEB STORE OPSI B

## 📋 Ringkasan Perbaikan

Saya sudah memperbaiki web store dengan OPSI B (independent dari bot):

### ✅ Yang Sudah Diperbaiki:

1. **Checkout Route** (`app/api/checkout/route.ts`):
   - ❌ Menghapus `.single()` yang menyebabkan error 0 rows
   - ✅ Pakai `.select()` dan cek hasil dengan benar
   - ✅ Tambah logging detail untuk setiap step
   - ✅ Tidak gagal meski INSERT fail (payment tetap berjalan)

2. **Webhook Route** (`app/api/webhook/route.ts`):
   - ✅ Perbaiki UPDATE order dengan logging
   - ✅ Handle semua status (settlement, deny, cancel, expire, refund)
   - ✅ Update status order ke database

3. **Debug Endpoint** (`app/api/debug-order/route.ts`):
   - ✅ Buat endpoint baru untuk check order di database
   - ✅ User bisa test: `GET /api/debug-order?orderId=PBS-XXX`

---

## 🧪 LANGKAH TESTING

### Step 1: Bersihkan Browser Cache
```
Ctrl + Shift + Delete
atau
Cmd + Shift + Delete (Mac)
```
Hapus cookies dan cache untuk session baru.

---

### Step 2: Lakukan Checkout Penuh

1. Buka web store: `http://localhost:3001`
2. Tambah produk ke cart
3. Klik "Checkout"
4. Isi data customer:
   - Nama: "Test User"
   - Email: "test@example.com"
   - Telepon: "081234567890"
5. Klik "Buat QR Code Pembayaran"

**Lihat console/logs - catat Order ID yang muncul (format: PBS-XXXXXXXX)**

---

### Step 3: Check Apakah Order Tersimpan

**Di browser, buka URL baru:**
```
http://localhost:3001/api/debug-order?orderId=PBS-XXXXXXXX
```

Ganti `PBS-XXXXXXXX` dengan Order ID dari step 2.

**Hasil yang Diharapkan:**
```json
{
  "success": true,
  "found": true,
  "count": 1,
  "order": {
    "id": "uuid-xxx",
    "order_id": "PBS-XXXXXXXX",
    "transaction_id": "...",
    "customer_name": "Test User",
    "total_amount": 50000,
    "status": "pending",
    "items": [
      {
        "product_id": "...",
        "product_name": "...",
        "quantity": 1,
        "price": 50000
      }
    ],
    ...
  }
}
```

**Jika Hasil:**
- ✅ `"found": true` → ORDER BERHASIL TERSIMPAN! ✓
- ❌ `"found": false` → Ada masalah INSERT, lihat step berikutnya

---

### Step 4: Jika Order Belum Tersimpan - Debug Console

Buka **Developer Tools** (F12) → Tab **Console** (bukan Network)

Lihat logs dari server. Yang penting:
```
[CHECKOUT] 🔄 Preparing order for database...
[CHECKOUT] Order ID: PBS-XXXXXXXX
[CHECKOUT] Items count: 1
```

Lalu cari:
```
[CHECKOUT] ✅ Order BERHASIL disimpan ke database
```

atau

```
[CHECKOUT] ❌ INSERT order GAGAL: { code: "...", message: "..." }
```

**Jika ada error INSERT**, screenshot dan kirim ke saya beserta error message-nya.

---

### Step 5: Jika Order Tersimpan - Simulasi Pembayaran

Karena pakai QRIS, kita simulasi webhook:

**OPTION A: Manual via curl** (di terminal):
```bash
curl -X POST http://localhost:3001/api/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "PBS-XXXXXXXX",
    "transaction_id": "123456",
    "status_code": "200",
    "gross_amount": "50000",
    "transaction_status": "settlement",
    "payment_type": "qris",
    "signature_key": "signature_here"
  }'
```

Tapi ini complex karena perlu signature yang benar.

**OPTION B: Lebih Mudah - Test via Payment Status**
```
http://localhost:3001/api/payment-status
```

POST dengan:
```json
{
  "order_id": "PBS-XXXXXXXX"
}
```

Ini akan check status di Midtrans API langsung.

---

### Step 6: Check Order Success Page

Setelah "pembayaran" (atau tunggu webhook dari Midtrans):

Buka:
```
http://localhost:3001/order-success?orderId=PBS-XXXXXXXX
```

**Hasil yang Diharapkan:**
- ✅ Tampil order details
- ✅ Tampil customer name, email, phone
- ✅ **Tampil ITEMS yang dibeli** (bukan "sedang diproses")
- ✅ Tampil total amount

---

## 🔧 Troubleshooting

### Masalah 1: Order Belum Tersimpan
**Penyebab Kemungkinan:**
- NEXT_PUBLIC_SUPABASE_URL salah
- NEXT_PUBLIC_SUPABASE_ANON_KEY salah atau tidak punya permission
- RLS policy tidak cocok

**Solusi:**
1. Check `.env.local` - pastikan Supabase credentials benar
2. Check Supabase dashboard - apakah table orders ada?
3. Restart server: `npm run dev`

### Masalah 2: Items Tidak Tampil di Order Success
**Penyebab Kemungkinan:**
- Order ada tapi items kosong (null)
- order-success page salah baca field

**Solusi:**
- Debug endpoint akan show items array
- Check order-success page code (sudah saya perbaiki)

### Masalah 3: Payment Status Tetap "Pending"
**Normal** - karena kita pakai QRIS test mode. Untuk test benar-benar, perlu:
- Pakai merchant Midtrans yang aktif
- Atau mock Midtrans callback

---

## 📊 Expected Flow Setelah Perbaikan

```
1. User Checkout
   ↓
2. INSERT order → orders table (dengan items JSONB array)
   ↓
3. ✅ Order tersimpan (bisa lihat di /api/debug-order)
   ↓
4. Midtrans QRIS dibuat
   ↓
5. User bayar (atau webhook dari Midtrans)
   ↓
6. UPDATE order status → 'paid'
   ↓
7. order-success page tampil items dari database ✅
```

---

## ✅ Checklist Sebelum Live

- [ ] Test checkout dengan berbagai produk
- [ ] Lihat order tersimpan di database
- [ ] Lihat items tampil di order-success page
- [ ] Test webhook dari Midtrans (kalau ada)
- [ ] Test /api/debug-order untuk verify
- [ ] Bersihkan console logs sebelum production

---

## 📞 Bantuan

Jika ada masalah:
1. Check console logs (F12 → Console)
2. Screenshot error message
3. Buka `/api/debug-order?orderId=PBS-XXX` dan lihat responsnya
4. Kirim screenshot dan error message ke saya

---

**Selesai! Bot code TIDAK BERUBAH sama sekali.** ✓
Web store sekarang punya schema dan flow sendiri yang independent. 🎉

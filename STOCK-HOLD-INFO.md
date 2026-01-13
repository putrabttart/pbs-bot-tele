# Stock Hold & Release - Informasi Sistem

## Durasi Hold Stok

### 1. Reserve Stock (Awal Order)
- **Kapan**: Saat user klik "Beli" dan order dibuat
- **Fungsi**: Stok di-hold sementara untuk user tersebut
- **Durasi**: Maksimal **15 menit** (sesuai PAYMENT_TTL_MS)
- **Status**: `reserved` di sistem

### 2. Payment Waiting
- **Durasi**: User punya **15 menit** untuk scan QRIS dan bayar
- **Monitoring**: Bot polling status payment setiap 5-30 detik
- **QR Code**: Valid selama 15 menit

### 3. Skenario Release Stock

#### A. Pembayaran Berhasil ✅
- **Aksi**: `finalizeStock()` dipanggil
- **Waktu**: 2-5 detik setelah payment confirmed
- **Hasil**: 
  - Stok dikurangi permanen
  - Digital items dikirim ke user
  - Order status: `completed`

#### B. Pembayaran Timeout ⏱️
- **Kondisi**: 15 menit berlalu tanpa pembayaran
- **Aksi**: `releaseStock(reason: 'timeout')` otomatis
- **Waktu**: Tepat setelah 15 menit
- **Hasil**: 
  - Stok dikembalikan
  - QR code dihapus
  - Order dibatalkan

#### C. Pembayaran Gagal/Cancel ❌
- **Kondisi**: Payment status: `cancel`, `deny`, `expire`
- **Aksi**: `releaseStock(reason: 'payment_failed')` langsung
- **Waktu**: Real-time saat status diterima
- **Hasil**: Stok langsung kembali

#### D. User Cancel Manual 🚫
- **Kondisi**: User klik tombol "Batalkan Order"
- **Aksi**: `releaseStock(reason: 'user_cancel')` langsung
- **Waktu**: Real-time
- **Hasil**: Stok kembali, order dihapus

### 4. Update Stok Setelah Pembayaran

#### Pembayaran Berhasil:
```
Payment Confirmed → finalizeStock() → 2-5 detik → Stok updated
```

#### Pembayaran Gagal:
```
Payment Failed/Timeout → releaseStock() → 1-3 detik → Stok dikembalikan
```

## Konfigurasi

### Di .env:
```env
# Payment TTL (default: 15 menit)
PAYMENT_TTL_MS=900000

# GAS Webhook untuk stock management
GAS_WEBHOOK_URL=https://script.google.com/...
GAS_SECRET=your_secret_key
```

### Di src/bot/config.js:
```javascript
PAYMENT_TTL_MS: parseInt(process.env.PAYMENT_TTL_MS) || 15 * 60 * 1000, // 15 menit
```

## Flow Diagram

```
User Order
    ↓
Reserve Stock (hold 15 min)
    ↓
Generate QRIS
    ↓
[User Scan & Pay] ← Polling every 5-30s
    ↓
    ├─→ SUCCESS → Finalize Stock (2-5s) → Send Items → Done ✅
    ├─→ TIMEOUT (15min) → Release Stock (instant) → Cancel ⏱️
    ├─→ FAILED → Release Stock (instant) → Cancel ❌
    └─→ USER CANCEL → Release Stock (instant) → Cancel 🚫
```

## Monitoring

### Log di Terminal:
```
[GAS] Reserving stock: { kode: 'CC1B', qty: 1, userRef: 'tg:123' }
[GAS] reserve success: { ok: true, order_id: 'PBS-xxx', ... }

[POLL] PBS-xxx - Attempt 1 - Status: pending
[POLL] PBS-xxx - Attempt 2 - Status: settlement

[GAS] Finalizing stock: { order_id: 'PBS-xxx', total: 50000 }
[GAS] finalize success: { ok: true, items: [...] }
[PAYMENT SUCCESS] Order PBS-xxx completed
```

### Log di Google Sheets (Apps Script):
- Timestamp reserve/finalize/release
- Order ID dan status
- Stok sebelum/sesudah
- Alasan release (timeout/cancel/failed)

## FAQ

**Q: Berapa lama stok di-hold?**
A: Maksimal 15 menit sejak order dibuat.

**Q: Kalau user tidak bayar?**
A: Setelah 15 menit, stok otomatis di-release dan order dibatalkan.

**Q: Berapa lama proses finalize setelah bayar?**
A: 2-5 detik. Digital items langsung dikirim.

**Q: Bisa extend waktu hold?**
A: Ubah `PAYMENT_TTL_MS` di .env (dalam milidetik).

**Q: Kalau Midtrans lambat update?**
A: Bot polling status setiap 5-30 detik otomatis. Max 20 attempts (10 menit).

**Q: Stok bisa double booking?**
A: Tidak. GAS Apps Script menggunakan lock mechanism untuk prevent race condition.

---
**Last Updated**: December 28, 2025

# 🔧 Perbaikan Sinkronisasi Stok - Panduan Lengkap

## Masalah Ditemukan
Dari test, ada **3 produk yang tidak sinkron**:

| Kode | Nama Produk | Stok Bot | Dashboard Items | Masalah |
|------|------------|----------|-----------------|---------|
| alight | Alight Motion 1 Tahun | 2 | 0 | Tidak ada items di database |
| vidtv1th | Vidio Platinum 1 Tahun | 3 | 0 | Tidak ada items di database |
| viu1th | VIU Premium 1 Tahun | 6 | 0 | Tidak ada items di database |

**Produk yang SUDAH sinkron:**
- ytbg (Gsuite YouTube Verif): 3 items ✅
- ytb1bs (YouTube Premium): 3 items ✅

## Solusi: Tambahkan Items via Dashboard

### Langkah 1: Buka Dashboard Product Items
1. Buka: https://independent-bravery-production.up.railway.app/dashboard/items
2. Atau klik menu **Product Items** di sidebar

### Langkah 2: Tambahkan Items untuk Alight Motion
1. **Select Product**: Pilih "Alight Motion 1 Tahun (alight)"
2. **Klik "Add Items"** (tombol biru)
3. Paste 2 items (sesuai stok yang ada di database):
   ```
   email1@alight.com:password123
   email2@alight.com:password456
   ```
4. Klik **"Add Items"**
5. Sekarang akan muncul "2 / 2" di dashboard

### Langkah 3: Tambahkan Items untuk Vidio
1. **Select Product**: Pilih "Vidio Platinum 1 Tahun TV Only (vidtv1th)"
2. **Klik "Add Items"**
3. Paste 3 items:
   ```
   vidio_account_1@email.com:pass1
   vidio_account_2@email.com:pass2
   vidio_account_3@email.com:pass3
   ```
4. Klik **"Add Items"**

### Langkah 4: Tambahkan Items untuk VIU
1. **Select Product**: Pilih "VIU Premium 1 Tahun (viu1th)"
2. **Klik "Add Items"**
3. Paste 6 items:
   ```
   viu_user_1@email.com:password1
   viu_user_2@email.com:password2
   viu_user_3@email.com:password3
   viu_user_4@email.com:password4
   viu_user_5@email.com:password5
   viu_user_6@email.com:password6
   ```
4. Klik **"Add Items"**

## Hasil Setelah Perbaikan

### Dashboard akan menampilkan:
```
alight      | Alight Motion 1 Tahun | 2 / 2
vidtv1th    | Vidio Platinum        | 3 / 3
viu1th      | VIU Premium           | 6 / 6
ytbg        | Gsuite YouTube Verif  | 3 / 3 (sudah ada)
ytb1bs      | YouTube Premium       | 3 / 3 (sudah ada)
```

### Bot akan menampilkan (setelah restart dan /refresh):
```
2. Alight Motion 1 Tahun
   💰 Rp 6.000 • Stok: 2

7. Vidio Platinum 1 Tahun TV Only
   💰 Rp 10.000 • Stok: 3

8. VIU Premium 1 Tahun
   💰 Rp 5.000 • Stok: 6
```

## Langkah 5: Restart Bot

Setelah menambahkan semua items:

1. **Stop bot**:
   ```bash
   Ctrl+C
   ```

2. **Restart bot**:
   ```bash
   npm start
   # atau: node bot-telegram/index.js
   ```

3. **Test di bot**:
   - Kirim `/menu` atau `/catalog`
   - Cek apakah stok sudah sesuai dengan dashboard

## Verifikasi Sinkronisasi

Jalankan test lagi untuk memastikan semuanya sinkron:
```bash
node test-stock-sync.js
```

Output yang diharapkan:
```
📊 HASIL: 8/8 produk sudah sinkron
✅ SEMUA DATA SUDAH SINKRON!
```

## Penjelasan Teknis

- **Dashboard** menampilkan items dari tabel `product_items` dengan status "available"
- **Bot** sekarang membaca dari tabel `product_items` juga (setelah fix)
- Sebelumnya, Bot membaca dari field `stok` di tabel `products` (hardcoded)
- Sekarang semua menggunakan tabel `product_items` yang dinamis

Jadi ketika item dibeli dan statusnya berubah menjadi "sold", kedua sistem akan update otomatis.

## Catatan Penting

✅ **Setiap item harus unik** - gunakan format:
- Email: `email@example.com:password`
- Voucher/Kode: `VOUCHER-CODE-123`
- License: `LICENSE-KEY-ABCD`
- Atau format lainnya sesuai jenis produk

❌ **Jangan duplikat item** - sistem akan menolak item yang sudah ada

✅ **Setelah item dijual** - status berubah menjadi "sold" dan tidak bisa dijual lagi

✅ **Untuk edit/hapus item** - gunakan tombol edit/hapus di Product Items page

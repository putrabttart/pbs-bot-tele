# 🔧 FIX: Items Tidak Terkirim

## Masalah
Pembayaran berhasil tetapi **items (produk digital) tidak terkirim** ke user.

### Log Error:
```javascript
{
  ok: true,
  items: [],  // ← KOSONG!
  ...
}
```

## Penyebab
**Google Apps Script tidak mengembalikan items** ketika `finalize` dipanggil.

---

## ✅ Solusi

### Pastikan Google Apps Script Anda mengembalikan items dengan format:

```javascript
function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const action = data.action;
  
  if (action === 'finalize') {
    const order_id = data.order_id;
    const total = data.total;
    
    // 1. Cari order di sheet ORDERS
    const orderSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ORDERS');
    // ... find order by order_id ...
    
    // 2. Ambil items dari sheet stok yang sesuai
    const kode = order.kode;  // misal: 'ytbg'
    const sheet_name = order.sheet;  // misal: 'stok_ytbg'
    const qty = order.qty;
    
    const stokSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheet_name);
    const data = stokSheet.getDataRange().getValues();
    
    // 3. Ambil data sesuai qty yang dibeli
    const items = [];
    for (let i = 1; i < data.length && items.length < qty; i++) {
      const row = data[i];
      const status = row[3];  // Kolom status (sesuaikan index!)
      
      if (status === 'reserved' && row[5] === order_id) {  // reserved untuk order ini
        items.push({
          kode: kode,
          data: row[0] + '||' + row[1]  // misal: email||password
        });
        
        // Update status jadi 'sold'
        stokSheet.getRange(i + 1, 4).setValue('sold');
        stokSheet.getRange(i + 1, 7).setValue(new Date());  // sold_at
      }
    }
    
    // 4. Update status order jadi 'paid'
    // ... update order status ...
    
    // 5. PENTING! Return dengan items
    return ContentService.createTextOutput(JSON.stringify({
      ok: true,
      items: items,  // ← HARUS ADA INI!
      after_msg: '',  // pesan tambahan (opsional)
      order_id: order_id
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // ... handle actions lain ...
}
```

---

## 📝 Format Items yang Harus Dikembalikan

```javascript
{
  ok: true,
  items: [
    {
      kode: "ytbg",
      data: "email@example.com||password123"
    },
    {
      kode: "ytbg", 
      data: "email2@example.com||pass456"
    }
  ],
  after_msg: "Catatan tambahan untuk user (opsional)",
  order_id: "ORD-1768286393897"
}
```

### Format `data`:
- Gunakan `||` sebagai separator
- Contoh: `"email||password"`, `"username||password||notes"`
- Bot akan otomatis memisahkan dan menampilkan per line

---

## 🧪 Testing

### 1. Test manual di Apps Script:
```javascript
function testFinalize() {
  const result = finalizeStock('ORD-TEST-123', 5000);
  Logger.log(result);
  
  // Pastikan result.items TIDAK KOSONG
  if (!result.items || result.items.length === 0) {
    Logger.log('❌ ERROR: Items kosong!');
  } else {
    Logger.log('✅ SUCCESS: ' + result.items.length + ' items');
  }
}
```

### 2. Cek log di bot:
Setelah fix, bot akan menampilkan:
```
[GAS] ✅ Finalize success: 1 item(s) received
```

Jika masih kosong:
```
[GAS] ⚠️  Finalize returned empty items for ORD-xxx!
[GAS] Check your Google Apps Script - it should return items array!
```

---

## 🔍 Debug Checklist

- [ ] Sheet stok ada data dengan status 'available' atau 'reserved'
- [ ] Kolom status di sheet stok ter-update ke 'sold' setelah finalize
- [ ] Function `finalizeStock()` di GAS mengembalikan array items
- [ ] Format items sesuai: `[{kode: "...", data: "...||..."}]`
- [ ] Response JSON dari GAS include `items` field
- [ ] Bot log menunjukkan "Finalize success: X item(s) received"

---

## 📞 Support

Jika masih ada masalah:
1. Screenshot log terminal bot
2. Screenshot log Apps Script
3. Screenshot isi sheet ORDERS dan sheet stok
4. Kirim semua ke developer

---

**Update**: Bot sekarang akan menampilkan pesan warning jika items kosong:
```
⚠️ Item digital belum tersedia
Sedang diproses oleh sistem.
Jika belum diterima dalam 5 menit, hubungi admin.
```

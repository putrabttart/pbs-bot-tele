# User Data & Persistence

## 📁 Data Storage Location

User data disimpan di: **`data/bot-state.json`**

### Data yang Disimpan:

1. **User Sessions** - Status navigasi user (tab, page, kategori, produk yang dipilih)
2. **User Favorites** - Produk favorit setiap user
3. **Purchase History** - Riwayat pembelian
4. **Analytics** - Total order, revenue, product views, search queries

## 🔄 Auto-Save

Bot otomatis menyimpan state setiap **5 menit** dan saat **shutdown**.

### Konfigurasi Auto-Save
```javascript
// Di index.js
startAutoSave(5); // Save every 5 minutes
```

## 💾 Manual Save/Load

### Menyimpan State
```javascript
import { saveState } from './src/bot/persistence.js';
await saveState();
```

### Memuat State
```javascript
import { loadState } from './src/bot/persistence.js';
await loadState();
```

## 📦 Backup Include State

Backup otomatis include user data:

```bash
/admin backup create  # Include bot-state.json
```

## 🔍 Troubleshooting

### User Hilang Setelah Restart

**Penyebab:**
- State belum tersave sebelum shutdown
- File `data/bot-state.json` terhapus
- Error saat load state

**Solusi:**
1. Pastikan bot shutdown dengan benar (SIGINT/SIGTERM)
2. Cek log untuk error saat save/load state
3. Restore dari backup jika ada

### Cek User Count
```bash
# Di admin commands
/admin users
```

Akan menampilkan:
- Active now (last 5 min)
- Last hour
- Last 24 hours
- **Total users** (dari saved state)

## 📊 State File Structure

```json
{
  "version": "2.0",
  "savedAt": "2025-12-30T...",
  "users": [
    [userId, {
      "currentTab": "catalog",
      "currentPage": 1,
      "lastActivity": 1234567890
    }]
  ],
  "favorites": [
    [userId, ["PROD1", "PROD2"]]
  ],
  "history": [
    [userId, [{
      "orderId": "ORD123",
      "productCode": "PROD1",
      "amount": 50000,
      "timestamp": 1234567890
    }]]
  ],
  "analytics": {
    "totalOrders": 100,
    "totalRevenue": 5000000,
    "productViews": [["PROD1", 500]],
    "searchQueries": [["netflix", 50]]
  }
}
```

## ⚙️ Settings vs State

**Settings** (`data/settings.json`):
- Konfigurasi bot (store name, payment methods, etc)
- Editable oleh admin
- Tidak berubah saat user interact

**State** (`data/bot-state.json`):
- User data dinamis
- Berubah saat user interact
- Auto-save setiap 5 menit

## 🚀 Production Recommendations

1. **Regular Backups**: Schedule daily backup via cron
2. **Monitor File Size**: Large user base = large state file
3. **Cleanup**: Implement cleanup untuk user inactive > 30 days
4. **Database Migration**: Untuk >1000 users, consider PostgreSQL/MongoDB

## 📈 State File Growth

Estimasi size per user:
- User session: ~200 bytes
- Favorites: ~50 bytes per item
- History: ~100 bytes per order
- Analytics: minimal overhead

**Contoh:**
- 100 users = ~20 KB
- 1,000 users = ~200 KB
- 10,000 users = ~2 MB

Auto-save 5 menit tidak akan impact performance sampai 10,000+ users.

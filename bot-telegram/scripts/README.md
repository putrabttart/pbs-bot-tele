# Migration Scripts

Scripts untuk migrasi data dari Google Sheets / JSON ke Supabase.

## Prerequisites

1. **Sudah setup Supabase**
   - Project created
   - Schema sudah di-run (supabase/migrations/001_initial_schema.sql)
   - SUPABASE_URL dan SUPABASE_ANON_KEY sudah diset di .env

2. **Google Sheets masih aktif** (untuk migrate-products)
   - SHEET_URL masih valid di .env

## Scripts Available

### 1. migrate-products-to-supabase.js

Import semua products dari Google Sheets CSV ke Supabase.

**Jalankan:**
```bash
node scripts/migrate-products-to-supabase.js
```

**Apa yang dilakukan:**
- Fetch products dari SHEET_URL
- Parse CSV
- Bulk insert ke tabel `products` di Supabase
- Upsert (jika kode sudah ada, akan di-update)

**Output:**
```
📦 MIGRASI PRODUCTS: Google Sheets → Supabase
📥 Fetching products from Google Sheets...
✅ Fetched 150 rows from CSV
📝 Valid products to import: 148
💾 Importing to Supabase...
   Imported 100/148 products...
   Imported 148/148 products...
✅ MIGRATION COMPLETED! 148 products imported
```

### 2. migrate-state-to-supabase.js

Migrate user data dari data/bot-state.json ke Supabase.

**Jalankan:**
```bash
node scripts/migrate-state-to-supabase.js
```

**Apa yang dilakukan:**
- Read data/bot-state.json
- Migrate users ke tabel `users`
- Skip favorites (perlu manual mapping product IDs)
- Skip order history (akan rebuild dari new orders)

**Output:**
```
👥 MIGRASI USER STATE: bot-state.json → Supabase
📥 Reading bot-state.json...
👥 Migrating 25 users...
   ✅ Migrated 25 users
⭐ Favorites migration needs manual product ID mapping
✅ STATE MIGRATION COMPLETED!
```

## Migration Order

Jalankan sesuai urutan:

```bash
# 1. Migrate products first
node scripts/migrate-products-to-supabase.js

# 2. Migrate user state
node scripts/migrate-state-to-supabase.js

# 3. Verify di Supabase dashboard
# - Check Table Editor → products
# - Check Table Editor → users
```

## Verify Migration

Setelah migration, verify di Supabase:

```sql
-- Check products
SELECT COUNT(*) FROM products;
SELECT kategori, COUNT(*) FROM products GROUP BY kategori;

-- Check users
SELECT COUNT(*) FROM users;

-- Sample products
SELECT kode, nama, kategori, harga, stok FROM products LIMIT 10;
```

## Troubleshooting

### Error: "SUPABASE_URL tidak diset"
- Pastikan .env sudah ada
- Pastikan SUPABASE_URL dan SUPABASE_ANON_KEY terisi

### Error: "SHEET_URL tidak diset"
- Untuk migrate-products, SHEET_URL harus ada
- Copy dari .env.example atau .env lama

### Error: "Failed to insert products"
- Check apakah schema sudah di-run
- Check koneksi internet
- Check Supabase dashboard untuk error logs

### Products tidak muncul
- Check di Table Editor → products
- Check filter "aktif = true"
- Run query: `SELECT * FROM products LIMIT 10;`

## Rollback

Jika perlu rollback:

```sql
-- Delete all products
DELETE FROM products;

-- Delete all users
DELETE FROM users;

-- Reset sequences (optional)
-- No sequences to reset (using UUID)
```

## Notes

- Migration scripts menggunakan **UPSERT**, jadi aman untuk dijalankan multiple kali
- Products: match by `kode` (unique)
- Users: match by `user_id` (primary key)
- Favorites dan order history perlu rebuild manual

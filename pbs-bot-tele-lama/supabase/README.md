# Supabase Database Setup

## Quick Start

### 1. Run Migration

Buka **SQL Editor** di Supabase Dashboard, lalu jalankan file:
- `migrations/001_initial_schema.sql`

Copy-paste isi file tersebut ke SQL Editor dan klik **Run**.

### 2. Verify Tables

Setelah migration berhasil, cek di **Table Editor**. Anda harus melihat:
- ✅ products
- ✅ product_items (added in migration 002)
- ✅ users
- ✅ orders
- ✅ order_items
- ✅ stock_reservations
- ✅ favorites
- ✅ settings (added in migration 005)
- ✅ analytics_product_views
- ✅ analytics_searches
- ✅ analytics_daily_stats
- ✅ promos

## Database Functions

Tersedia beberapa PostgreSQL functions untuk business logic:

### Stock Management
- `get_available_stock(product_id)` - Get stock tersedia (minus reservasi)
- `reserve_stock(order_id, product_code, quantity, user_ref)` - Reserve stock
- `finalize_stock(order_id, total)` - Finalize purchase & kurangi stock
- `release_stock(order_id, reason)` - Release reservation (cancel)

### Maintenance
- `clean_expired_reservations()` - Clean expired reservations (jalankan periodik)

## Manual Testing

```sql
-- Insert sample product
INSERT INTO products (kode, nama, kategori, harga, stok, ikon) 
VALUES ('TEST01', 'Test Product', 'Test', 10000, 50, '🧪');

-- Check available stock
SELECT get_available_stock(id) FROM products WHERE kode = 'TEST01';

-- Reserve stock
SELECT reserve_stock('ORDER123', 'TEST01', 5, 'user_123');

-- Check available stock again (should be 45)
SELECT get_available_stock(id) FROM products WHERE kode = 'TEST01';

-- Finalize purchase
SELECT finalize_stock('ORDER123', 50000);

-- Check actual stock (should be 45)
SELECT stok FROM products WHERE kode = 'TEST01';
```

## Scheduled Jobs

Setup cron job di Supabase untuk maintenance:

1. Buka **Database > Cron Jobs**
2. Create job untuk clean expired reservations:

```sql
SELECT cron.schedule(
  'clean-expired-reservations',
  '*/5 * * * *', -- Every 5 minutes
  $$ SELECT clean_expired_reservations(); $$
);
```

## Backup

Supabase otomatis backup setiap hari. Untuk manual backup:
1. Settings > Database > Backup
2. Click "Create backup"

## Migration History

| Version | Date | Description |
|---------|------|-------------|
| 001 | 2026-01-14 | Initial schema - All tables & functions |

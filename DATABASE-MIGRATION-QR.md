# ⚠️ DATABASE MIGRATION - JIKA DIPERLUKAN

Jika QR masih tidak muncul setelah fixes, jalankan query ini di Supabase SQL Editor:

## Check apakah column qr_string ada:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'orders' AND column_name = 'qr_string';
```

**Jika result kosong, jalankan:**

```sql
-- Add qr_string column jika belum ada
ALTER TABLE orders 
ADD COLUMN qr_string TEXT;

-- Verify column dibuat
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'orders' ORDER BY ordinal_position;
```

---

## Verify semua required columns ada:

```sql
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'orders'
ORDER BY ordinal_position;
```

**Expected columns:**
- `id` (BIGINT, PRIMARY KEY)
- `order_id` (TEXT, UNIQUE)
- `customer_name` (TEXT)
- `customer_email` (TEXT)
- `customer_phone` (TEXT)
- `total_amount` (INTEGER)
- `status` (TEXT) - values: pending, paid, completed, cancelled
- `payment_method` (TEXT) - qris, bank_transfer, etc
- `transaction_id` (TEXT) - Midtrans transaction ID
- `qr_string` (TEXT) - ✅ QR data (mungkin perlu ditambah)
- `items` (JSONB) - order items
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

---

## After running migration:

1. Restart Next.js server (Ctrl+C, npm run dev)
2. Test checkout again
3. QR should now be stored dan available di order-pending page


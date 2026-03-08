-- ============================================
-- Backfill/fix product_items product links
-- ============================================
-- Purpose:
--   Normalize historical rows so product_items relation is consistent:
--   - product_id must point to the product represented by product_code
--   - product_code should match canonical products.kode for its product_id

-- 1) If product_id is wrong but product_code matches a product, fix product_id.
UPDATE product_items pi
SET
  product_id = p.id,
  product_code = p.kode,
  updated_at = NOW()
FROM products p
WHERE lower(trim(pi.product_code)) = lower(trim(p.kode))
  AND (pi.product_id IS DISTINCT FROM p.id OR pi.product_code IS DISTINCT FROM p.kode);

-- 2) If product_id is correct but product_code drifted, normalize product_code.
UPDATE product_items pi
SET
  product_code = p.kode,
  updated_at = NOW()
FROM products p
WHERE pi.product_id = p.id
  AND pi.product_code IS DISTINCT FROM p.kode;

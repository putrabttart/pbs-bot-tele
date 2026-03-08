-- ============================================
-- Fix product stock sync trigger for product_items changes
-- ============================================
-- Problem:
--   Existing trigger function referenced NEW.product_id even on DELETE,
--   which can break stock sync on delete operations.
--
-- This migration makes sync robust for INSERT/UPDATE/DELETE by using
-- COALESCE(NEW.product_id, OLD.product_id).

CREATE OR REPLACE FUNCTION sync_product_stock()
RETURNS TRIGGER AS $$
DECLARE
  v_product_id UUID;
BEGIN
  v_product_id := COALESCE(NEW.product_id, OLD.product_id);

  IF v_product_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE products
  SET stok = (
    SELECT COUNT(*)
    FROM product_items
    WHERE product_id = v_product_id
      AND status = 'available'
  )
  WHERE id = v_product_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

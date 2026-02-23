-- ============================================
-- PBS Telegram Bot - Product Items Management
-- ============================================
-- Migration: 002_product_items
-- Created: 2026-01-14
-- Description: Table untuk manage actual items/data yang dikirim ke customer

-- ============================================
-- PRODUCT ITEMS TABLE
-- ============================================
-- Stores actual items/data untuk setiap produk
-- Contoh: Email+Password Netflix, Kode Voucher, License Key, dll
CREATE TABLE product_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_code VARCHAR(50) NOT NULL, -- Redundant untuk fast lookup
  
  -- Item data (flexible format)
  item_data TEXT NOT NULL, -- JSON or plain text (email:password, code, etc)
  
  -- Status tracking
  status VARCHAR(20) NOT NULL DEFAULT 'available', -- available, reserved, sold, invalid
  
  -- Order tracking
  order_id VARCHAR(50), -- Order yang menggunakan item ini
  sold_to_user_id BIGINT, -- User yang membeli
  sold_at TIMESTAMPTZ,
  
  -- Reservation tracking (untuk handle payment pending)
  reserved_for_order VARCHAR(50),
  reserved_at TIMESTAMPTZ,
  reservation_expires_at TIMESTAMPTZ,
  
  -- Metadata
  notes TEXT, -- Catatan admin (expired date, notes, dll)
  batch VARCHAR(50), -- Batch import (opsional)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_product_items_product_id ON product_items(product_id);
CREATE INDEX idx_product_items_product_code ON product_items(product_code);
CREATE INDEX idx_product_items_status ON product_items(status);
CREATE INDEX idx_product_items_order_id ON product_items(order_id);
CREATE INDEX idx_product_items_reserved_for_order ON product_items(reserved_for_order);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function: Get available item count untuk product
CREATE OR REPLACE FUNCTION get_available_items_count(p_product_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM product_items
    WHERE product_id = p_product_id
      AND status = 'available'
  );
END;
$$ LANGUAGE plpgsql;

-- Function: Reserve items for order
CREATE OR REPLACE FUNCTION reserve_items_for_order(
  p_order_id VARCHAR(50),
  p_product_code VARCHAR(50),
  p_quantity INTEGER
)
RETURNS JSON AS $$
DECLARE
  v_product_id UUID;
  v_available_count INTEGER;
  v_items_updated INTEGER;
BEGIN
  -- Get product ID
  SELECT id INTO v_product_id
  FROM products
  WHERE kode = p_product_code AND aktif = true;
  
  IF v_product_id IS NULL THEN
    RETURN json_build_object('ok', false, 'msg', 'product_not_found');
  END IF;
  
  -- Check available items
  v_available_count := get_available_items_count(v_product_id);
  
  IF v_available_count < p_quantity THEN
    RETURN json_build_object('ok', false, 'msg', 'insufficient_items', 'available', v_available_count);
  END IF;
  
  -- Reserve items
  UPDATE product_items
  SET status = 'reserved',
      reserved_for_order = p_order_id,
      reserved_at = NOW(),
      reservation_expires_at = NOW() + INTERVAL '15 minutes'
  WHERE id IN (
    SELECT id
    FROM product_items
    WHERE product_id = v_product_id
      AND status = 'available'
    LIMIT p_quantity
  );
  
  GET DIAGNOSTICS v_items_updated = ROW_COUNT;
  
  RETURN json_build_object('ok', true, 'msg', 'items_reserved', 'count', v_items_updated);
END;
$$ LANGUAGE plpgsql;

-- Function: Finalize items (mark as sold)
CREATE OR REPLACE FUNCTION finalize_items_for_order(
  p_order_id VARCHAR(50),
  p_user_id BIGINT
)
RETURNS JSON AS $$
DECLARE
  v_items_data JSON;
  v_items_count INTEGER;
BEGIN
  -- Get reserved items data
  SELECT 
    json_agg(json_build_object(
      'id', id,
      'product_code', product_code,
      'item_data', item_data
    )),
    COUNT(*)
  INTO v_items_data, v_items_count
  FROM product_items
  WHERE reserved_for_order = p_order_id
    AND status = 'reserved';
  
  IF v_items_count = 0 THEN
    RETURN json_build_object('ok', false, 'msg', 'no_reserved_items');
  END IF;
  
  -- Update items to sold
  UPDATE product_items
  SET status = 'sold',
      order_id = p_order_id,
      sold_to_user_id = p_user_id,
      sold_at = NOW(),
      reserved_for_order = NULL
  WHERE reserved_for_order = p_order_id
    AND status = 'reserved';
  
  RETURN json_build_object(
    'ok', true, 
    'msg', 'items_finalized', 
    'count', v_items_count,
    'items', v_items_data
  );
END;
$$ LANGUAGE plpgsql;

-- Function: Release reserved items (cancel)
CREATE OR REPLACE FUNCTION release_reserved_items(
  p_order_id VARCHAR(50)
)
RETURNS JSON AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE product_items
  SET status = 'available',
      reserved_for_order = NULL,
      reserved_at = NULL,
      reservation_expires_at = NULL
  WHERE reserved_for_order = p_order_id
    AND status = 'reserved';
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN json_build_object('ok', true, 'msg', 'items_released', 'count', v_count);
END;
$$ LANGUAGE plpgsql;

-- Function: Clean expired item reservations
CREATE OR REPLACE FUNCTION clean_expired_item_reservations()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE product_items
  SET status = 'available',
      reserved_for_order = NULL,
      reserved_at = NULL,
      reservation_expires_at = NULL
  WHERE status = 'reserved'
    AND reservation_expires_at < NOW();
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Function: Auto-update product stock based on available items
CREATE OR REPLACE FUNCTION sync_product_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- Update product stock count based on available items
  UPDATE products
  SET stok = (
    SELECT COUNT(*)
    FROM product_items
    WHERE product_id = NEW.product_id
      AND status = 'available'
  )
  WHERE id = NEW.product_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update product stock when items change
CREATE TRIGGER product_items_sync_stock
  AFTER INSERT OR UPDATE OR DELETE ON product_items
  FOR EACH ROW
  EXECUTE FUNCTION sync_product_stock();

-- ============================================
-- VIEWS (untuk kemudahan query)
-- ============================================

-- View: Product inventory summary
CREATE OR REPLACE VIEW product_inventory_summary AS
SELECT 
  p.id as product_id,
  p.kode,
  p.nama,
  p.kategori,
  p.stok as stock_count,
  COUNT(pi.id) FILTER (WHERE pi.status = 'available') as available_items,
  COUNT(pi.id) FILTER (WHERE pi.status = 'reserved') as reserved_items,
  COUNT(pi.id) FILTER (WHERE pi.status = 'sold') as sold_items,
  COUNT(pi.id) FILTER (WHERE pi.status = 'invalid') as invalid_items,
  COUNT(pi.id) as total_items
FROM products p
LEFT JOIN product_items pi ON p.id = pi.product_id
GROUP BY p.id, p.kode, p.nama, p.kategori, p.stok;

-- ============================================
-- SAMPLE DATA (for testing)
-- ============================================
-- Uncomment untuk testing

-- INSERT INTO product_items (product_code, product_id, item_data, notes) 
-- SELECT 
--   'canvahead',
--   id,
--   'email' || gs || '@test.com:password' || gs,
--   'Batch test import'
-- FROM products, generate_series(1, 10) as gs
-- WHERE kode = 'canvahead'
-- LIMIT 10;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE product_items IS 'Individual items/data untuk setiap produk (accounts, vouchers, codes, dll)';
COMMENT ON COLUMN product_items.item_data IS 'Format fleksibel: JSON, plain text, atau custom format (email:password, code, etc)';
COMMENT ON COLUMN product_items.status IS 'available = siap jual, reserved = pending payment, sold = terjual, invalid = expired/tidak valid';
COMMENT ON FUNCTION get_available_items_count IS 'Count available items untuk product';
COMMENT ON FUNCTION reserve_items_for_order IS 'Reserve items untuk pending order';
COMMENT ON FUNCTION finalize_items_for_order IS 'Mark items as sold dan return item data';
COMMENT ON FUNCTION release_reserved_items IS 'Release reserved items jika payment cancel';
COMMENT ON FUNCTION sync_product_stock IS 'Auto-sync product.stok dengan available items count';

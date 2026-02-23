-- ============================================
-- PBS Telegram Bot - Initial Database Schema
-- ============================================
-- Migration: 001_initial_schema
-- Created: 2026-01-14
-- Description: Setup all tables for bot operations

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PRODUCTS TABLE
-- ============================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kode VARCHAR(50) UNIQUE NOT NULL,
  nama TEXT NOT NULL,
  kategori VARCHAR(100),
  harga DECIMAL(12,2) NOT NULL DEFAULT 0,
  harga_lama DECIMAL(12,2),
  stok INTEGER NOT NULL DEFAULT 0,
  ikon TEXT,
  deskripsi TEXT,
  wa TEXT,
  alias TEXT[], -- Array of alternative names for searching
  aktif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for products
CREATE INDEX idx_products_kode ON products(kode);
CREATE INDEX idx_products_kategori ON products(kategori);
CREATE INDEX idx_products_aktif ON products(aktif);
CREATE INDEX idx_products_stok ON products(stok);

-- Full-text search index
CREATE INDEX idx_products_search ON products USING gin(
  to_tsvector('indonesian', coalesce(nama, '') || ' ' || coalesce(deskripsi, '') || ' ' || coalesce(kategori, ''))
);

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE users (
  user_id BIGINT PRIMARY KEY,
  username VARCHAR(100),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  language VARCHAR(10) DEFAULT 'id',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_last_activity ON users(last_activity);

-- ============================================
-- ORDERS TABLE
-- ============================================
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id VARCHAR(50) UNIQUE NOT NULL,
  user_id BIGINT NOT NULL REFERENCES users(user_id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, paid, expired, cancelled
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_url TEXT,
  midtrans_token TEXT,
  user_ref VARCHAR(100), -- Reference for tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX idx_orders_order_id ON orders(order_id);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- ============================================
-- ORDER ITEMS TABLE
-- ============================================
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_code VARCHAR(50) NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price DECIMAL(12,2) NOT NULL,
  item_data TEXT, -- Serialized item details sent to user
  sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_order_items_sent ON order_items(sent);

-- ============================================
-- STOCK RESERVATIONS TABLE
-- ============================================
CREATE TABLE stock_reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id VARCHAR(50) NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id),
  product_code VARCHAR(50) NOT NULL,
  quantity INTEGER NOT NULL,
  user_ref VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'reserved', -- reserved, finalized, released
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '15 minutes',
  finalized_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  release_reason TEXT
);

CREATE INDEX idx_stock_reservations_order_id ON stock_reservations(order_id);
CREATE INDEX idx_stock_reservations_product_id ON stock_reservations(product_id);
CREATE INDEX idx_stock_reservations_status ON stock_reservations(status);
CREATE INDEX idx_stock_reservations_expires_at ON stock_reservations(expires_at);

-- ============================================
-- FAVORITES TABLE
-- ============================================
CREATE TABLE favorites (
  user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, product_id)
);

CREATE INDEX idx_favorites_user_id ON favorites(user_id);
CREATE INDEX idx_favorites_product_id ON favorites(product_id);

-- ============================================
-- ANALYTICS TABLES
-- ============================================

-- Product Views
CREATE TABLE analytics_product_views (
  product_id UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  view_count INTEGER DEFAULT 0,
  last_viewed TIMESTAMPTZ DEFAULT NOW()
);

-- Search Queries
CREATE TABLE analytics_searches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  query TEXT NOT NULL,
  user_id BIGINT REFERENCES users(user_id),
  search_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_searched TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analytics_searches_query ON analytics_searches(query);
CREATE INDEX idx_analytics_searches_last_searched ON analytics_searches(last_searched DESC);

-- Daily Stats
CREATE TABLE analytics_daily_stats (
  date DATE PRIMARY KEY,
  total_orders INTEGER DEFAULT 0,
  total_revenue DECIMAL(12,2) DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analytics_daily_stats_date ON analytics_daily_stats(date DESC);

-- ============================================
-- PROMOS TABLE
-- ============================================
CREATE TABLE promos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  discount_percent DECIMAL(5,2),
  discount_amount DECIMAL(12,2),
  min_purchase DECIMAL(12,2) DEFAULT 0,
  max_discount DECIMAL(12,2),
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  aktif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_promos_code ON promos(code);
CREATE INDEX idx_promos_aktif ON promos(aktif);
CREATE INDEX idx_promos_valid_dates ON promos(valid_from, valid_until);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for products
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Trigger for promos
CREATE TRIGGER promos_updated_at
  BEFORE UPDATE ON promos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Function: Clean expired reservations
CREATE OR REPLACE FUNCTION clean_expired_reservations()
RETURNS void AS $$
BEGIN
  UPDATE stock_reservations
  SET status = 'released',
      released_at = NOW(),
      release_reason = 'expired'
  WHERE status = 'reserved'
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function: Get available stock (considering reservations)
CREATE OR REPLACE FUNCTION get_available_stock(p_product_id UUID)
RETURNS INTEGER AS $$
DECLARE
  total_stock INTEGER;
  reserved_stock INTEGER;
BEGIN
  -- Get total stock
  SELECT stok INTO total_stock
  FROM products
  WHERE id = p_product_id;
  
  -- Get reserved stock (not expired)
  SELECT COALESCE(SUM(quantity), 0) INTO reserved_stock
  FROM stock_reservations
  WHERE product_id = p_product_id
    AND status = 'reserved'
    AND expires_at > NOW();
  
  RETURN GREATEST(total_stock - reserved_stock, 0);
END;
$$ LANGUAGE plpgsql;

-- Function: Reserve stock
CREATE OR REPLACE FUNCTION reserve_stock(
  p_order_id VARCHAR(50),
  p_product_code VARCHAR(50),
  p_quantity INTEGER,
  p_user_ref VARCHAR(100)
)
RETURNS JSON AS $$
DECLARE
  v_product_id UUID;
  v_available_stock INTEGER;
  v_reservation_id UUID;
BEGIN
  -- Get product ID and check availability
  SELECT id INTO v_product_id
  FROM products
  WHERE kode = p_product_code AND aktif = true;
  
  IF v_product_id IS NULL THEN
    RETURN json_build_object('ok', false, 'msg', 'product_not_found');
  END IF;
  
  -- Check available stock
  v_available_stock := get_available_stock(v_product_id);
  
  IF v_available_stock < p_quantity THEN
    RETURN json_build_object('ok', false, 'msg', 'insufficient_stock', 'available', v_available_stock);
  END IF;
  
  -- Create reservation
  INSERT INTO stock_reservations (order_id, product_id, product_code, quantity, user_ref)
  VALUES (p_order_id, v_product_id, p_product_code, p_quantity, p_user_ref)
  RETURNING id INTO v_reservation_id;
  
  RETURN json_build_object('ok', true, 'msg', 'reserved', 'reservation_id', v_reservation_id);
END;
$$ LANGUAGE plpgsql;

-- Function: Finalize stock (complete purchase)
CREATE OR REPLACE FUNCTION finalize_stock(
  p_order_id VARCHAR(50),
  p_total DECIMAL(12,2)
)
RETURNS JSON AS $$
DECLARE
  v_reservation RECORD;
  v_items JSON[] := '{}';
BEGIN
  -- Update reservations to finalized and decrease stock
  FOR v_reservation IN
    SELECT sr.id, sr.product_id, sr.product_code, sr.quantity, p.nama
    FROM stock_reservations sr
    JOIN products p ON sr.product_id = p.id
    WHERE sr.order_id = p_order_id AND sr.status = 'reserved'
  LOOP
    -- Update reservation
    UPDATE stock_reservations
    SET status = 'finalized',
        finalized_at = NOW()
    WHERE id = v_reservation.id;
    
    -- Decrease product stock
    UPDATE products
    SET stok = GREATEST(stok - v_reservation.quantity, 0)
    WHERE id = v_reservation.product_id;
    
    -- Build items array for response
    v_items := array_append(v_items, json_build_object(
      'kode', v_reservation.product_code,
      'nama', v_reservation.nama,
      'qty', v_reservation.quantity
    ));
  END LOOP;
  
  IF array_length(v_items, 1) = 0 THEN
    RETURN json_build_object('ok', false, 'msg', 'no_reservations_found');
  END IF;
  
  RETURN json_build_object('ok', true, 'msg', 'finalized', 'items', v_items);
END;
$$ LANGUAGE plpgsql;

-- Function: Release stock (cancel reservation)
CREATE OR REPLACE FUNCTION release_stock(
  p_order_id VARCHAR(50),
  p_reason TEXT
)
RETURNS JSON AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE stock_reservations
  SET status = 'released',
      released_at = NOW(),
      release_reason = p_reason
  WHERE order_id = p_order_id
    AND status = 'reserved';
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN json_build_object('ok', true, 'msg', 'released', 'count', v_count);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
-- Enable RLS on sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own data
CREATE POLICY users_select_own ON users
  FOR SELECT
  USING (true); -- Bot will handle authorization

CREATE POLICY favorites_all ON favorites
  FOR ALL
  USING (true); -- Bot will handle authorization

CREATE POLICY orders_all ON orders
  FOR ALL
  USING (true); -- Bot will handle authorization

-- ============================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================
-- Uncomment to insert sample data

-- INSERT INTO products (kode, nama, kategori, harga, stok, ikon, deskripsi) VALUES
-- ('PROD001', 'Netflix Premium 1 Month', 'Streaming', 50000, 100, '🎬', 'Netflix Premium subscription for 1 month'),
-- ('PROD002', 'Spotify Premium 1 Month', 'Music', 30000, 50, '🎵', 'Spotify Premium subscription for 1 month'),
-- ('PROD003', 'Disney+ Hotstar 1 Month', 'Streaming', 40000, 75, '🎭', 'Disney+ Hotstar subscription for 1 month');

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE products IS 'Product catalog with stock management';
COMMENT ON TABLE orders IS 'Customer orders with payment tracking';
COMMENT ON TABLE stock_reservations IS 'Temporary stock reservations for pending payments';
COMMENT ON FUNCTION get_available_stock IS 'Calculate available stock considering active reservations';
COMMENT ON FUNCTION reserve_stock IS 'Reserve stock for a pending order';
COMMENT ON FUNCTION finalize_stock IS 'Finalize reservation and decrease stock after payment';
COMMENT ON FUNCTION release_stock IS 'Release reserved stock if payment cancelled/expired';

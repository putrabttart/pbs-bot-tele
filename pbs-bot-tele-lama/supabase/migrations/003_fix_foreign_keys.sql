-- ============================================
-- PBS Telegram Bot - Fix Foreign Key Constraints
-- ============================================
-- Migration: 003_fix_foreign_keys
-- Created: 2026-01-14
-- Description: Fix stock_reservations FK to cascade on delete
--              Ensure RLS policies exist for all tables

-- ============================================
-- DROP OLD CONSTRAINT AND ADD CASCADE DELETE
-- ============================================
-- Drop the old foreign key constraint
ALTER TABLE stock_reservations
DROP CONSTRAINT stock_reservations_product_id_fkey;

-- Add the new constraint with ON DELETE CASCADE
ALTER TABLE stock_reservations
ADD CONSTRAINT stock_reservations_product_id_fkey
FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- ============================================
-- ENSURE RLS IS ENABLED
-- ============================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_product_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_search_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_sales_by_category ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ENABLE ANON ACCESS FOR PUBLIC DATA
-- ============================================
-- Products (public read)
DROP POLICY IF EXISTS "Allow anon to read active products" ON products;
CREATE POLICY "Allow anon to read active products" ON products
  FOR SELECT
  USING (aktif = true);

-- Product Items (public read)
DROP POLICY IF EXISTS "Allow anon to read available items" ON product_items;
CREATE POLICY "Allow anon to read available items" ON product_items
  FOR SELECT
  USING (status = 'available');

-- Users (anon can only read own)
DROP POLICY IF EXISTS "Allow anon to read own user" ON users;
CREATE POLICY "Allow anon to read own user" ON users
  FOR SELECT
  USING (auth.uid()::BIGINT = user_id OR auth.role() = 'authenticated');

-- Orders (anon can read/insert own)
DROP POLICY IF EXISTS "Allow anon to read own orders" ON orders;
CREATE POLICY "Allow anon to read own orders" ON orders
  FOR SELECT
  USING (auth.uid()::BIGINT = user_id);

DROP POLICY IF EXISTS "Allow anon to insert orders" ON orders;
CREATE POLICY "Allow anon to insert orders" ON orders
  FOR INSERT
  WITH CHECK (auth.uid()::BIGINT = user_id);

-- Order Items (anon can read own)
DROP POLICY IF EXISTS "Allow anon to read own order items" ON order_items;
CREATE POLICY "Allow anon to read own order items" ON order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()::BIGINT
    )
  );

-- ============================================
-- ANALYTICS TABLES RLS
-- ============================================
DROP POLICY IF EXISTS "Allow anon to read analytics" ON analytics_product_views;
CREATE POLICY "Allow anon to read analytics" ON analytics_product_views
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow anon to read search queries" ON analytics_search_queries;
CREATE POLICY "Allow anon to read search queries" ON analytics_search_queries
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow anon to read category analytics" ON analytics_sales_by_category;
CREATE POLICY "Allow anon to read category analytics" ON analytics_sales_by_category
  FOR SELECT
  USING (true);

-- Favorites (anon can read/manage own)
DROP POLICY IF EXISTS "Allow anon to read favorites" ON favorites;
CREATE POLICY "Allow anon to read favorites" ON favorites
  FOR SELECT
  USING (auth.uid()::BIGINT = user_id);

DROP POLICY IF EXISTS "Allow anon to manage favorites" ON favorites;
CREATE POLICY "Allow anon to manage favorites" ON favorites
  FOR INSERT
  WITH CHECK (auth.uid()::BIGINT = user_id);

DROP POLICY IF EXISTS "Allow anon to delete favorites" ON favorites;
CREATE POLICY "Allow anon to delete favorites" ON favorites
  FOR DELETE
  USING (auth.uid()::BIGINT = user_id);

-- Stock Reservations (backend service only)
DROP POLICY IF EXISTS "Disable direct access to reservations" ON stock_reservations;
CREATE POLICY "Disable direct access to reservations" ON stock_reservations
  FOR ALL
  USING (false);

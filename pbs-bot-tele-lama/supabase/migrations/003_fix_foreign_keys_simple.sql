-- ============================================
-- PBS Telegram Bot - Fix Foreign Key Constraints (Simplified)
-- ============================================
-- Migration: 003_fix_foreign_keys
-- Description: Fix stock_reservations FK to cascade on delete

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
-- ENABLE RLS ON EXISTING TABLES
-- ============================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES - ALLOW OPERATIONS
-- ============================================

-- ============ PRODUCTS TABLE ============
-- Allow everyone to read active products
DROP POLICY IF EXISTS "products_read_active" ON products;
CREATE POLICY "products_read_active" ON products
  FOR SELECT
  USING (aktif = true);

-- Allow authenticated users to manage products
DROP POLICY IF EXISTS "products_manage_auth" ON products;
CREATE POLICY "products_manage_auth" ON products
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ============ PRODUCT_ITEMS TABLE ============
-- Allow everyone to read available items
DROP POLICY IF EXISTS "product_items_read_available" ON product_items;
CREATE POLICY "product_items_read_available" ON product_items
  FOR SELECT
  USING (status = 'available');

-- Allow authenticated users to manage items
DROP POLICY IF EXISTS "product_items_manage_auth" ON product_items;
CREATE POLICY "product_items_manage_auth" ON product_items
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ============ ORDERS TABLE ============
-- Allow authenticated to read/insert their own orders
DROP POLICY IF EXISTS "orders_read_own" ON orders;
CREATE POLICY "orders_read_own" ON orders
  FOR SELECT
  USING (auth.uid()::BIGINT = user_id);

DROP POLICY IF EXISTS "orders_insert_own" ON orders;
CREATE POLICY "orders_insert_own" ON orders
  FOR INSERT
  WITH CHECK (auth.uid()::BIGINT = user_id);

-- Allow authenticated users (admin) to read all
DROP POLICY IF EXISTS "orders_manage_auth" ON orders;
CREATE POLICY "orders_manage_auth" ON orders
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ============ ORDER_ITEMS TABLE ============
-- Allow authenticated to read own order items
DROP POLICY IF EXISTS "order_items_read_own" ON order_items;
CREATE POLICY "order_items_read_own" ON order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND (orders.user_id = auth.uid()::BIGINT OR auth.role() = 'authenticated')
    )
  );

-- Allow authenticated users to manage
DROP POLICY IF EXISTS "order_items_manage_auth" ON order_items;
CREATE POLICY "order_items_manage_auth" ON order_items
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ============ USERS TABLE ============
-- Allow authenticated to read own user
DROP POLICY IF EXISTS "users_read_own" ON users;
CREATE POLICY "users_read_own" ON users
  FOR SELECT
  USING (auth.uid()::BIGINT = user_id OR auth.role() = 'authenticated');

-- Allow authenticated to manage users
DROP POLICY IF EXISTS "users_manage_auth" ON users;
CREATE POLICY "users_manage_auth" ON users
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ============ STOCK_RESERVATIONS TABLE ============
-- Backend/service role only - disable public access
DROP POLICY IF EXISTS "stock_reservations_disable_public" ON stock_reservations;
CREATE POLICY "stock_reservations_disable_public" ON stock_reservations
  FOR ALL
  USING (false)
  WITH CHECK (false);

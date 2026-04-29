-- ============================================
-- User Web Registration & Authentication
-- Migration: 013_create_user_web_table
-- Description: Create user_web table for web store user accounts
-- ============================================

-- ============================================
-- USER_WEB TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_web (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nama VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(20) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_user_web_email ON user_web(email);
CREATE INDEX idx_user_web_phone ON user_web(phone);
CREATE INDEX idx_user_web_created_at ON user_web(created_at DESC);

-- Enable RLS
ALTER TABLE user_web ENABLE ROW LEVEL SECURITY;

-- RLS policies (service role bypasses RLS, so these are permissive for anon)
CREATE POLICY "user_web_select_own" ON user_web FOR SELECT USING (true);
CREATE POLICY "user_web_insert" ON user_web FOR INSERT WITH CHECK (true);
CREATE POLICY "user_web_update_own" ON user_web FOR UPDATE USING (true);

-- ============================================
-- Add user_web_id column to orders table
-- This links web orders to registered user accounts
-- ============================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_web_id UUID REFERENCES user_web(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orders_user_web_id ON orders(user_web_id);

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE user_web IS 'Registered user accounts for the web store';
COMMENT ON COLUMN user_web.nama IS 'Full name of the user';
COMMENT ON COLUMN user_web.email IS 'Email address (unique, used for login)';
COMMENT ON COLUMN user_web.phone IS 'Phone number (unique, used for login)';
COMMENT ON COLUMN user_web.password_hash IS 'Bcrypt hashed password';
COMMENT ON COLUMN user_web.is_active IS 'Whether the account is active';
COMMENT ON COLUMN orders.user_web_id IS 'FK to user_web for registered user orders';

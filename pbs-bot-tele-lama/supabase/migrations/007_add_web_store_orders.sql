-- ============================================
-- Web Store Orders Schema
-- Migration: 007_add_web_store_orders
-- Description: Add columns to orders table for web store QRIS payments
-- ============================================

-- Add new columns to orders table for web store
ALTER TABLE orders ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;

-- Make user_id nullable since web store users don't have telegram user_id
ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL;

-- Add indexes for web store queries
CREATE INDEX IF NOT EXISTS idx_orders_transaction_id ON orders(transaction_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON orders(payment_method);

-- Comment on new columns
COMMENT ON COLUMN orders.transaction_id IS 'Midtrans transaction ID for QRIS payments';
COMMENT ON COLUMN orders.customer_name IS 'Customer name from web store checkout';
COMMENT ON COLUMN orders.customer_email IS 'Customer email from web store checkout';
COMMENT ON COLUMN orders.customer_phone IS 'Customer phone from web store checkout';
COMMENT ON COLUMN orders.payment_method IS 'Payment method: qris, snap, etc';
COMMENT ON COLUMN orders.items IS 'Array of purchased items with product details';

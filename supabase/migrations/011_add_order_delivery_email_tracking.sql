-- ============================================
-- Order delivery email tracking
-- Migration: 011_add_order_delivery_email_tracking
-- Description: Add idempotent state fields for customer item delivery email
-- ============================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_email_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS delivery_email_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_email_last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_email_last_error TEXT,
  ADD COLUMN IF NOT EXISTS delivery_email_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_delivery_email_status
  ON orders(delivery_email_status);

COMMENT ON COLUMN orders.delivery_email_status IS 'Customer email delivery state: pending, processing, sent, failed';
COMMENT ON COLUMN orders.delivery_email_attempts IS 'How many delivery attempts have been made';
COMMENT ON COLUMN orders.delivery_email_last_attempt_at IS 'Last attempt timestamp for delivery email';
COMMENT ON COLUMN orders.delivery_email_last_error IS 'Last error message when delivery email failed';
COMMENT ON COLUMN orders.delivery_email_sent_at IS 'Timestamp when delivery email was successfully sent';

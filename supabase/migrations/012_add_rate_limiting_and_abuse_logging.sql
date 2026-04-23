-- ============================================
-- Rate Limiting and Abuse Logging
-- Migration: 012_add_rate_limiting_and_abuse_logging
-- Description: Add tables for rate limiting and abuse logging to prevent fake orders
-- ============================================

-- ============================================
-- RATE LIMITS TABLE
-- ============================================
CREATE TABLE rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip INET NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for rate limits
CREATE UNIQUE INDEX idx_rate_limits_ip_window ON rate_limits(ip, window_start);
CREATE INDEX idx_rate_limits_email_window ON rate_limits(email, window_start);
CREATE INDEX idx_rate_limits_phone_window ON rate_limits(phone, window_start);
CREATE INDEX idx_rate_limits_updated_at ON rate_limits(updated_at);

-- ============================================
-- ABUSE LOGS TABLE
-- ============================================
CREATE TABLE abuse_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip INET NOT NULL,
  user_agent TEXT,
  referer TEXT,
  origin TEXT,
  captcha_score DECIMAL(3,2),
  captcha_result TEXT,
  source VARCHAR(50) NOT NULL DEFAULT 'checkout',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for abuse logs
CREATE INDEX idx_abuse_logs_ip ON abuse_logs(ip);
CREATE INDEX idx_abuse_logs_created_at ON abuse_logs(created_at DESC);
CREATE INDEX idx_abuse_logs_source ON abuse_logs(source);

-- ============================================
-- Atomic Rate Limiting Function
-- ============================================
CREATE OR REPLACE FUNCTION check_and_update_rate_limits(
  p_ip INET,
  p_email VARCHAR(255),
  p_phone VARCHAR(20),
  p_request_limit INTEGER DEFAULT 3,
  p_pending_limit INTEGER DEFAULT 2,
  p_window_minutes INTEGER DEFAULT 30
) RETURNS JSON AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_window_start TIMESTAMPTZ := v_now - INTERVAL '1 minute' * p_window_minutes;
  v_ip_window_start TIMESTAMPTZ := v_now - INTERVAL '10 minutes'; -- IP limit is 10 minutes
  v_request_count INTEGER := 0;
  v_email_pending INTEGER := 0;
  v_phone_pending INTEGER := 0;
  v_ip_pending INTEGER := 0;
  v_result JSON;
BEGIN
  -- Check IP request rate limit
  SELECT COALESCE(request_count, 0) INTO v_request_count
  FROM rate_limits
  WHERE ip = p_ip AND window_start >= v_ip_window_start;

  IF v_request_count >= p_request_limit THEN
    RETURN json_build_object('allowed', false, 'reason', 'Too many requests from this IP address');
  END IF;

  -- Check email pending orders
  SELECT COUNT(*) INTO v_email_pending
  FROM orders
  WHERE customer_email = p_email AND status = 'pending' AND created_at >= v_window_start;

  IF v_email_pending >= p_pending_limit THEN
    RETURN json_build_object('allowed', false, 'reason', 'Too many pending orders for this email');
  END IF;

  -- Check phone pending orders
  SELECT COUNT(*) INTO v_phone_pending
  FROM orders
  WHERE customer_phone = p_phone AND status = 'pending' AND created_at >= v_window_start;

  IF v_phone_pending >= p_pending_limit THEN
    RETURN json_build_object('allowed', false, 'reason', 'Too many pending orders for this phone number');
  END IF;

  -- Check IP pending orders
  SELECT COUNT(*) INTO v_ip_pending
  FROM orders
  WHERE client_ip = p_ip AND status = 'pending' AND created_at >= v_window_start;

  IF v_ip_pending >= p_pending_limit THEN
    RETURN json_build_object('allowed', false, 'reason', 'Too many pending orders from this IP address');
  END IF;

  -- All checks passed, update rate limits atomically
  INSERT INTO rate_limits (ip, request_count, window_start, updated_at)
  VALUES (p_ip, 1, v_ip_window_start, v_now)
  ON CONFLICT (ip, window_start)
  DO UPDATE SET
    request_count = rate_limits.request_count + 1,
    updated_at = v_now;

  RETURN json_build_object('allowed', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_and_update_rate_limits(INET, VARCHAR, VARCHAR, INTEGER, INTEGER, INTEGER) TO authenticated, anon;
COMMENT ON COLUMN rate_limits.email IS 'Customer email for email-based rate limiting';
COMMENT ON COLUMN rate_limits.phone IS 'Customer phone for phone-based rate limiting';
COMMENT ON COLUMN rate_limits.request_count IS 'Number of requests in current window';
COMMENT ON COLUMN rate_limits.window_start IS 'Start time of current rate limit window';
COMMENT ON COLUMN abuse_logs.ip IS 'Client IP address';
COMMENT ON COLUMN abuse_logs.user_agent IS 'HTTP User-Agent header';
COMMENT ON COLUMN abuse_logs.referer IS 'HTTP Referer header';
COMMENT ON COLUMN abuse_logs.origin IS 'HTTP Origin header';
COMMENT ON COLUMN abuse_logs.captcha_score IS 'CAPTCHA verification score (0.0-1.0)';
COMMENT ON COLUMN abuse_logs.captcha_result IS 'CAPTCHA verification result';
COMMENT ON COLUMN abuse_logs.source IS 'Source of the abuse log entry';
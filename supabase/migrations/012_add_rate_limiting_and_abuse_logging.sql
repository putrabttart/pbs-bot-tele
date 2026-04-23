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

-- Comments
COMMENT ON TABLE rate_limits IS 'Rate limiting data for checkout requests';
COMMENT ON TABLE abuse_logs IS 'Abuse logging for suspicious checkout attempts';
COMMENT ON COLUMN rate_limits.ip IS 'Client IP address';
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
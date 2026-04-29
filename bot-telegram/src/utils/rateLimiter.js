// src/utils/rateLimiter.js
// Token bucket rate limiter untuk mencegah spam

class RateLimiter {
  constructor(options = {}) {
    this.maxTokens = options.maxTokens || 10; // Max requests
    this.refillRate = options.refillRate || 1; // Tokens per interval
    this.refillInterval = options.refillInterval || 1000; // 1 second
    this.windowMs = options.windowMs || 60000; // 1 minute window
    this.buckets = new Map(); // userId -> { tokens, lastRefill, violations }
    
    // Cleanup old buckets every 5 minutes
    setInterval(() => this.cleanup(), 300000);
  }

  /**
   * Check if user is allowed to proceed
   * @param {string|number} userId - Telegram user ID
   * @returns {Object} - { allowed: boolean, remaining: number, resetAt: Date }
   */
  checkLimit(userId) {
    const now = Date.now();
    let bucket = this.buckets.get(userId);

    if (!bucket) {
      bucket = {
        tokens: this.maxTokens - 1,
        lastRefill: now,
        violations: 0,
        firstRequest: now
      };
      this.buckets.set(userId, bucket);
      return { allowed: true, remaining: bucket.tokens, resetAt: null };
    }

    // Refill tokens based on time passed
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor(timePassed / this.refillInterval) * this.refillRate;
    
    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(this.maxTokens, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

    // Check if user has tokens
    if (bucket.tokens > 0) {
      bucket.tokens--;
      this.buckets.set(userId, bucket);
      return { 
        allowed: true, 
        remaining: bucket.tokens,
        resetAt: new Date(now + this.refillInterval)
      };
    }

    // Rate limit exceeded
    bucket.violations++;
    const resetAt = new Date(bucket.lastRefill + this.refillInterval);
    
    return { 
      allowed: false, 
      remaining: 0,
      resetAt,
      violations: bucket.violations
    };
  }

  /**
   * Reset limit for a user (admin override)
   */
  reset(userId) {
    this.buckets.delete(userId);
  }

  /**
   * Get stats for a user
   */
  getStats(userId) {
    const bucket = this.buckets.get(userId);
    if (!bucket) return null;
    
    return {
      tokens: bucket.tokens,
      maxTokens: this.maxTokens,
      violations: bucket.violations,
      firstRequest: new Date(bucket.firstRequest),
      lastRefill: new Date(bucket.lastRefill)
    };
  }

  /**
   * Cleanup old buckets (inactive > 1 hour)
   */
  cleanup() {
    const now = Date.now();
    const oneHour = 3600000;
    
    for (const [userId, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefill > oneHour) {
        this.buckets.delete(userId);
      }
    }
  }

  /**
   * Get all active users count
   */
  getActiveUsers() {
    return this.buckets.size;
  }
}

// Create default rate limiter instances
export const messageLimiter = new RateLimiter({
  maxTokens: 20,      // 20 requests
  refillRate: 2,      // 2 tokens per second
  refillInterval: 1000,
  windowMs: 60000     // 1 minute window
});

export const commandLimiter = new RateLimiter({
  maxTokens: 10,      // 10 commands
  refillRate: 1,      // 1 token per 2 seconds
  refillInterval: 2000,
  windowMs: 60000
});

export const callbackLimiter = new RateLimiter({
  maxTokens: 30,      // 30 callbacks
  refillRate: 3,      // 3 tokens per second
  refillInterval: 1000,
  windowMs: 60000
});

/**
 * Middleware for rate limiting
 */
export function createRateLimitMiddleware(limiter, options = {}) {
  const {
    keyGenerator = (ctx) => ctx.from?.id,
    onLimitExceeded = async (ctx, info) => {
      const resetTime = info.resetAt ? ` Coba lagi ${Math.ceil((info.resetAt - Date.now()) / 1000)}s lagi.` : '';
      await ctx.reply(
        `⚠️ Terlalu banyak permintaan. Harap tunggu sebentar.${resetTime}`,
        { reply_to_message_id: ctx.message?.message_id }
      );
    },
    skipCondition = () => false
  } = options;

  return async (ctx, next) => {
    // Skip if condition met (e.g., admin users)
    if (skipCondition(ctx)) {
      return next();
    }

    const key = keyGenerator(ctx);
    if (!key) {
      return next(); // No user ID, skip rate limiting
    }

    const result = limiter.checkLimit(key);

    if (!result.allowed) {
      // Log violation
      console.warn(`[RATE_LIMIT] User ${key} exceeded limit (violations: ${result.violations})`);
      
      // Call custom handler
      if (onLimitExceeded) {
        await onLimitExceeded(ctx, result);
      }
      
      return; // Block request
    }

    // Add rate limit info to context
    ctx.rateLimit = result;
    
    return next();
  };
}

export default RateLimiter;

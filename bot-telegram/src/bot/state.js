// src/bot/state.js
/**
 * Bot State Management
 * Handles user sessions, orders, favorites, analytics
 */

// User sessions - stores current navigation state
export const USER_SESSIONS = new Map();

// Active orders - order_id -> order details
export const ACTIVE_ORDERS = new Map();

// User favorites - userId -> Set(productCode)
export const USER_FAVORITES = new Map();

// User purchase history - userId -> Array(orders)
export const PURCHASE_HISTORY = new Map();

// Rate limiting - userId -> timestamp
export const RATE_LIMITER = new Map();

// Analytics - stores various metrics
export const ANALYTICS = {
  totalOrders: 0,
  totalRevenue: 0,
  productViews: new Map(), // productCode -> count
  searchQueries: new Map(), // query -> count
  dailyStats: new Map(), // date -> stats
  userActivity: new Map(), // userId -> lastActivity
};

/**
 * Get or create user session
 */
export function getUserSession(userId) {
  if (!USER_SESSIONS.has(userId)) {
    USER_SESSIONS.set(userId, {
      currentTab: 'catalog',
      currentPage: 1,
      currentCategory: null,
      selectedProduct: null,
      selectedQuantity: 1,
      searchQuery: null,
      lastActivity: Date.now(),
      language: 'id',
    });
  }
  
  const session = USER_SESSIONS.get(userId);
  session.lastActivity = Date.now();
  return session;
}

/**
 * Update user session
 */
export function updateUserSession(userId, updates) {
  const session = getUserSession(userId);
  Object.assign(session, updates);
  return session;
}

/**
 * Check rate limit
 */
export function checkRateLimit(userId, cooldownMs) {
  const now = Date.now();
  const lastTime = RATE_LIMITER.get(userId) || 0;
  
  if (now - lastTime < cooldownMs) {
    return false; // Rate limited
  }
  
  RATE_LIMITER.set(userId, now);
  return true;
}

/**
 * Add to favorites
 */
export function addToFavorites(userId, productCode) {
  if (!USER_FAVORITES.has(userId)) {
    USER_FAVORITES.set(userId, new Set());
  }
  USER_FAVORITES.get(userId).add(productCode);
}

/**
 * Remove from favorites
 */
export function removeFromFavorites(userId, productCode) {
  if (USER_FAVORITES.has(userId)) {
    USER_FAVORITES.get(userId).delete(productCode);
  }
}

/**
 * Get user favorites
 */
export function getUserFavorites(userId) {
  return USER_FAVORITES.get(userId) || new Set();
}

/**
 * Is product favorited
 */
export function isFavorited(userId, productCode) {
  return USER_FAVORITES.has(userId) && USER_FAVORITES.get(userId).has(productCode);
}

/**
 * Record product view
 */
export function recordProductView(productCode) {
  const count = ANALYTICS.productViews.get(productCode) || 0;
  ANALYTICS.productViews.set(productCode, count + 1);
}

/**
 * Record search query
 */
export function recordSearchQuery(query) {
  const normalized = query.toLowerCase().trim();
  const count = ANALYTICS.searchQueries.get(normalized) || 0;
  ANALYTICS.searchQueries.set(normalized, count + 1);
}

/**
 * Record order
 */
export function recordOrder(orderId, userId, amount, productCode) {
  try {
    ANALYTICS.totalOrders++;
    ANALYTICS.totalRevenue += amount;
    
    // Update daily stats
    const today = new Date().toISOString().split('T')[0];
    if (!ANALYTICS.dailyStats.has(today)) {
      ANALYTICS.dailyStats.set(today, { orders: 0, revenue: 0, products: new Map() });
    }
    
    const dailyStat = ANALYTICS.dailyStats.get(today);
    dailyStat.orders++;
    dailyStat.revenue += amount;
    
    // Ensure products is a Map
    if (!dailyStat.products || !(dailyStat.products instanceof Map)) {
      dailyStat.products = new Map();
    }
    
    const productCount = dailyStat.products.get(productCode) || 0;
    dailyStat.products.set(productCode, productCount + 1);
    
    // Add to user history
    if (!PURCHASE_HISTORY.has(userId)) {
      PURCHASE_HISTORY.set(userId, []);
    }
    
    PURCHASE_HISTORY.get(userId).push({
      orderId,
      productCode,
      amount,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[RECORD ORDER ERROR]', error);
    // Continue anyway, analytics not critical
  }
}

/**
 * Get user purchase history
 */
export function getUserPurchaseHistory(userId, limit = 10) {
  const history = PURCHASE_HISTORY.get(userId) || [];
  return history.slice(-limit).reverse();
}

/**
 * Get analytics summary
 */
export function getAnalyticsSummary() {
  return {
    totalOrders: ANALYTICS.totalOrders,
    totalRevenue: ANALYTICS.totalRevenue,
    topProducts: Array.from(ANALYTICS.productViews.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10),
    topSearches: Array.from(ANALYTICS.searchQueries.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10),
    activeUsers: USER_SESSIONS.size,
  };
}

/**
 * Clean up old sessions (call periodically)
 */
export function cleanupSessions(maxAgeMs = 24 * 60 * 60 * 1000) {
  const now = Date.now();
  for (const [userId, session] of USER_SESSIONS.entries()) {
    if (now - session.lastActivity > maxAgeMs) {
      USER_SESSIONS.delete(userId);
    }
  }
}

// Cleanup every hour
setInterval(() => cleanupSessions(), 60 * 60 * 1000);

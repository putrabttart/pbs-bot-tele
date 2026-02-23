// Database settings service for reading app configuration from Supabase
const { supabase } = require('../database/supabase')

// Cache settings in memory to reduce database calls
let settingsCache = null
let lastCacheTime = 0
const CACHE_TTL = 60000 // 1 minute

const defaultSettings = {
  store_name: process.env.STORE_NAME || 'Putra Btt Store',
  store_description: process.env.STORE_DESCRIPTION || 'Toko Digital Terpercaya #1',
  support_contact: process.env.SUPPORT_CONTACT || '@aryadwinata543',
  catalog_banner_url: process.env.CATALOG_BANNER_URL || '',
  items_per_page: parseInt(process.env.ITEMS_PER_PAGE || '10'),
  grid_cols: parseInt(process.env.GRID_COLS || '5'),
  enable_promo: process.env.ENABLE_PROMO === 'true',
  enable_referral: process.env.ENABLE_REFERRAL === 'true',
  enable_analytics: process.env.ENABLE_ANALYTICS === 'true',
  enable_favorites: process.env.ENABLE_FAVORITES === 'true',
  payment_ttl_minutes: parseInt(process.env.PAYMENT_TTL_MS || '900000') / 60000,
  currency: process.env.CURRENCY || 'IDR',
  locale: process.env.LOCALE || 'id-ID',
}

/**
 * Get all settings from database or cache
 * Falls back to environment variables if database is unavailable
 */
async function getAppSettings() {
  const now = Date.now()
  
  // Return cached settings if still valid
  if (settingsCache && (now - lastCacheTime) < CACHE_TTL) {
    return settingsCache
  }
  
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('key, value')
    
    if (error) throw error
    
    const settings = { ...defaultSettings }
    
    data?.forEach((item) => {
      const key = item.key
      const value = item.value
      
      // Parse value based on key
      if (key === 'items_per_page' || key === 'grid_cols' || key === 'payment_ttl_minutes') {
        settings[key] = parseInt(value, 10)
      } else if (key === 'enable_promo' || key === 'enable_referral' || key === 'enable_analytics' || key === 'enable_favorites') {
        settings[key] = value === 'true'
      } else {
        settings[key] = value
      }
    })
    
    // Update cache
    settingsCache = settings
    lastCacheTime = now
    
    return settings
  } catch (error) {
    console.error('Error fetching settings from database, using defaults:', error)
    return defaultSettings
  }
}

/**
 * Get a specific setting value
 */
async function getAppSetting(key) {
  const settings = await getAppSettings()
  return settings[key]
}

/**
 * Clear settings cache (call this after updating settings)
 */
function clearAppSettingsCache() {
  settingsCache = null
  lastCacheTime = 0
}

/**
 * Refresh settings cache from database
 */
async function refreshAppSettings() {
  clearAppSettingsCache()
  return await getAppSettings()
}

module.exports = {
  getAppSettings,
  getAppSetting,
  clearAppSettingsCache,
  refreshAppSettings,
  defaultSettings
}

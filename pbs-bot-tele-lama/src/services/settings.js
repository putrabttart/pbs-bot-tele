// src/services/settings.js
// Bot settings management with persistence

import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

const SETTINGS_FILE = path.join(process.cwd(), 'data', 'settings.json');

// Default settings
const DEFAULT_SETTINGS = {
  store: {
    name: 'PBS Store',
    description: 'Premium Broadcasting Service',
    currency: 'IDR',
    timezone: 'Asia/Jakarta',
    supportContact: null
  },
  payment: {
    methods: ['qris', 'bank_transfer', 'ewallet'],
    autoConfirm: false,
    expiryMinutes: 60
  },
  notifications: {
    lowStockThreshold: 5,
    lowStockAlerts: true,
    paymentAlerts: true,
    orderAlerts: true
  },
  messages: {
    welcome: null, // Custom welcome message
    orderConfirmed: null,
    paymentReceived: null,
    outOfStock: null
  },
  features: {
    enableSearch: true,
    enableFavorites: true,
    enableHistory: true,
    enableCategories: true,
    enableRatings: false
  },
  limits: {
    maxSearchResults: 10,
    maxHistoryItems: 20,
    maxFavorites: 50
  },
  maintenance: {
    enabled: false,
    message: 'Bot sedang dalam maintenance. Silakan coba lagi nanti.'
  }
};

class SettingsManager {
  constructor() {
    this.settings = { ...DEFAULT_SETTINGS };
    this.loadFromFile();
  }

  /**
   * Load settings from file
   */
  loadFromFile() {
    try {
      if (fs.existsSync(SETTINGS_FILE)) {
        const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
        const loaded = JSON.parse(data);
        this.settings = this._mergeSettings(DEFAULT_SETTINGS, loaded);
        logger.info('Settings loaded from file');
      } else {
        logger.info('Settings file not found, using defaults');
        this.saveToFile(); // Create default settings file
      }
    } catch (error) {
      logger.error(`Failed to load settings: ${error.message}`);
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  /**
   * Save settings to file
   */
  saveToFile() {
    try {
      const dir = path.dirname(SETTINGS_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(
        SETTINGS_FILE, 
        JSON.stringify(this.settings, null, 2),
        'utf8'
      );
      
      logger.info('Settings saved to file');
      return true;
    } catch (error) {
      logger.error(`Failed to save settings: ${error.message}`);
      return false;
    }
  }

  /**
   * Merge settings (deep merge)
   */
  _mergeSettings(defaults, loaded) {
    const merged = { ...defaults };
    
    for (const [key, value] of Object.entries(loaded)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        merged[key] = this._mergeSettings(defaults[key] || {}, value);
      } else {
        merged[key] = value;
      }
    }
    
    return merged;
  }

  /**
   * Get all settings
   */
  getAll() {
    return { ...this.settings };
  }

  /**
   * Get setting by path (e.g., 'store.name')
   */
  get(path) {
    const keys = path.split('.');
    let value = this.settings;
    
    for (const key of keys) {
      if (value === undefined || value === null) return null;
      value = value[key];
    }
    
    return value;
  }

  /**
   * Set setting by path
   */
  set(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    let obj = this.settings;
    
    for (const key of keys) {
      if (!(key in obj)) {
        obj[key] = {};
      }
      obj = obj[key];
    }
    
    obj[lastKey] = value;
    return this.saveToFile();
  }

  /**
   * Update multiple settings
   */
  update(updates) {
    for (const [path, value] of Object.entries(updates)) {
      this.set(path, value);
    }
    return this.saveToFile();
  }

  /**
   * Reset to defaults
   */
  reset() {
    this.settings = { ...DEFAULT_SETTINGS };
    return this.saveToFile();
  }

  /**
   * Export settings
   */
  export() {
    return {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      settings: this.settings
    };
  }

  /**
   * Import settings
   */
  import(data) {
    try {
      if (data.version && data.settings) {
        this.settings = this._mergeSettings(DEFAULT_SETTINGS, data.settings);
        this.saveToFile();
        logger.info('Settings imported successfully');
        return true;
      }
      throw new Error('Invalid settings format');
    } catch (error) {
      logger.error(`Failed to import settings: ${error.message}`);
      return false;
    }
  }

  /**
   * Get formatted settings for display
   */
  getFormattedSettings() {
    const lines = [];
    
    lines.push('⚙️ <b>Bot Settings</b>\n');
    
    lines.push('<b>🏪 Store</b>');
    lines.push(`• Name: ${this.settings.store.name}`);
    lines.push(`• Currency: ${this.settings.store.currency}`);
    lines.push(`• Timezone: ${this.settings.store.timezone}`);
    
    lines.push('\n<b>💳 Payment</b>');
    lines.push(`• Methods: ${this.settings.payment.methods.join(', ')}`);
    lines.push(`• Auto Confirm: ${this.settings.payment.autoConfirm ? 'Yes' : 'No'}`);
    lines.push(`• Expiry: ${this.settings.payment.expiryMinutes} minutes`);
    
    lines.push('\n<b>🔔 Notifications</b>');
    lines.push(`• Low Stock Threshold: ${this.settings.notifications.lowStockThreshold}`);
    lines.push(`• Low Stock Alerts: ${this.settings.notifications.lowStockAlerts ? 'On' : 'Off'}`);
    lines.push(`• Payment Alerts: ${this.settings.notifications.paymentAlerts ? 'On' : 'Off'}`);
    
    lines.push('\n<b>✨ Features</b>');
    lines.push(`• Search: ${this.settings.features.enableSearch ? 'On' : 'Off'}`);
    lines.push(`• Favorites: ${this.settings.features.enableFavorites ? 'On' : 'Off'}`);
    lines.push(`• History: ${this.settings.features.enableHistory ? 'On' : 'Off'}`);
    lines.push(`• Categories: ${this.settings.features.enableCategories ? 'On' : 'Off'}`);
    
    lines.push('\n<b>🔧 Maintenance</b>');
    lines.push(`• Status: ${this.settings.maintenance.enabled ? '⚠️ Enabled' : '✅ Disabled'}`);
    
    return lines.join('\n');
  }
}

// Create singleton instance
export const settings = new SettingsManager();

export default SettingsManager;

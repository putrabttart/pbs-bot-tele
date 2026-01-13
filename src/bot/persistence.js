// src/bot/persistence.js
// User data persistence

import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import {
  USER_SESSIONS,
  USER_FAVORITES,
  PURCHASE_HISTORY,
  ANALYTICS
} from './state.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'bot-state.json');

/**
 * Save state to file
 */
export async function saveState() {
  try {
    // Ensure directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const state = {
      version: '2.0',
      savedAt: new Date().toISOString(),
      users: Array.from(USER_SESSIONS.entries()),
      favorites: Array.from(USER_FAVORITES.entries()).map(([userId, set]) => [
        userId,
        Array.from(set)
      ]),
      history: Array.from(PURCHASE_HISTORY.entries()),
      analytics: {
        totalOrders: ANALYTICS.totalOrders,
        totalRevenue: ANALYTICS.totalRevenue,
        productViews: Array.from(ANALYTICS.productViews.entries()),
        searchQueries: Array.from(ANALYTICS.searchQueries.entries()),
        dailyStats: Array.from(ANALYTICS.dailyStats.entries()),
        userActivity: Array.from(ANALYTICS.userActivity.entries())
      }
    };

    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    logger.info(`State saved: ${USER_SESSIONS.size} users`);
    return true;
  } catch (error) {
    logger.error(`Failed to save state: ${error.message}`);
    return false;
  }
}

/**
 * Load state from file
 */
export async function loadState() {
  try {
    if (!fs.existsSync(STATE_FILE)) {
      logger.info('No saved state found, starting fresh');
      return;
    }

    const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));

    // Restore user sessions
    USER_SESSIONS.clear();
    for (const [userId, session] of data.users || []) {
      USER_SESSIONS.set(userId, session);
    }

    // Restore favorites
    USER_FAVORITES.clear();
    for (const [userId, favorites] of data.favorites || []) {
      USER_FAVORITES.set(userId, new Set(favorites));
    }

    // Restore history
    PURCHASE_HISTORY.clear();
    for (const [userId, history] of data.history || []) {
      PURCHASE_HISTORY.set(userId, history);
    }

    // Restore analytics
    if (data.analytics) {
      ANALYTICS.totalOrders = data.analytics.totalOrders || 0;
      ANALYTICS.totalRevenue = data.analytics.totalRevenue || 0;
      
      ANALYTICS.productViews.clear();
      for (const [code, count] of data.analytics.productViews || []) {
        ANALYTICS.productViews.set(code, count);
      }
      
      ANALYTICS.searchQueries.clear();
      for (const [query, count] of data.analytics.searchQueries || []) {
        ANALYTICS.searchQueries.set(query, count);
      }
      
      ANALYTICS.dailyStats.clear();
      for (const [date, stats] of data.analytics.dailyStats || []) {
        ANALYTICS.dailyStats.set(date, stats);
      }
      
      ANALYTICS.userActivity.clear();
      for (const [userId, lastActivity] of data.analytics.userActivity || []) {
        ANALYTICS.userActivity.set(userId, lastActivity);
      }
    }

    logger.info(`State loaded: ${USER_SESSIONS.size} users, ${PURCHASE_HISTORY.size} histories`);
  } catch (error) {
    logger.error(`Failed to load state: ${error.message}`);
  }
}

/**
 * Auto-save state periodically
 */
export function startAutoSave(intervalMinutes = 5) {
  setInterval(() => {
    saveState();
  }, intervalMinutes * 60 * 1000);
  
  logger.info(`Auto-save enabled: every ${intervalMinutes} minutes`);
}

/**
 * Save state on process exit
 */
export function setupExitHandler() {
  process.on('SIGINT', async () => {
    logger.info('Saving state before exit...');
    await saveState();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Saving state before exit...');
    await saveState();
    process.exit(0);
  });
}

export default {
  saveState,
  loadState,
  startAutoSave,
  setupExitHandler
};

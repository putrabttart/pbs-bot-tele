// src/services/scheduler.js
// Scheduled tasks for product refresh and low-stock alerts

import { logger } from '../utils/logger.js';
import { metrics, MetricNames } from '../utils/metrics.js';

class Scheduler {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
  }

  /**
   * Start scheduler
   */
  start() {
    if (this.isRunning) {
      logger.warn('Scheduler already running');
      return;
    }

    this.isRunning = true;
    logger.info('Scheduler started');
  }

  /**
   * Stop scheduler
   */
  stop() {
    if (!this.isRunning) return;

    // Clear all jobs
    for (const [name, job] of this.jobs.entries()) {
      if (job.timer) {
        clearInterval(job.timer);
      }
      logger.info(`Stopped job: ${name}`);
    }

    this.jobs.clear();
    this.isRunning = false;
    logger.info('Scheduler stopped');
  }

  /**
   * Add a recurring job
   * @param {string} name - Job name
   * @param {Function} handler - Job handler function
   * @param {number} interval - Interval in milliseconds
   * @param {Object} options - Job options
   */
  addJob(name, handler, interval, options = {}) {
    if (this.jobs.has(name)) {
      this.removeJob(name);
    }

    const job = {
      name,
      handler,
      interval,
      options,
      timer: null,
      lastRun: null,
      nextRun: null,
      runCount: 0,
      errorCount: 0
    };

    // Wrap handler with error handling and metrics
    const wrappedHandler = async () => {
      if (!this.isRunning) return;

      const startTime = Date.now();

      try {
        await handler();
        job.runCount++;
        job.lastRun = new Date();
        job.nextRun = new Date(Date.now() + interval);
        
        const duration = Date.now() - startTime;
        
        metrics.incCounter('scheduler_jobs_completed_total', { job: name });
        metrics.observe('scheduler_job_duration_ms', { job: name }, duration);
      } catch (error) {
        job.errorCount++;
        logger.error(`Job ${name} failed: ${error.message}`, { 
          job: name, 
          error: error.stack 
        });
        
        metrics.incCounter('scheduler_jobs_failed_total', { job: name });
      }
    };

    // Run immediately if specified
    if (options.runImmediately) {
      wrappedHandler();
    }

    // Schedule recurring execution
    job.timer = setInterval(wrappedHandler, interval);
    job.nextRun = new Date(Date.now() + interval);

    this.jobs.set(name, job);

    return job;
  }

  /**
   * Remove a job
   */
  removeJob(name) {
    const job = this.jobs.get(name);
    if (!job) return false;

    if (job.timer) {
      clearInterval(job.timer);
    }

    this.jobs.delete(name);
    return true;
  }

  /**
   * Get job status
   */
  getJob(name) {
    return this.jobs.get(name);
  }

  /**
   * Get all jobs status
   */
  getAllJobs() {
    return Array.from(this.jobs.values()).map(job => ({
      name: job.name,
      interval: job.interval,
      lastRun: job.lastRun,
      nextRun: job.nextRun,
      runCount: job.runCount,
      errorCount: job.errorCount
    }));
  }
}

// Create default scheduler instance
export const scheduler = new Scheduler();

/**
 * Setup product refresh job
 */
export async function setupProductRefreshJob(intervalMinutes = 30) {
  const { loadProducts } = await import('../data/products.js');
  
  scheduler.addJob(
    'product-refresh',
    async () => {
      logger.info('Running product refresh job');
      await loadProducts(true); // Force refresh
      logger.info('Product refresh completed');
    },
    intervalMinutes * 60 * 1000, // Convert to ms
    { runImmediately: false } // Don't run immediately, initial load is done on startup
  );

  logger.info(`Product refresh job scheduled every ${intervalMinutes} minutes`);
}

/**
 * Setup low-stock alert job
 */
export async function setupLowStockAlertJob(bot, options = {}) {
  const {
    intervalMinutes = 60,
    threshold = 5,
    adminIds = []
  } = options;

  const { getAll } = await import('../data/products.js');

  scheduler.addJob(
    'low-stock-alert',
    async () => {
      const products = getAll();
      const lowStockProducts = products.filter(p => {
        const stock = parseInt(p.stock || 0);
        return stock > 0 && stock <= threshold;
      });

      if (lowStockProducts.length === 0) return;

      const message = [
        '⚠️ *Low Stock Alert*\n',
        `Ditemukan ${lowStockProducts.length} produk dengan stok rendah:\n`
      ];

      for (const product of lowStockProducts) {
        message.push(`• ${product.name} - Stok: ${product.stock}`);
      }

      message.push(`\n_Threshold: ${threshold} unit_`);

      const messageText = message.join('\n');

      for (const adminId of adminIds) {
        try {
          await bot.telegram.sendMessage(adminId, messageText, { 
            parse_mode: 'Markdown' 
          });
        } catch (error) {
          logger.error(`Failed to send alert to admin ${adminId}: ${error.message}`);
        }
      }

      metrics.incCounter('low_stock_alerts_sent_total', { 
        count: lowStockProducts.length 
      });
    },
    intervalMinutes * 60 * 1000,
    { runImmediately: false }
  );
}

/**
 * Setup cleanup job for old data
 */
export async function setupCleanupJob(intervalHours = 24) {
  const { getState } = await import('../bot/state.js');

  scheduler.addJob(
    'cleanup-old-data',
    async () => {
      const state = getState();
      const now = Date.now();
      const oneDayAgo = now - (24 * 60 * 60 * 1000);
      
      let cleanedCount = 0;
      for (const [userId, userData] of state.users.entries()) {
        if (userData.lastSearch && userData.lastSearch < oneDayAgo) {
          delete userData.searchResults;
          delete userData.lastSearch;
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        logger.info(`Cleanup: removed ${cleanedCount} old search results`);
      }
      metrics.incCounter('cleanup_jobs_completed_total', { type: 'search_results' });
    },
    intervalHours * 60 * 60 * 1000,
    { runImmediately: false }
  );
}

/**
 * Setup metrics update job
 */
export async function setupMetricsUpdateJob(intervalSeconds = 60) {
  const { messageLimiter } = await import('../utils/rateLimiter.js');

  scheduler.addJob(
    'metrics-update',
    () => {
      const activeUsers = messageLimiter.getActiveUsers();
      metrics.setGauge(MetricNames.ACTIVE_USERS, {}, activeUsers);
    },
    intervalSeconds * 1000,
    { runImmediately: true }
  );
}

export default Scheduler;

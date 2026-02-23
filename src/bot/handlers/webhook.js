// src/bot/handlers/webhook.js
import crypto from 'crypto';

import { handlePaymentSuccess } from './purchase.js';
import { BOT_CONFIG } from '../config.js';
import { loadProducts } from '../../data/products.js';
import { releaseStock } from '../../database/stock.js';
import { ACTIVE_ORDERS } from '../state.js';
import { logger } from '../../utils/logger.js';
import { metrics, MetricNames } from '../../utils/metrics.js';

/**
 * In-memory idempotency guard (simple)
 * - Midtrans bisa retry webhook beberapa kali.
 * - Ini mencegah double "handlePaymentSuccess" untuk orderId yang sama.
 * - Karena memory bisa reset saat redeploy, idealnya juga dibuat idempotent di DB,
 *   tapi ini cukup untuk perbaikan cepat.
 */
const PROCESSED_SUCCESS_ORDERS = new Set();

/**
 * Generate Midtrans signature (SHA512)
 * signature_key = SHA512(order_id + status_code + gross_amount + SERVER_KEY)
 */
function generateMidtransSignature({ orderId, statusCode, grossAmount, serverKey }) {
  const raw = `${orderId}${statusCode}${grossAmount}${serverKey}`;
  return crypto.createHash('sha512').update(raw).digest('hex');
}

/**
 * Handle Midtrans webhook notifications
 */
export async function handleMidtransWebhook(req, res, telegram) {
  const endTimer = metrics.startTimer(MetricNames.WEBHOOK_DURATION, { type: 'midtrans' });

  try {
    const body = req.body || {};
    const correlationId = req.correlationId || 'webhook';

    metrics.incCounter(MetricNames.WEBHOOK_RECEIVED, { type: 'midtrans' });

    const orderId = String(body.order_id || '').trim();
    const transactionStatus = String(body.transaction_status || '').toLowerCase();

    // Midtrans sends these in body (HTTP Notification)
    const statusCode = String(body.status_code || '').trim();
    const grossAmount = String(body.gross_amount || '').trim();
    const signatureKey = String(body.signature_key || '').trim();

    if (!orderId) {
      metrics.incCounter(MetricNames.WEBHOOK_ERRORS, { type: 'midtrans', error: 'missing_order_id' });
      endTimer();
      return res.status(400).json({ error: 'Missing order_id' });
    }

    // ---- SIGNATURE VERIFICATION (FIXED) ----
    const serverKey = process.env.MIDTRANS_SERVER_KEY || '';

    if (!serverKey) {
      logger.error('[WEBHOOK] MIDTRANS_SERVER_KEY not set', { correlationId, orderId });
      metrics.incCounter(MetricNames.WEBHOOK_ERRORS, { type: 'midtrans', error: 'missing_server_key' });
      endTimer();
      return res.status(500).json({ error: 'Server misconfigured' });
    }

    if (!signatureKey || !statusCode || !grossAmount) {
      logger.warn('[WEBHOOK] Missing signature fields', {
        correlationId,
        orderId,
        hasSignatureKey: Boolean(signatureKey),
        hasStatusCode: Boolean(statusCode),
        hasGrossAmount: Boolean(grossAmount),
      });
      metrics.incCounter(MetricNames.WEBHOOK_ERRORS, { type: 'midtrans', error: 'missing_signature_fields' });
      endTimer();
      return res.status(401).json({ error: 'Missing signature fields' });
    }

    const calculated = generateMidtransSignature({
      orderId,
      statusCode,
      grossAmount,
      serverKey,
    });

    if (calculated !== signatureKey) {
      logger.warn('[WEBHOOK] Invalid signature', {
        correlationId,
        orderId,
        statusCode,
        grossAmount,
        calculatedPrefix: calculated.slice(0, 12),
        receivedPrefix: signatureKey.slice(0, 12),
      });
      metrics.incCounter(MetricNames.WEBHOOK_ERRORS, { type: 'midtrans', error: 'invalid_signature' });
      endTimer();
      return res.status(401).json({ error: 'Invalid signature' });
    }
    // ---- END SIGNATURE VERIFICATION ----

    logger.info('[WEBHOOK] Midtrans notification', {
      correlationId,
      orderId,
      transactionStatus,
      grossAmount,
      statusCode,
    });

    // ---- SUCCESS: settlement/capture ----
    if (transactionStatus === 'settlement' || transactionStatus === 'capture') {
      // Idempotency guard (memory)
      if (PROCESSED_SUCCESS_ORDERS.has(orderId)) {
        logger.info('[WEBHOOK] Duplicate success ignored (already processed)', { correlationId, orderId });
        endTimer();
        return res.json({ success: true, message: 'Already processed' });
      }

      // Optional: also mark on ACTIVE_ORDERS object if exists
      const cached = ACTIVE_ORDERS.get(orderId);
      if (cached && cached.__paidProcessed) {
        logger.info('[WEBHOOK] Duplicate success ignored (cache flag)', { correlationId, orderId });
        PROCESSED_SUCCESS_ORDERS.add(orderId);
        endTimer();
        return res.json({ success: true, message: 'Already processed' });
      }

      logger.info(`[WEBHOOK] ✅ Payment SUCCESS untuk ${orderId}, calling handlePaymentSuccess`);

      // Mark BEFORE processing to prevent parallel retries double-send
      PROCESSED_SUCCESS_ORDERS.add(orderId);
      // NOTE: Don't set cached.__paidProcessed here, let handlePaymentSuccess do it internally

      try {
        await handlePaymentSuccess(telegram, orderId, body);
      } catch (err) {
        // If processing fails, remove from processed so it can be retried safely
        PROCESSED_SUCCESS_ORDERS.delete(orderId);

        logger.error('[WEBHOOK] handlePaymentSuccess failed', {
          correlationId,
          orderId,
          error: err?.message,
          stack: err?.stack,
        });
        metrics.incCounter(MetricNames.WEBHOOK_ERRORS, { type: 'midtrans', error: 'payment_success_handler_failed' });
        endTimer();
        return res.status(500).json({ error: 'Failed to process payment success' });
      }

      // === Forward payload to web store webhook ===
      const WEBHOOK_WEB_URL = process.env.WEBHOOK_WEB_URL || 'https://your-web-domain.com/api/webhook';
      try {
        const forwardRes = await fetch(WEBHOOK_WEB_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        logger.info('[WEBHOOK] Forwarded to web store webhook', { url: WEBHOOK_WEB_URL, status: forwardRes.status });
      } catch (err) {
        logger.error('[WEBHOOK] Failed to forward to web store webhook', { error: err?.message });
      }

      endTimer();
      return res.json({ success: true, message: 'Payment processed' });
    }

    // ---- FAILED/CANCELLED/EXPIRED ----
    if (['expire', 'cancel', 'deny'].includes(transactionStatus)) {
      const order = ACTIVE_ORDERS.get(orderId);

      // Release stock regardless (biar nggak nyangkut walau cache hilang / bot restart)
      try {
        await releaseStock({ order_id: orderId, reason: transactionStatus });
      } catch (e) {
        logger.warn('[WEBHOOK] releaseStock failed', { correlationId, orderId, error: e?.message });
      }

      if (order) {
        // Delete QR message
        if (order.qrMessageId) {
          try {
            await telegram.deleteMessage(order.chatId, order.qrMessageId);
          } catch {}
        }

        // Notify user
        try {
          await telegram.sendMessage(
            order.chatId,
            `❌ Pembayaran untuk Order #${orderId} ${transactionStatus}.\n\n` +
              `Silakan buat pesanan baru jika masih ingin membeli.`
          );
        } catch (e) {
          logger.warn('[WEBHOOK] Failed to notify user', { correlationId, orderId, error: e?.message });
        }

        ACTIVE_ORDERS.delete(orderId);
      }

      endTimer();
      return res.json({ success: true, message: 'Payment cancelled' });
    }

    // ---- pending/other statuses ----
    endTimer();
    return res.json({ success: true, message: 'Status received' });
  } catch (error) {
    logger.error('[WEBHOOK ERROR]', { error: error.message, stack: error.stack });
    metrics.incCounter(MetricNames.WEBHOOK_ERRORS, { type: 'midtrans', error: 'exception' });
    endTimer();
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Handle product refresh webhook (from Google Apps Script)
 */
export async function handleRefreshWebhook(req, res) {
  try {
    const secret = req.get('x-refresh-key') || req.query.key || req.body?.secret;

    if (secret !== BOT_CONFIG.WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('[REFRESH WEBHOOK] Triggered');

    await loadProducts(true);

    const { getAll } = await import('../../data/products.js');
    const products = getAll();

    return res.json({
      success: true,
      products: products.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[REFRESH WEBHOOK ERROR]', error);
    return res.status(500).json({ error: 'Failed to refresh products' });
  }
}

/**
 * Handle low stock alert webhook (from Google Apps Script)
 */
export async function handleLowStockWebhook(req, res, telegram) {
  try {
    const body = req.body || {};

    if (body.secret !== BOT_CONFIG.WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const items = Array.isArray(body.items) ? body.items : [];

    console.log('[LOW STOCK ALERT]', items);

    // Send alerts to admins
    if (items.length > 0 && BOT_CONFIG.TELEGRAM_ADMIN_IDS.length > 0) {
      const alertText = [
        '⚠️ *LOW STOCK ALERT*',
        '',
        'Produk berikut stoknya menipis:',
        '',
        ...items.map(item => `• ${item.kode}: ${item.ready} tersisa`),
        '',
        '💡 Segera isi ulang stok!',
      ].join('\n');

      for (const adminId of BOT_CONFIG.TELEGRAM_ADMIN_IDS) {
        try {
          await telegram.sendMessage(adminId, alertText, { parse_mode: 'Markdown' });
        } catch (error) {
          console.error(`[LOW STOCK] Failed to send to admin ${adminId}:`, error.message);
        }
      }
    }

    return res.json({ success: true, alerted: items.length });
  } catch (error) {
    console.error('[LOW STOCK WEBHOOK ERROR]', error);
    return res.status(500).json({ error: 'Failed to process alert' });
  }
}

/**
 * Status endpoint (enhanced)
 */
export async function handleStatusEndpoint(req, res) {
  try {
    const { getAll } = await import('../../data/products.js');
    const products = getAll();
    const { scheduler } = await import('../../services/scheduler.js');
    const { settings } = await import('../../services/settings.js');
    const { metrics } = await import('../../utils/metrics.js');

    // Get last product load time
    let lastProductLoad = null;
    try {
      const productsFile = require('path').join(process.cwd(), 'data', 'products.json');
      const stats = require('fs').statSync(productsFile);
      lastProductLoad = stats.mtime;
    } catch {}

    // Get scheduler jobs status
    const jobs = scheduler.getAllJobs();

    // Get metrics summary
    const metricsSummary = metrics.getSummary();

    // Get bot version and commit
    const version = process.env.npm_package_version || '2.0.0';
    const commit = process.env.GIT_COMMIT || 'unknown';

    return res.json({
      status: 'online',
      uptime: process.uptime(),
      version,
      commit,
      timestamp: new Date().toISOString(),
      bot: {
        connected: true,
        admins: BOT_CONFIG.TELEGRAM_ADMIN_IDS.length,
      },
      data: {
        products: products.length,
        activeOrders: ACTIVE_ORDERS.size,
        lastProductLoad,
      },
      scheduler: {
        running: scheduler.isRunning,
        jobs: jobs.map(j => ({
          name: j.name,
          lastRun: j.lastRun,
          nextRun: j.nextRun,
          runCount: j.runCount,
          errorCount: j.errorCount,
        })),
      },
      settings: {
        maintenance: settings.get('maintenance.enabled'),
      },
      metrics: metricsSummary,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    });
  } catch (error) {
    logger.error(`Status endpoint error: ${error.message}`);
    return res.status(500).json({ error: 'Failed to get status' });
  }
}

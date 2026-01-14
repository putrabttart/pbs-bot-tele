// src/bot/handlers/webhook.js
import { handlePaymentSuccess } from './purchase.js';
import { BOT_CONFIG } from '../foramtters.js';
import { verifyMidtransSignature } from '../../payments/midtrans.js';
import { loadProducts } from '../../data/products.js';
import { finalizeStock, releaseStock } from '../../database/stock.js';
import { ACTIVE_ORDERS } from '../state.js';
import { logger } from '../../utils/logger.js';
import { metrics, MetricNames } from '../../utils/metrics.js';

/**
 * Handle Midtrans webhook notifications
 */
export async function handleMidtransWebhook(req, res, telegram) {
  const endTimer = metrics.startTimer(MetricNames.WEBHOOK_DURATION, { type: 'midtrans' });
  
  try {
    const body = req.body || {};
    const correlationId = req.correlationId || 'webhook';
    
    metrics.incCounter(MetricNames.WEBHOOK_RECEIVED, { type: 'midtrans' });
    
    // Verify signature - Midtrans sends in X-Signature header
    const signature = req.get('x-signature');
    
    if (!signature) {
      logger.warn('[WEBHOOK] Missing X-Signature header', { correlationId, orderId: body.order_id });
      metrics.incCounter(MetricNames.WEBHOOK_ERRORS, { type: 'midtrans', error: 'missing_signature' });
      return res.status(401).json({ error: 'Missing X-Signature header' });
    }
    
    if (!verifyMidtransSignature({
      order_id: body.order_id,
      status_code: body.status_code,
      gross_amount: body.gross_amount,
      server_key: signature,
    })) {
      logger.warn('[WEBHOOK] Invalid signature', { 
        correlationId, 
        orderId: body.order_id 
      });
      metrics.incCounter(MetricNames.WEBHOOK_ERRORS, { type: 'midtrans', error: 'invalid_signature' });
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    const orderId = String(body.order_id || '');
    const transactionStatus = (body.transaction_status || '').toLowerCase();
    const grossAmount = Number(body.gross_amount || 0);
    
    logger.info('[WEBHOOK] Midtrans notification', {
      correlationId,
      orderId,
      transactionStatus,
      grossAmount
    });
    
    if (!orderId) {
      metrics.incCounter(MetricNames.WEBHOOK_ERRORS, { type: 'midtrans', error: 'missing_order_id' });
      return res.status(400).json({ error: 'Missing order_id' });
    }
    
    // Handle different transaction statuses
    if (transactionStatus === 'settlement' || transactionStatus === 'capture') {
      logger.info(`[WEBHOOK] ✅ Payment SUCCESS untuk ${orderId}, calling handlePaymentSuccess`);
      await handlePaymentSuccess(telegram, orderId, body);
      endTimer();
      return res.json({ success: true, message: 'Payment processed' });
    }
    
    if (['expire', 'cancel', 'deny'].includes(transactionStatus)) {
      const order = ACTIVE_ORDERS.get(orderId);
      
      if (order) {
        // Delete QR message
        if (order.qrMessageId) {
          try {
            await telegram.deleteMessage(order.chatId, order.qrMessageId);
          } catch {}
        }
        
        // Release stock
        await releaseStock({ order_id: orderId, reason: transactionStatus });
        
        // Notify user
        await telegram.sendMessage(
          order.chatId,
          `❌ Pembayaran untuk Order #${orderId} ${transactionStatus}.\n\n` +
          `Silakan buat pesanan baru jika masih ingin membeli.`
        );
        
        ACTIVE_ORDERS.delete(orderId);
      }
      
      endTimer();
      return res.json({ success: true, message: 'Payment cancelled' });
    }
    
    // For pending or other statuses, just acknowledge
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
        admins: BOT_CONFIG.TELEGRAM_ADMIN_IDS.length
      },
      data: {
        products: products.length,
        activeOrders: ACTIVE_ORDERS.size,
        lastProductLoad
      },
      scheduler: {
        running: scheduler.isRunning,
        jobs: jobs.map(j => ({
          name: j.name,
          lastRun: j.lastRun,
          nextRun: j.nextRun,
          runCount: j.runCount,
          errorCount: j.errorCount
        }))
      },
      settings: {
        maintenance: settings.get('maintenance.enabled')
      },
      metrics: metricsSummary,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      }
    });
  } catch (error) {
    logger.error(`Status endpoint error: ${error.message}`);
    return res.status(500).json({ error: 'Failed to get status' });
  }
}

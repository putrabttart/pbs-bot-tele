// src/bot/handlers/purchase.js
import QRCode from 'qrcode';
import { BOT_CONFIG } from '../config.js';
import { ACTIVE_ORDERS, recordOrder, getUserSession } from '../state.js';

// Map untuk menyimpan timer polling per orderId
const ACTIVE_POLLING_TIMERS = new Map();
import { formatProductDetail, formatPendingPayment, formatOrderReceipt, formatCurrency, formatDateTime, formatPaymentSuccess, formatDigitalItems, formatProductNotes, formatThankYou } from '../formatters.js';
import { productDetailKeyboard, orderStatusKeyboard } from '../keyboards.js';
import { byKode, getAll as getAllProducts } from '../../data/products.js';
import { reserveStock, finalizeStock, releaseStock } from '../../database/stock.js';
import { upsertUser } from '../../database/users.js';
import { createOrder, createOrderItems, updateOrderStatus, markItemsAsSent } from '../../database/orders.js';
import { createMidtransQRISCharge, midtransStatus } from '../../payments/midtrans.js';

/**
 * Handle purchase flow
 */
export async function handlePurchase(ctx, productCode, quantity = 1) {
  const userId = ctx.from.id;
  const userRef = `tg:${userId}`;
  
  // Find product
  const product = byKode(productCode);
  if (!product) {
    return ctx.reply(
      `❌ Produk dengan kode *${productCode}* tidak ditemukan.\n\n` +
      `Gunakan /search atau /menu untuk mencari produk.`,
      { parse_mode: 'Markdown' }
    );
  }
  
  // Validate quantity
  if (quantity < 1 || quantity > 999) {
    return ctx.reply('❌ Jumlah harus antara 1 - 999');
  }
  
  // Check stock if available
  if (product.stok !== null && product.stok !== undefined && product.stok !== '') {
    const availableStock = Number(product.stok);
    if (availableStock < quantity) {
      return ctx.reply(
        `❌ Stok tidak cukup!\n\n` +
        `Stok tersedia: ${availableStock}\n` +
        `Anda minta: ${quantity}`,
        { parse_mode: 'Markdown' }
      );
    }
  }
  
  // Show processing message
  const processingMsg = await ctx.reply('⏳ Memproses pesanan Anda...');
  
  try {
    // Generate unique order ID (PBS-XXXXXXXX)
    const timestamp = Date.now();
    const hash = (timestamp + userId).toString(36).toUpperCase().slice(-8);
    const orderId = `PBS-${hash}`;
    
    // Step 1: Reserve stock
    const reserveResult = await reserveStock({
      order_id: orderId,
      kode: productCode,
      qty: quantity,
      userRef,
    });
    
    if (!reserveResult?.ok) {
      await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
      
      const errorMsg = reserveResult?.msg === 'insufficient_stock' && reserveResult?.available !== undefined
        ? `❌ Stok tidak cukup!\n\nStok tersedia: ${reserveResult.available}\nAnda minta: ${quantity}`
        : `❌ Gagal memesan produk: ${reserveResult?.msg || 'Stok tidak tersedia'}\n\nSilakan coba lagi atau hubungi admin.`;
      
      return ctx.reply(errorMsg);
    }
    
    const unitPrice = Number(product.harga) || 0;
    const totalAmount = unitPrice * quantity;
    
    // Step 2: Create Midtrans QRIS charge
    const chargeResult = await createMidtransQRISCharge({
      order_id: orderId,
      gross_amount: totalAmount,
      product_name: product.nama,
      customer_name: ctx.from.first_name || 'Customer',
    });
    
    if (!chargeResult?.qr_string && !chargeResult?.qr_url) {
      // Release stock if payment creation fails
      await releaseStock({ order_id: orderId, reason: 'payment_creation_failed' });
      await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
      return ctx.reply('❌ Gagal membuat pembayaran. Silakan coba lagi.');
    }
    
    // Delete processing message
    await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);

    // Persist user and order in Supabase
    try {
      await upsertUser({
        user_id: String(userId),
        username: ctx.from.username,
        first_name: ctx.from.first_name,
        last_name: ctx.from.last_name,
        language: ctx.from.language_code || 'id',
      });

      await createOrder({
        order_id: orderId,
        user_id: userId,  // Keep as number (BIGINT)
        total_amount: totalAmount,
        payment_url: chargeResult.payment_url || chargeResult.qr_url || null,
        transaction_id: chargeResult.transaction_id,
        payment_provider: 'midtrans',
        midtrans_token: chargeResult.token || null,
        user_ref: userRef,
        expired_at: new Date(chargeResult.expired_at || Date.now() + BOT_CONFIG.PAYMENT_TTL_MS).toISOString(),
      });
    } catch (persistErr) {
      console.warn('[ORDER PERSIST WARN] Could not persist order/user:', persistErr?.message);
    }
    
    // Step 3: Generate and send QR code
    const caption = `
🛒 *ORDER PEMBAYARAN*

📝 Order ID: \`${orderId}\`
� Produk: ${product.nama}
📦 Jumlah: ${quantity}
💰 Total: Rp ${totalAmount.toLocaleString('id-ID')}

⏱️ QR Code valid 15 menit
💳 Scan QRIS untuk melakukan pembayaran!
${chargeResult.payment_url ? `\n🔗 Link Payment: ${chargeResult.payment_url}` : ''}
`.trim();
    
    let qrMessage;
    if (chargeResult.qr_string) {
      const qrBuffer = await QRCode.toBuffer(chargeResult.qr_string);
      
      // Build keyboard buttons
      const buttons = [];
      if (chargeResult.payment_url) {
        buttons.push([{ text: '🔗 Open Payment Link', url: chargeResult.payment_url }]);
      }
      buttons.push([{ text: '🔄 Check Status', callback_data: `check_payment:${orderId}` }]);
      
      qrMessage = await ctx.replyWithPhoto(
        { source: qrBuffer },
        {
          caption,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: buttons,
          },
        }
      );
    } else {
      // Build keyboard buttons
      const buttons = [];
      if (chargeResult.payment_url) {
        buttons.push([{ text: '🔗 Open Payment Link', url: chargeResult.payment_url }]);
      }
      buttons.push([{ text: '🔄 Check Status', callback_data: `check_payment:${orderId}` }]);
      
      qrMessage = await ctx.reply(caption + `\n\n🔗 ${chargeResult.payment_url || 'N/A'}`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: buttons,
        },
      });
    }
    
    // Store order in memory
    ACTIVE_ORDERS.set(orderId, {
      orderId,
      userId,
      chatId: ctx.chat.id,
      productCode,
      productName: product.nama,
      quantity,
      unitPrice,
      total: totalAmount,
      status: 'pending',
      qrMessageId: qrMessage.message_id,
      processingMessageId: processingMsg.message_id,
      createdAt: Date.now(),
      expiresAt: Date.now() + BOT_CONFIG.PAYMENT_TTL_MS,
    });
    
    // Start polling for payment status (fallback)
    // Mulai polling dan simpan timer id
    startPollingPaymentStatus(ctx.telegram, orderId, product);
    
  } catch (error) {
    console.error('[PURCHASE ERROR]', error);
    try {
      await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
    } catch {}
    
    await ctx.reply(
      '❌ Terjadi kesalahan saat memproses pesanan.\n\n' +
      'Silakan coba lagi atau hubungi admin jika masalah berlanjut.'
    );
  }
}

/**
 * Poll payment status (fallback if webhook fails)
 */

function startPollingPaymentStatus(telegram, orderId, product) {
  const maxAttempts = 20;
  const intervals = [5000, 10000, 15000, 30000]; // 5s, 10s, 15s, 30s intervals
  let attempts = 0;

  async function poll() {
    if (attempts >= maxAttempts) {
      clearPollingTimer(orderId);
      await handlePaymentTimeout(telegram, orderId);
      return;
    }

    const waitTime = intervals[Math.min(attempts, intervals.length - 1)];
    attempts++;
    try {
      const status = await midtransStatus(orderId);
      const transactionStatus = (status.transaction_status || '').toLowerCase();
      console.log(`[POLL] ${orderId} - Attempt ${attempts} - Status: ${transactionStatus}`);

      // Cek status order di database sebelum memproses sukses
      const { getOrder } = await import('../../database/orders.js');
      let orderDb = null;
      try {
        orderDb = await getOrder(orderId);
      } catch {}
      const isAlreadyCompleted = orderDb && ['completed', 'paid', 'settlement', 'capture', 'success'].includes((orderDb.status || '').toLowerCase());

      if ((transactionStatus === 'settlement' || transactionStatus === 'capture') && !isAlreadyCompleted) {
        clearPollingTimer(orderId);
        await handlePaymentSuccess(telegram, orderId, status);
        return;
      }

      if (['expire', 'cancel', 'deny'].includes(transactionStatus)) {
        clearPollingTimer(orderId);
        await handlePaymentFailed(telegram, orderId, transactionStatus);
        return;
      }

      // Schedule next poll
      ACTIVE_POLLING_TIMERS.set(orderId, setTimeout(poll, waitTime));
    } catch (error) {
      console.error(`[POLL ERROR] ${orderId}:`, error);
      // Schedule next poll even on error
      ACTIVE_POLLING_TIMERS.set(orderId, setTimeout(poll, waitTime));
    }
  }

  // Start polling
  ACTIVE_POLLING_TIMERS.set(orderId, setTimeout(poll, intervals[0]));
}

function clearPollingTimer(orderId) {
  const timer = ACTIVE_POLLING_TIMERS.get(orderId);
  if (timer) {
    clearTimeout(timer);
    ACTIVE_POLLING_TIMERS.delete(orderId);
  }
}

/**
 * Handle successful payment
 */
export async function handlePaymentSuccess(telegram, orderId, paymentData = null) {
  const order = ACTIVE_ORDERS.get(orderId);
  if (!order) {
    console.warn(`[PAYMENT SUCCESS] Order ${orderId} not found in memory`);
    return;
  }

  // 🛡️ IDEMPOTENCY GUARD: Cegah double processing dari webhook + polling
  if (order.__paidProcessed) {
    console.warn(`[PAYMENT SUCCESS] ⚠️ Order ${orderId} sudah diproses sebelumnya, skipping duplicate call`);
    return;
  }
  
  // Mark immediately to prevent concurrent calls
  order.__paidProcessed = true;
  console.log(`[PAYMENT SUCCESS] 🔒 Order ${orderId} marked as processing`);
  
  // Stop polling timer immediately
  clearPollingTimer(orderId);

  const escapeMarkdown = (text = '') => text.replace(/([_*`])/g, '\\$1');
  
  try {
    console.log(`[PAYMENT SUCCESS] ✅ Processing payment untuk ${orderId}`);
    
    // Delete QR code message
    if (order.qrMessageId) {
      try {
        await telegram.deleteMessage(order.chatId, order.qrMessageId);
      } catch {}
    }
    
    // Finalize stock and get digital items
    console.log(`[PAYMENT SUCCESS] 📦 Finalizing stock untuk ${orderId}...`);
    const finalizeResult = await finalizeStock({
      order_id: orderId,
      total: order.total,
      user_id: order.userId,
    });
    
    // DEBUG: Log hasil finalize
    console.log(`[FINALIZE DEBUG] Order: ${orderId}`);
    console.log(`[FINALIZE DEBUG] Result:`, JSON.stringify(finalizeResult, null, 2));
    console.log(`[FINALIZE DEBUG] Items count:`, finalizeResult?.items?.length || 0);
    
    if (!finalizeResult?.ok) {
      console.error(`[FINALIZE ERROR] ⚠️ Finalize gagal: ${finalizeResult?.msg}`);
    }
    
    if (!finalizeResult?.items || finalizeResult.items.length === 0) {
      console.error(`[FINALIZE ERROR] ⚠️ No items returned for order ${orderId}!`);
      console.error('[FINALIZE ERROR] Check if product_items table has available items');
    }
    
    // ============================================
    // PESAN 1: DETAIL PESANAN & RINCIAN BIAYA
    // ============================================
    const message1 = formatPaymentSuccess(order, paymentData);
    
    // Kirim pesan 1
    await telegram.sendMessage(order.chatId, message1, { parse_mode: 'Markdown' });
    
    // Delay 1000ms agar pesan terpisah dengan jelas
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // ============================================
    // PESAN 2: ITEM YANG DIPESAN (PRODUK DIGITAL)
    // ============================================
    if (finalizeResult?.items && finalizeResult.items.length > 0) {
      const items = finalizeResult.items;
      const isLargeBatch = items.length > 5;

      if (isLargeBatch) {
        // Kirim sebagai file teks jika item > 5
        const fileLines = [];
        
        items.forEach((item) => {
          const detailsRaw = item.item_data || item.data || '';
          const details = String(detailsRaw).split('||').filter(Boolean);
          details.forEach(detail => {
            fileLines.push(detail.trim());
          });
        });

        const txtBuffer = Buffer.from(fileLines.join('\n'), 'utf-8');
        await telegram.sendDocument(
          order.chatId,
          { source: txtBuffer, filename: `items-${orderId}.txt` },
          { caption: '🎁 Item digital Anda (lihat file)', parse_mode: 'Markdown' }
        );
      } else {
        // Kirim pesan 2 dalam satu blok untuk item <= 5
        const message2 = formatDigitalItems(items);
        
        // Kirim pesan 2
        await telegram.sendMessage(order.chatId, message2, { parse_mode: 'Markdown' });
      }
      
      // Delay 1000ms sebelum pesan 3
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // ============================================
    // PESAN 2.5: CATATAN ITEM (JIKA ADA)
    // ============================================
    const itemNotes = (finalizeResult?.items || [])
      .map((item) => (item.notes || '').trim())
      .filter(Boolean);

    const uniqueNotes = [...new Set(itemNotes)];
    if (uniqueNotes.length > 0) {
      // Escape markdown untuk notes
      const escapedNotes = uniqueNotes.map(note => escapeMarkdown(note));
      const message25 = formatProductNotes(escapedNotes);
      
      await telegram.sendMessage(order.chatId, message25, { parse_mode: 'Markdown' });

      // Spacer sebelum pesan berikutnya
      await new Promise(resolve => setTimeout(resolve, 600));
    }
    
    // ============================================
    // PESAN 3: TEMPLATE AKHIR & UCAPAN TERIMA KASIH
    // ============================================
    const message3 = formatThankYou(
      finalizeResult?.after_msg || null,
      BOT_CONFIG.SUPPORT_CONTACT || null
    );
    
    // Kirim pesan 3
    await telegram.sendMessage(order.chatId, message3, { parse_mode: 'Markdown' });
    
    // Record analytics
    recordOrder(orderId, order.userId, order.total, order.productCode);

    // Persist order items and status in Supabase
    try {
      await updateOrderStatus(orderId, 'paid');
      if (finalizeResult?.items && finalizeResult.items.length > 0) {
        const itemsForDb = finalizeResult.items.map((it) => ({
          kode: it.product_code || it.kode || order.productCode,
          nama: order.productName,
          qty: 1,
          harga: order.unitPrice,
          product_id: it.product_id || null,
          item_data: it.item_data || it.data || null,
        }));
        await createOrderItems(orderId, itemsForDb);
        await markItemsAsSent(orderId, JSON.stringify(finalizeResult.items));
      }
      await updateOrderStatus(orderId, 'completed');
    } catch (dbErr) {
      console.warn('[ORDER DB WARN] Failed to persist items/status:', dbErr?.message);
    }
    
    // Update order status
    order.status = 'completed';
    
    // Auto-refresh stok setelah pembayaran sukses (non-blocking)
    // Ini akan update stok di sheet dan notify bot
    try {
      const { logger } = await import('../../utils/logger.js');
      logger.info(`[AUTO REFRESH] Triggering refresh after payment ${orderId}`);
      const response = await fetch('http://localhost:3000/webhook/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-refresh-key': BOT_CONFIG.WEBHOOK_SECRET },
        body: JSON.stringify({ secret: BOT_CONFIG.WEBHOOK_SECRET, note: `payment_success_${orderId}` })
      }).catch(() => null);
      if (response?.ok) {
        console.log(`[AUTO REFRESH] ✅ Produk berhasil di-refresh untuk order ${orderId}`);
      }
    } catch (refreshErr) {
      console.warn(`[AUTO REFRESH] Could not refresh stok:`, refreshErr.message);
    }
    
    // Clean up after 1 hour
    setTimeout(() => {
      ACTIVE_ORDERS.delete(orderId);
    }, 60 * 60 * 1000);
    
    console.log(`[PAYMENT SUCCESS] Order ${orderId} completed`);
    
  } catch (error) {
    console.error(`[PAYMENT SUCCESS ERROR] ${orderId}:`, error);
    
    // Reset flag agar bisa di-retry jika error
    if (order) {
      order.__paidProcessed = false;
      console.warn(`[PAYMENT SUCCESS] 🔓 Order ${orderId} flag reset due to error, dapat di-retry`);
    }
    
    try {
      await telegram.sendMessage(
        order.chatId,
        `✅ Pembayaran berhasil untuk Order #${orderId}\n\n` +
        `Namun terjadi kesalahan saat memproses item digital.\n` +
        `Silakan hubungi admin dengan Order ID di atas.`
      );
    } catch {}
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(telegram, orderId, reason) {
  const order = ACTIVE_ORDERS.get(orderId);
  if (!order) return;
  
  try {
    // Delete QR code message
    if (order.qrMessageId) {
      try {
        await telegram.deleteMessage(order.chatId, order.qrMessageId);
      } catch {}
    }
    
    // Release stock
    await releaseStock({ order_id: orderId, reason });
    
    // Notify user
    await telegram.sendMessage(
      order.chatId,
      `❌ Pembayaran untuk Order #${orderId} ${reason}.\n\n` +
      `Silakan buat pesanan baru jika masih ingin membeli.`
    );
    
    // Remove from active orders
    ACTIVE_ORDERS.delete(orderId);
    
    console.log(`[PAYMENT FAILED] Order ${orderId} - ${reason}`);
    
  } catch (error) {
    console.error(`[PAYMENT FAILED ERROR] ${orderId}:`, error);
  }
}

/**
 * Handle payment timeout
 */
async function handlePaymentTimeout(telegram, orderId) {
  const order = ACTIVE_ORDERS.get(orderId);
  if (!order) return;
  
  try {
    // Check one more time
    const status = await midtransStatus(orderId);
    const transactionStatus = (status.transaction_status || '').toLowerCase();
    
    if (transactionStatus === 'settlement' || transactionStatus === 'capture') {
      return handlePaymentSuccess(telegram, orderId, status);
    }
    
    // Delete QR code message
    if (order.qrMessageId) {
      try {
        await telegram.deleteMessage(order.chatId, order.qrMessageId);
      } catch {}
    }
    
    // Release stock
    await releaseStock({ order_id: orderId, reason: 'timeout' });
    
    // Notify user
    await telegram.sendMessage(
      order.chatId,
      `⌛️ Waktu pembayaran untuk Order #${orderId} telah habis.\n\n` +
      `Silakan buat pesanan baru jika masih ingin membeli.`
    );
    
    // Remove from active orders
    ACTIVE_ORDERS.delete(orderId);
    
    console.log(`[PAYMENT TIMEOUT] Order ${orderId}`);
    
  } catch (error) {
    console.error(`[PAYMENT TIMEOUT ERROR] ${orderId}:`, error);
  }
}

/**
 * Cancel order
 */
export async function cancelOrder(ctx, orderId) {
  const order = ACTIVE_ORDERS.get(orderId);
  
  if (!order) {
    return ctx.answerCbQuery('Order tidak ditemukan atau sudah selesai');
  }
  
  if (order.userId !== ctx.from.id) {
    return ctx.answerCbQuery('Anda tidak memiliki akses ke order ini');
  }
  
  try {
    // Delete QR message
    if (order.qrMessageId) {
      try {
        await ctx.telegram.deleteMessage(order.chatId, order.qrMessageId);
      } catch {}
    }
    
    // Release stock
    await releaseStock({ order_id: orderId, reason: 'user_cancel' });
    
    // Remove from active orders
    ACTIVE_ORDERS.delete(orderId);
    
    await ctx.answerCbQuery('✅ Order dibatalkan');
    await ctx.reply(`❌ Order #${orderId} telah dibatalkan.`);
    
  } catch (error) {
    console.error('[CANCEL ORDER ERROR]', error);
    await ctx.answerCbQuery('❌ Gagal membatalkan order');
  }
}

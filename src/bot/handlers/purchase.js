// src/bot/handlers/purchase.js
import QRCode from 'qrcode';
import { BOT_CONFIG } from '../config.js';
import { ACTIVE_ORDERS, recordOrder, getUserSession } from '../state.js';
import { formatProductDetail, formatPendingPayment, formatOrderReceipt, formatCurrency, formatDateTime } from '../formatters.js';
import { productDetailKeyboard, orderStatusKeyboard } from '../keyboards.js';
import { byKode, getAll as getAllProducts } from '../../data/products.js';
import { reserveStock, finalizeStock, releaseStock } from '../../services/gas.js';
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
    // Step 1: Reserve stock
    const reserveResult = await reserveStock({
      kode: productCode,
      qty: quantity,
      userRef,
    });
    
    if (!reserveResult?.ok || !reserveResult?.order_id) {
      await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
      return ctx.reply(
        `❌ Gagal memesan produk: ${reserveResult?.msg || 'Stok tidak tersedia'}\n\n` +
        `Silakan coba lagi atau hubungi admin.`
      );
    }
    
    const orderId = String(reserveResult.order_id);
    const unitPrice = Number(product.harga) || 0;
    const totalAmount = unitPrice * quantity;
    
    // Step 2: Create Midtrans payment
    const chargeResult = await createMidtransQRISCharge({
      order_id: orderId,
      gross_amount: totalAmount,
    });
    
    if (!chargeResult?.qr_string && !chargeResult?.qr_url) {
      // Release stock if payment creation fails
      await releaseStock({ order_id: orderId, reason: 'payment_creation_failed' });
      await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
      return ctx.reply('❌ Gagal membuat pembayaran. Silakan coba lagi.');
    }
    
    // Delete processing message
    await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
    
    // Step 3: Generate and send QR code
    const qrBuffer = await QRCode.toBuffer(chargeResult.qr_string);
    const caption = formatPendingPayment({
      orderId,
      productName: product.nama,
      productCode,
      quantity,
      unitPrice,
      total: totalAmount,
      createdAt: Date.now(),
      qrUrl: chargeResult.qr_url || null,
    });
    
    const qrMessage = await ctx.replyWithPhoto(
      { source: qrBuffer },
      {
        caption,
        parse_mode: 'Markdown',
        ...orderStatusKeyboard(orderId),
      }
    );
    
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
    pollPaymentStatus(ctx.telegram, orderId, product);
    
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
async function pollPaymentStatus(telegram, orderId, product, attempts = 0) {
  const maxAttempts = 20;
  const intervals = [5000, 10000, 15000, 30000]; // 5s, 10s, 15s, 30s intervals
  
  if (attempts >= maxAttempts) {
    await handlePaymentTimeout(telegram, orderId);
    return;
  }
  
  // Wait before checking
  const waitTime = intervals[Math.min(attempts, intervals.length - 1)];
  await new Promise(resolve => setTimeout(resolve, waitTime));
  
  try {
    const status = await midtransStatus(orderId);
    const transactionStatus = (status.transaction_status || '').toLowerCase();
    
    console.log(`[POLL] ${orderId} - Attempt ${attempts + 1} - Status: ${transactionStatus}`);
    
    if (transactionStatus === 'settlement' || transactionStatus === 'capture') {
      // Payment successful
      await handlePaymentSuccess(telegram, orderId, status);
      return;
    }
    
    if (['expire', 'cancel', 'deny'].includes(transactionStatus)) {
      // Payment failed
      await handlePaymentFailed(telegram, orderId, transactionStatus);
      return;
    }
    
    // Continue polling
    pollPaymentStatus(telegram, orderId, product, attempts + 1);
    
  } catch (error) {
    console.error(`[POLL ERROR] ${orderId}:`, error);
    // Continue polling even on error
    if (attempts < maxAttempts) {
      pollPaymentStatus(telegram, orderId, product, attempts + 1);
    }
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
  
  try {
    // Delete QR code message
    if (order.qrMessageId) {
      try {
        await telegram.deleteMessage(order.chatId, order.qrMessageId);
      } catch {}
    }
    
    // Finalize stock and get digital items
    const finalizeResult = await finalizeStock({
      order_id: orderId,
      total: order.total,
    });
    
    // DEBUG: Log hasil finalize
    console.log(`[FINALIZE DEBUG] Order: ${orderId}`);
    console.log(`[FINALIZE DEBUG] Result:`, JSON.stringify(finalizeResult, null, 2));
    console.log(`[FINALIZE DEBUG] Items count:`, finalizeResult?.items?.length || 0);
    
    if (!finalizeResult?.items || finalizeResult.items.length === 0) {
      console.error(`[FINALIZE ERROR] ⚠️ No items returned for order ${orderId}!`);
      console.error('[FINALIZE ERROR] Check Google Apps Script finalize action');
    }
    
    // ============================================
    // PESAN 1: DETAIL PESANAN & RINCIAN BIAYA
    // ============================================
    const message1 = [
      '✅ *PEMBAYARAN BERHASIL*',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      '📋 *Detail Pesanan:*',
      `🆔 Order: \`${orderId}\``,
      `📦 Produk: *${order.productName}*`,
      `🔖 Kode: \`${order.productCode}\``,
      `📊 Jumlah: ${order.quantity} item`,
      '',
      '💰 *Rincian Biaya:*',
      `Harga @ ${formatCurrency(order.unitPrice)}`,
      `Total: *${formatCurrency(order.total)}*`,
      '',
      `💳 ${paymentData?.payment_type || 'QRIS'}`,
      `🕒 ${formatDateTime(order.createdAt || Date.now())}`,
      '━━━━━━━━━━━━━━━━━━━━'
    ].join('\n');
    
    // Kirim pesan 1
    await telegram.sendMessage(order.chatId, message1, { parse_mode: 'Markdown' });
    
    // Delay 500ms agar pesan terpisah dengan jelas
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // ============================================
    // PESAN 2: ITEM YANG DIPESAN (PRODUK DIGITAL)
    // ============================================
    let message2 = '';
    if (finalizeResult?.items && finalizeResult.items.length > 0) {
      const itemLines = [
        '🎁 *PRODUK DIGITAL ANDA:*',
        ''
      ];
      
      finalizeResult.items.forEach((item, i) => {
        itemLines.push(`📦 *Item ${i + 1}*`);
        const details = String(item.data || '').split('||').filter(Boolean);
        details.forEach(detail => itemLines.push(`   ${detail.trim()}`));
        if (i < finalizeResult.items.length - 1) itemLines.push('');
      });
      
      itemLines.push('', '━━━━━━━━━━━━━━━━━━━━');
      message2 = itemLines.join('\n');
      
      // Kirim pesan 2
      await telegram.sendMessage(order.chatId, message2, { parse_mode: 'Markdown' });
      
      // Delay 500ms sebelum pesan 3
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // ============================================
    // PESAN 3: TEMPLATE AKHIR & UCAPAN TERIMA KASIH
    // ============================================
    const message3Lines = [
      '✨ *Terima kasih sudah berbelanja!*',
      '⭐️ Simpan pesanan ini sebagai bukti pembelian',
    ];
    
    // Tambah catatan jika ada
    if (finalizeResult?.after_msg) {
      message3Lines.push('');
      message3Lines.push('📌 *Catatan:*');
      message3Lines.push(finalizeResult.after_msg);
    }
    
    // Tambah contact support
    if (BOT_CONFIG.SUPPORT_CONTACT) {
      message3Lines.push('');
      message3Lines.push(`📞 Bantuan: ${BOT_CONFIG.SUPPORT_CONTACT}`);
    }
    
    const message3 = message3Lines.join('\n');
    
    // Kirim pesan 3
    await telegram.sendMessage(order.chatId, message3, { parse_mode: 'Markdown' });
    
    // Record analytics
    recordOrder(orderId, order.userId, order.total, order.productCode);
    
    // Update order status
    order.status = 'completed';
    
    // Clean up after 1 hour
    setTimeout(() => {
      ACTIVE_ORDERS.delete(orderId);
    }, 60 * 60 * 1000);
    
    console.log(`[PAYMENT SUCCESS] Order ${orderId} completed`);
    
  } catch (error) {
    console.error(`[PAYMENT SUCCESS ERROR] ${orderId}:`, error);
    
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

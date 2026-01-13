// src/bot/formatters.js
import { BOT_CONFIG } from './config.js';

/**
 * Format currency
 */
export function formatCurrency(amount) {
  return new Intl.NumberFormat(BOT_CONFIG.LOCALE, {
    style: 'currency',
    currency: BOT_CONFIG.CURRENCY,
    maximumFractionDigits: 0,
  }).format(amount ?? 0);
}

/**
 * Format date time
 */
export function formatDateTime(date) {
  return new Intl.DateTimeFormat(BOT_CONFIG.LOCALE, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(typeof date === 'string' ? new Date(date) : date);
}

/**
 * Format date only
 */
export function formatDate(date) {
  return new Intl.DateTimeFormat(BOT_CONFIG.LOCALE, {
    dateStyle: 'medium',
  }).format(typeof date === 'string' ? new Date(date) : date);
}

/**
 * Format product description
 */
export function formatDescription(desc) {
  if (!desc) return '-';
  return String(desc)
    .split('||')
    .map(x => x.trim())
    .filter(Boolean)
    .join(', ');
}

/**
 * Truncate text
 */
export function truncate(text, maxLength = 100) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Format product list
 */
export function formatProductList(products, page, perPage, total) {
  const start = (page - 1) * perPage;
  const totalPages = Math.ceil(total / perPage);
  
  const lines = products.map((p, i) => {
    const num = start + i + 1;
    const name = String(p.nama || '');
    const price = formatCurrency(p.harga);
    const stock = p.stok !== null && p.stok !== undefined && p.stok !== '' 
      ? (Number(p.stok) > 0 ? ` • Stok: ${p.stok}` : ' • Habis') 
      : '';
    return `${num}. *${name}*\n   💰 ${price}${stock}`;
  });
  
  const header = [
    `🏪 *${BOT_CONFIG.STORE_NAME}*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `📦 *KATALOG PRODUK*`,
    '',
  ].join('\n');
  
  const footer = [
    '',
    `━━━━━━━━━━━━━━━━━━━━`,
    `📄 Hal ${page}/${totalPages} • Total: ${total} produk`,
  ].join('\n');
  
  return header + lines.join('\n\n') + footer;
}

/**
 * Format product detail
 */
export function formatProductDetail(product, quantity = 1) {
  const name = String(product.nama || '').toUpperCase();
  const code = product.kode || '-';
  const price = Number(product.harga) || 0;
  const stock = product.stok ?? '∞';
  const description = formatDescription(product.deskripsi);
  const category = product.kategori || 'Lainnya';
  const total = price * quantity;
  
  return [
    `🛍️ *DETAIL PRODUK*`,
    '',
    `📦 *${name}*`,
    `🔖 Kode: \`${code}\``,
    `📂 Kategori: ${category}`,
    `💰 Harga: ${formatCurrency(price)}`,
    `📊 Stok: ${stock}`,
    '',
    `📝 *Deskripsi:*`,
    description,
    '',
    `➕ *Jumlah Pembelian:* ${quantity}`,
    `💵 *Total:* ${formatCurrency(total)}`,
    '',
    `🕒 ${formatDateTime(new Date())}`,
  ].join('\n');
}

/**
 * Format order receipt
 */
export function formatOrderReceipt(order) {
  const lines = [];
  
  // ============================================
  // BAGIAN 1: HEADER & KONFIRMASI PEMBAYARAN
  // ============================================
  lines.push(
    '✅ *PEMBAYARAN BERHASIL*',
    '━━━━━━━━━━━━━━━━━━━━',
    ''
  );
  
  // ============================================
  // BAGIAN 2: DETAIL PESANAN & RINCIAN BIAYA
  // ============================================
  lines.push(
    '📋 *Detail Pesanan:*',
    `🆔 Order: \`${order.orderId}\``,
    `📦 Produk: *${order.productName}*`,
    `🔖 Kode: \`${order.productCode}\``,
    `📊 Jumlah: ${order.quantity} item`,
    '',
    '💰 *Rincian Biaya:*',
    `Harga @ ${formatCurrency(order.unitPrice)}`,
    `Total: *${formatCurrency(order.total)}*`,
    '',
    `💳 ${order.paymentMethod || 'QRIS'}`,
    `🕒 ${formatDateTime(order.timestamp)}`,
    '━━━━━━━━━━━━━━━━━━━━'
  );
  
  // ============================================
  // BAGIAN 3: ITEM YANG DIPESAN (PRODUK DIGITAL)
  // ============================================
  if (order.items && order.items.length > 0) {
    lines.push('', '🎁 *PRODUK DIGITAL ANDA:*', '');
    order.items.forEach((item, i) => {
      lines.push(`📦 *Item ${i + 1}*`);
      const details = String(item.data || '').split('||').filter(Boolean);
      details.forEach(detail => lines.push(`   ${detail.trim()}`));
      if (i < order.items.length - 1) lines.push('');
    });
    lines.push('', '━━━━━━━━━━━━━━━━━━━━');
  }
  
  // ============================================
  // BAGIAN 4: CATATAN TAMBAHAN (JIKA ADA)
  // ============================================
  if (order.afterMessage) {
    lines.push('', '📌 *Catatan:*', order.afterMessage, '');
  }
  
  // ============================================
  // BAGIAN 5: TEMPLATE AKHIR & UCAPAN TERIMA KASIH
  // ============================================
  lines.push(
    '',
    '✨ *Terima kasih sudah berbelanja!*',
    '⭐️ Simpan pesanan ini sebagai bukti pembelian'
  );
  
  if (BOT_CONFIG.SUPPORT_CONTACT) {
    lines.push('', `📞 Bantuan: ${BOT_CONFIG.SUPPORT_CONTACT}`);
  }
  
  return lines.join('\n');
}

/**
 * Format pending payment
 */
export function formatPendingPayment(order) {
  const expiryTime = new Date(order.createdAt + BOT_CONFIG.PAYMENT_TTL_MS);
  const ttlMinutes = Math.floor(BOT_CONFIG.PAYMENT_TTL_MS / 60000);
  
  return [
    '💳 *PEMBAYARAN QRIS*',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    '',
    
    // ============ SECTION 1: DETAIL PESANAN ============
    '📋 *Detail Pesanan:*',
    `🆔 Order: \`${order.orderId}\``,
    `📦 ${order.productName} x${order.quantity}`,
    `💰 Total: *${formatCurrency(order.total)}*`,
    '',
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    '',
    // ============ SECTION 2: WAKTU & DEADLINE ============
    '⏰ *Waktu Pembayaran:*',
    `Bayar dalam ${ttlMinutes} menit`,
    `Kadaluarsa: ${formatDateTime(expiryTime)}`,
    '',
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    '',
    
    // ============ SECTION 3: CARA BAYAR ============
    '📱 *Cara Pembayaran:*',
    '1️⃣ Scan QR di atas dengan app E-Wallet/Bank',
    '2️⃣ Konfirmasi pembayaran',
    '3️⃣ Produk dikirim otomatis',
    '',
    '',

    '━━━━━━━━━━━━━━━━━━━━',
    '',
    '',
    
    // ============ SECTION 4: LINK & INFO ============
    order.qrUrl ? `🔗 [Buka QR Link](${order.qrUrl})` : '',
    '',
  ].filter(Boolean).join('\n');
}

/**
 * Format search results
 */
export function formatSearchResults(products, query) {
  if (products.length === 0) {
    return `❌ Tidak ditemukan produk untuk: *${query}*\n\nCoba kata kunci lain atau gunakan /menu untuk melihat semua produk.`;
  }
  
  const lines = products.slice(0, 15).map((p, i) => {
    return `${i + 1}. *${p.nama}*\n   ${formatCurrency(p.harga)} • Kode: \`${p.kode}\``;
  });
  
  const more = products.length > 15 ? `\n\n_... dan ${products.length - 15} produk lainnya_` : '';
  
  return [
    `🔍 *Hasil pencarian:* "${query}"`,
    `📊 Ditemukan ${products.length} produk`,
    '',
    ...lines,
    more,
    '',
    '💡 Gunakan /buy <kode> <jumlah> untuk membeli',
  ].join('\n');
}

/**
 * Format category list
 */
export function formatCategoryList(categories) {
  const lines = categories.map((cat, i) => `${i + 1}. ${cat}`);
  
  return [
    '📂 *KATEGORI PRODUK*',
    '',
    ...lines,
    '',
    '💡 Pilih kategori untuk melihat produk',
  ].join('\n');
}

/**
 * Format user favorites
 */
export function formatFavorites(products) {
  if (products.length === 0) {
    return '⭐ *FAVORIT SAYA*\n\nBelum ada produk favorit.\nTambahkan produk ke favorit saat melihat detail produk!';
  }
  
  const lines = products.map((p, i) => {
    return `${i + 1}. *${p.nama}*\n   ${formatCurrency(p.harga)} • Kode: \`${p.kode}\``;
  });
  
  return [
    '⭐ *FAVORIT SAYA*',
    '',
    ...lines,
    '',
    '💡 Klik nomor untuk melihat detail',
  ].join('\n');
}

/**
 * Format purchase history
 */
export function formatPurchaseHistory(orders, products) {
  if (orders.length === 0) {
    return '📜 *RIWAYAT PEMBELIAN*\n\nBelum ada pembelian.\nMulai belanja sekarang dengan /menu';
  }
  
  const lines = orders.map((order, i) => {
    const product = products.find(p => p.kode === order.productCode);
    const productName = product?.nama || order.productCode;
    const date = formatDate(order.timestamp);
    
    return `${i + 1}. *${productName}*\n   ${formatCurrency(order.amount)} • ${date}`;
  });
  
  return [
    '📜 *RIWAYAT PEMBELIAN*',
    '',
    ...lines,
    '',
    '💡 Terima kasih sudah berbelanja!',
  ].join('\n');
}

/**
 * Format admin dashboard
 */
export function formatAdminDashboard(stats) {
  return [
    '👨‍💼 *ADMIN DASHBOARD*',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    '📊 *Statistik*',
    `• Total Orders: ${stats.totalOrders}`,
    `• Total Revenue: ${formatCurrency(stats.totalRevenue)}`,
    `• Active Users: ${stats.activeUsers}`,
    '',
    '🔥 *Produk Terpopuler*',
    ...stats.topProducts.slice(0, 5).map((p, i) => `${i + 1}. ${p[0]} (${p[1]} views)`),
    '',
    '🔍 *Pencarian Terpopuler*',
    ...stats.topSearches.slice(0, 5).map((s, i) => `${i + 1}. "${s[0]}" (${s[1]}x)`),
    '',
    '💡 Gunakan /adminhelp untuk perintah admin',
  ].join('\n');
}

/**
 * Format help text
 */
export function formatHelp() {
  return [
    `🏪 *${BOT_CONFIG.STORE_NAME}*`,
    BOT_CONFIG.STORE_DESCRIPTION,
    '',
    '🎯 *Perintah Utama:*',
    '`/start` - Mulai bot',
    '`/menu` - Lihat katalog produk',
    '`/search` - Cari produk',
    '`/buy` - Beli produk',
    '`/categories` - Lihat kategori',
    '',
    '⭐ *Fitur Lainnya:*',
    '`/favorites` - Produk favorit',
    '`/history` - Riwayat pembelian',
    '`/status` - Cek status pesanan',
    '`/help` - Bantuan',
    '',
    '💡 *Cara Belanja:*',
    '1️⃣ Pilih produk dari katalog',
    '2️⃣ Tentukan jumlah',
    '3️⃣ Scan QR code untuk bayar',
    '4️⃣ Terima produk otomatis',
    '',
    BOT_CONFIG.SUPPORT_CONTACT 
      ? `📞 Bantuan: ${BOT_CONFIG.SUPPORT_CONTACT}` 
      : '',
  ].filter(Boolean).join('\n');
}

/**
 * Format admin help
 */
export function formatAdminHelp() {
  return [
    '👨‍💼 *ADMIN PANEL*',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    '📊 *Analytics & Dashboard:*',
    '`/admin dashboard` - Dashboard utama',
    '`/admin stats` - Statistik lengkap',
    '`/admin topproducts` - Produk terlaris',
    '',
    '👥 *User Management:*',
    '`/admin users` - Info pengguna aktif',
    '`/admin broadcast <msg>` - Kirim broadcast',
    '',
    '📦 *Product & Orders:*',
    '`/admin orders` - Daftar order aktif',
    '`/admin refresh` - Reload data produk',
    '',
    '🔧 *System:*',
    '`/admin health` - Status sistem',
    '',
    '💡 *Tips:*',
    '• Dashboard otomatis refresh setiap query',
    '• Broadcast terkirim ke semua user aktif',
    '• Refresh produk memuat ulang dari sheet',
  ].join('\n');
}

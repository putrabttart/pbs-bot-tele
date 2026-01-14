// src/bot/formatters.js
import { BOT_CONFIG } from './config.js';

/**
 * =========================
 * OUTLINE LEFT "CARD" HELPERS
 * (TAMPILAN SAJA)
 * =========================
 */
const BOX_TOP = '╭───────────────';
const BOX_ITEM = '┊・';
const BOX_EMPTY = '┊';
const BOX_BOT = '╰───────────────';

/**
 * Auto padding agar ":" sejajar
 * (tampilan saja, tidak mengubah logic data)
 */
function padLabel(label, width = 16) {
  const s = String(label ?? '');
  return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

function kv(label, value, width = 16) {
  return `${padLabel(label, width)}: ${value}`;
}

function cardBlock(lines = []) {
  const out = [];
  out.push(BOX_TOP);

  for (const line of lines) {
    if (line === '' || line === null || line === undefined) out.push(BOX_EMPTY);
    else out.push(`${BOX_ITEM}${String(line)}`);
  }

  out.push(BOX_BOT);
  return out.join('\n');
}

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

  const header = cardBlock([
    kv('Toko', BOT_CONFIG.STORE_NAME),
    kv('Judul', 'KATALOG PRODUK'),
    kv('Halaman', `${page}/${totalPages}`),
    kv('Total', `${total} produk`),
  ]);

  const items = products.map((p, i) => {
    const num = start + i + 1;
    const name = String(p.nama || '');
    const price = formatCurrency(p.harga);

    const stock =
      p.stok !== null && p.stok !== undefined && p.stok !== ''
        ? Number(p.stok) > 0
          ? `Stok: ${p.stok}`
          : 'Stok: Habis'
        : '';

    return stock
      ? `${num}. ${name} | ${price} | ${stock}`
      : `${num}. ${name} | ${price}`;
  });

  const list = items.length ? cardBlock(items) : cardBlock(['Tidak ada produk.']);

  return [header, list].join('\n');
}

/**
 * Format product detail
 * Format sesuai referensi + "Jumlah Pembelian"
 * Note: "Stok Terjual" hanya tampil jika field ada, kalau tidak "-"
 */
export function formatProductDetail(product, quantity = 1) {
  const name = String(product.nama || '').toUpperCase();
  const code = product.kode || '-';
  const price = Number(product.harga) || 0;
  const stock = product.stok ?? '∞';
  const description = formatDescription(product.deskripsi);
  const category = product.kategori || 'Lainnya';
  const total = price * quantity;

  // Tampilan-only: coba ambil beberapa kemungkinan field
  const sold = product.stokTerjual ?? product.terjual ?? product.sold ?? '-';

  const block1 = cardBlock([
    kv('Produk', name),
    kv('Kode', code),
    kv('Kategori', category),
    kv('Sisa Stok', stock),
    kv('Stok Terjual', sold),
    kv('Desk', description),
  ]);

  const block2 = cardBlock([
    'Jumlah Pembelian',
    kv('Jumlah', quantity),
    kv('Harga', formatCurrency(price)),
    kv('Total Harga', formatCurrency(total)),
  ]);

  return [block1, block2, '', `Current Date: ${formatDateTime(new Date())}`].join(
    '\n'
  );
}

/**
 * Format order receipt
 */
export function formatOrderReceipt(order) {
  const blocks = [];

  blocks.push(
    cardBlock([
      'Status Pembayaran',
      kv('Status', 'Berhasil'),
      kv('Order', `\`${order.orderId}\``),
      kv('Metode', order.paymentMethod || 'QRIS'),
      kv('Waktu', formatDateTime(order.timestamp)),
    ])
  );

  blocks.push(
    cardBlock([
      'Detail Pesanan',
      kv('Produk', `*${order.productName}*`),
      kv('Kode', `\`${order.productCode}\``),
      kv('Jumlah', `${order.quantity} item`),
    ])
  );

  blocks.push(
    cardBlock([
      'Rincian Biaya',
      `Harga @ ${formatCurrency(order.unitPrice)}`,
      `Total: *${formatCurrency(order.total)}*`,
    ])
  );

  if (order.items && order.items.length > 0) {
    const itemLines = ['Produk Digital Anda:'];
    order.items.forEach((item, i) => {
      itemLines.push(`Item ${i + 1}`);
      const details = String(item.data || '').split('||').filter(Boolean);
      details.forEach(d => itemLines.push(`- ${d.trim()}`));
      if (i < order.items.length - 1) itemLines.push('');
    });
    blocks.push(cardBlock(itemLines));
  }

  if (order.afterMessage) {
    blocks.push(
      cardBlock([
        'Catatan',
        order.afterMessage,
      ])
    );
  }

  const footer = [
    'Terima kasih sudah berbelanja!',
    'Simpan pesan ini sebagai bukti pembelian.',
  ];
  if (BOT_CONFIG.SUPPORT_CONTACT) {
    footer.push('', `Bantuan: ${BOT_CONFIG.SUPPORT_CONTACT}`);
  }
  blocks.push(cardBlock(footer));

  return blocks.join('\n\n');
}

/**
 * Format pending payment
 */
export function formatPendingPayment(order) {
  const expiryTime = new Date(order.createdAt + BOT_CONFIG.PAYMENT_TTL_MS);
  const ttlMinutes = Math.floor(BOT_CONFIG.PAYMENT_TTL_MS / 60000);

  const blocks = [];

  blocks.push(
    cardBlock([
      'Pembayaran Pending',
      kv('Order', `\`${order.orderId}\``),
      kv('Produk', `${order.productName} x${order.quantity}`),
      kv('Total', `*${formatCurrency(order.total)}*`),
    ])
  );

  blocks.push(
    cardBlock([
      'Waktu Pembayaran',
      kv('Batas', `${ttlMinutes} menit`),
      kv('Kadaluarsa', formatDateTime(expiryTime)),
    ])
  );

  blocks.push(
    cardBlock([
      'Cara Pembayaran',
      '1) Scan QR di atas dengan app E-Wallet/Bank',
      '2) Konfirmasi pembayaran',
      '3) Produk dikirim otomatis',
    ])
  );

  if (order.qrUrl) {
    blocks.push(
      cardBlock([
        'Link',
        `[Buka QR Link](${order.qrUrl})`,
      ])
    );
  }

  return blocks.join('\n\n');
}

/**
 * Format search results
 */
export function formatSearchResults(products, query) {
  if (products.length === 0) {
    return cardBlock([
      'Hasil Pencarian',
      kv('Query', `"${query}"`),
      '',
      'Tidak ditemukan produk.',
      'Coba kata kunci lain atau gunakan /menu.',
    ]);
  }

  const lines = products.slice(0, 15).map((p, i) => {
    return `${i + 1}. ${p.nama} | ${formatCurrency(p.harga)} | Kode: \`${p.kode}\``;
  });

  const more = products.length > 15 ? `... dan ${products.length - 15} produk lainnya` : '';

  return [
    cardBlock([
      'Hasil Pencarian',
      kv('Query', `"${query}"`),
      kv('Ditemukan', `${products.length} produk`),
    ]),
    cardBlock([
      ...lines,
      more ? '' : null,
      more || null,
      '',
      'Gunakan /buy <kode> <jumlah> untuk membeli',
    ].filter(Boolean)),
  ].join('\n\n');
}

/**
 * Format category list
 */
export function formatCategoryList(categories) {
  const lines = categories.map((cat, i) => `${i + 1}. ${cat}`);

  return cardBlock([
    'Kategori Produk',
    ...lines,
    '',
    'Pilih kategori untuk melihat produk',
  ]);
}

/**
 * Format user favorites
 */
export function formatFavorites(products) {
  if (products.length === 0) {
    return cardBlock([
      'Favorit Saya',
      '',
      'Belum ada produk favorit.',
      'Tambahkan favorit saat melihat detail produk.',
    ]);
  }

  const lines = products.map((p, i) => {
    return `${i + 1}. ${p.nama} | ${formatCurrency(p.harga)} | Kode: \`${p.kode}\``;
  });

  return cardBlock([
    'Favorit Saya',
    ...lines,
    '',
    'Klik nomor untuk melihat detail',
  ]);
}

/**
 * Format purchase history
 */
export function formatPurchaseHistory(orders, products) {
  if (orders.length === 0) {
    return cardBlock([
      'Riwayat Pembelian',
      '',
      'Belum ada pembelian.',
      'Mulai belanja sekarang dengan /menu',
    ]);
  }

  const lines = orders.map((order, i) => {
    const product = products.find(p => p.kode === order.productCode);
    const productName = product?.nama || order.productCode;
    const date = formatDate(order.timestamp);

    return `${i + 1}. ${productName} | ${formatCurrency(order.amount)} | ${date}`;
  });

  return cardBlock([
    'Riwayat Pembelian',
    ...lines,
    '',
    'Terima kasih sudah berbelanja!',
  ]);
}

/**
 * Format admin dashboard
 */
export function formatAdminDashboard(stats) {
  const topProducts = stats.topProducts?.slice(0, 5) ?? [];
  const topSearches = stats.topSearches?.slice(0, 5) ?? [];

  return [
    cardBlock([
      'Admin Dashboard',
      kv('Total Orders', stats.totalOrders),
      kv('Total Revenue', formatCurrency(stats.totalRevenue)),
      kv('Active Users', stats.activeUsers),
    ]),
    cardBlock([
      'Produk Terpopuler',
      ...(topProducts.length
        ? topProducts.map((p, i) => `${i + 1}. ${p[0]} (${p[1]} views)`)
        : ['-']),
    ]),
    cardBlock([
      'Pencarian Terpopuler',
      ...(topSearches.length
        ? topSearches.map((s, i) => `${i + 1}. "${s[0]}" (${s[1]}x)`)
        : ['-']),
    ]),
    cardBlock([
      'Info',
      'Gunakan /adminhelp untuk perintah admin',
    ]),
  ].join('\n\n');
}

/**
 * Format help text
 */
export function formatHelp() {
  const lines = [
    `${BOT_CONFIG.STORE_NAME}`,
    BOT_CONFIG.STORE_DESCRIPTION,
    '',
    'Perintah Utama:',
    '/start - Mulai bot',
    '/menu - Lihat katalog produk',
    '/search - Cari produk',
    '/buy - Beli produk',
    '/categories - Lihat kategori',
    '',
    'Fitur Lainnya:',
    '/favorites - Produk favorit',
    '/history - Riwayat pembelian',
    '/status - Cek status pesanan',
    '/help - Bantuan',
    '',
    'Cara Belanja:',
    '1) Pilih produk dari katalog',
    '2) Tentukan jumlah',
    '3) Scan QR code untuk bayar',
    '4) Terima produk otomatis',
  ];

  if (BOT_CONFIG.SUPPORT_CONTACT) {
    lines.push('', `Bantuan: ${BOT_CONFIG.SUPPORT_CONTACT}`);
  }

  return cardBlock(lines);
}

/**
 * Format admin help
 */
export function formatAdminHelp() {
  return [
    cardBlock([
      'Admin Panel',
      '',
      'Analytics & Dashboard:',
      '/admin dashboard - Dashboard utama',
      '/admin stats - Statistik lengkap',
      '/admin topproducts - Produk terlaris',
    ]),
    cardBlock([
      'User Management:',
      '/admin users - Info pengguna aktif',
      '/admin broadcast <msg> - Kirim broadcast',
    ]),
    cardBlock([
      'Product & Orders:',
      '/admin orders - Daftar order aktif',
      '/admin refresh - Reload data produk',
    ]),
    cardBlock([
      'System:',
      '/admin health - Status sistem',
    ]),
    cardBlock([
      'Tips:',
      '• Dashboard otomatis refresh setiap query',
      '• Broadcast terkirim ke semua user aktif',
      '• Refresh produk memuat ulang dari sheet',
    ]),
  ].join('\n\n');
}

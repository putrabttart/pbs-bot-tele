// ============================================================
// Telegram Bot - PBS
// Tabs + Grid + Detail "Nota" + Buy Now (Midtrans QRIS) + Text Intent
// - Token hardcode
// - Auto-refresh produk (TTL 2 menit)
// - List per 10 item, [NO] NAMA ITEM (UPPERCASE) + nomor global konsisten
// - Detail rapi, deskripsi "||" -> ", "
// - Tombol ➖ 🔄 ➕ untuk qty + Buy Now (qty)
// - QR dari qr_string (tanpa bingkai), caption pending
// - Hapus "Memproses..." setelah QR tampil; hapus QR saat pembayaran sukses/expire
// File: bot-telegram/index.telegram.js
// ============================================================

import { Telegraf, Markup } from 'telegraf';
import QR from 'qrcode';

// ====== TOKEN HARDCODE (ganti ini) ======
const TELEGRAM_BOT_TOKEN = '8385999574:AAEdIm9zrAg4Itl121Gy20CCblnOQD0C5T0';
if (!/^\d+:[A-Za-z0-9_\-]{20,}$/.test(TELEGRAM_BOT_TOKEN)) {
  console.error('❌ Format token Telegram tidak valid. Ganti TELEGRAM_BOT_TOKEN di file ini.');
  process.exit(1);
}

// (opsional) env lain bila dipakai
const HTTP_PORT = Number(process.env.HTTP_PORT || 0);
const BASE_URL  = process.env.PUBLIC_BASE_URL || '';

console.log('[BOOT] PBS Telegram starting… tail=', TELEGRAM_BOT_TOKEN.slice(-8));

// ====== PBS Modules ======
import { loadProducts, searchProducts, byKode } from '../src/data/products.js';
import { reserveStock, finalizeStock, releaseStock } from '../src/services/gas.js';
import { createMidtransQRISCharge, midtransStatus, verifyMidtransSignature } from '../src/payments/midtrans.js';
import { formatTransaksiSuksesBox } from '../src/formatters/transactions.js';

// ====== UI Config ======
const PER_PAGE = 10;        // tampil per 10 item
const GRID_COLS = 5;        // grid angka 5 kolom
const TABS = [
  { key: 'list',    label: '📋 List Produk' },
  { key: 'voucher', label: '🎟️ Voucher' },
  { key: 'stok',    label: '📦 Stok' },
];

// ====== Auto-refresh Produk ======
const PRODUCT_TTL_MS = 5 * 1000;  // 2 menit
let PRODUCTS = [];
let LAST_PRODUCTS_AT = 0;

async function refreshProductsFromSource() {
  const t0 = Date.now();
  try {
    console.log('[DATA] loadProducts()…');
    await loadProducts();
    const all = searchProducts('') || [];
    PRODUCTS = Array.isArray(all) ? all : [];
    LAST_PRODUCTS_AT = Date.now();
    console.log('[DATA] loaded', PRODUCTS.length, 'items in', Date.now() - t0, 'ms');
  } catch (e) {
    console.warn('[WARN] loadProducts gagal, pakai dummy:', e?.message);
    PRODUCTS = Array.from({ length: 60 }).map((_, i) => ({
      kode: `PRD${i + 1}`,
      nama: `Produk Contoh ${i + 1}`,
      harga: 10000 + (i % 10) * 5000,
      stok: (i * 7) % 23,
      deskripsi: `Deskripsi singkat untuk Produk Contoh ${i + 1}`,
    }));
    LAST_PRODUCTS_AT = Date.now();
  }
  return PRODUCTS;
}
async function ensureProductsLoaded({ force = false } = {}) {
  const stale = (Date.now() - LAST_PRODUCTS_AT) > PRODUCT_TTL_MS;
  if (force || !PRODUCTS.length || stale) {
    await refreshProductsFromSource();
  }
  return PRODUCTS;
}

// ====== Helpers ======
function paginate(array, page = 1, perPage = PER_PAGE) {
  const total = array.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const p = Math.min(Math.max(1, page), totalPages);
  const start = (p - 1) * perPage;
  const items = array.slice(start, start + perPage);
  return { items, page: p, perPage, total, totalPages, startIndex: start };
}
const IDR = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n ?? 0);

// list modern: [NO] NAMA ITEM (UPPERCASE)
function renderList(products, page, per) {
  const { items, startIndex, total, totalPages } = paginate(products, page, per);
  const now = new Date().toLocaleTimeString('id-ID', { hour12: false });

  const lines = items.map((p, i) => {
    const n = startIndex + i + 1;             // nomor global
    const nameUpper = String(p.nama || '').toUpperCase();
    return `[${n}] ${nameUpper}`;
  });

  return [
    `*📒 KATALOG PRODUK*  (_${total} item_)`,
    '',
    ...lines,
    '',
    `Halaman *${page}/${totalPages}*   •   🕒 ${now}`,
  ].join('\n');
}
function renderStok(products, page, per) {
  const { items, startIndex, total, totalPages } = paginate(products, page, per);
  const rows = items.map((p, i) => {
    const n = startIndex + i + 1;
    const kode = p.kode ? `\`${p.kode}\`` : '`-`';
    return `${n}. *${p.nama}* — Stok: ${p.stok ?? 0}  •  Kode: ${kode}`;
  });
  return [
    `*📦 INFO STOK*  (_${total} item_)`,
    '',
    ...rows,
    '',
    `Halaman *${page}/${totalPages}*`,
  ].join('\n');
}
function renderVoucher() { return `*VOUCHER TERSEDIA*\n- HEMAT10 — Diskon 10% (min 100rb)\n- NEW5 — Diskon 5rb pengguna baru`; }

// format deskripsi: "a||b||c" → "a, b, c"
function prettyDesc(s = '') {
  return String(s)
    .split('||')
    .map(x => x.trim())
    .filter(Boolean)
    .join(', ');
}

// detail "nota" + qty
function renderDetailCard(p, qty = 1) {
  const nameUpper = String(p.nama || '').toUpperCase();
  const stok = p.stok ?? 0;
  const harga = Number(p.harga) || 0;
  const total = harga * qty;
  const desc = p.deskripsi ? prettyDesc(p.deskripsi) : '-';

  return [
    'tambahkan jumlah pembelian:',
    '────────────────────────────',
    `• *Produk* : ${nameUpper}`,
    `• *Kode*   : ${p.kode || '-'}`,
    `• *Sisa Stok* : ${stok}`,
    p.sold != null ? `• *Stok Terjual* : ${p.sold}` : null,
    `• *Desk*  : ${desc}`,
    '────────────────────────────',
    `• *Jumlah* : ${qty}`,
    `• *Harga*  : ${IDR(harga)}`,
    `• *Total*  : ${IDR(total)}`,
    '',
    `Current Date: ${new Date().toLocaleTimeString('id-ID', { hour12:false })}`,
  ].filter(Boolean).join('\n');
}

// render detail berdasarkan index global + qty
function renderDetail(products, globalIdx, qty = 1) {
  const p = products[globalIdx - 1];
  if (!p) return `Produk #${globalIdx} tidak ditemukan.`;
  return renderDetailCard(p, qty);
}

// ====== State per Chat ======
const CHAT_STATE = new Map();
function getState(chatId) {
  const s = CHAT_STATE.get(chatId) || { tab: 'list', page: 1, detail: null };
  CHAT_STATE.set(chatId, s);
  return s;
}

// ====== Orders (in-memory) ======
// order_id -> { chatId, kode, qty, createdAt, processingMsgId?, qrMsgId? }
const ORDERS = Object.create(null);

// ====== Midtrans Polling Helper ======
async function pollMidtransUntil(order_id, attempts = [5_000, 15_000, 30_000, 60_000]) {
  for (const wait of attempts) {
    await new Promise(r => setTimeout(r, wait));
    try {
      const st = await midtransStatus(order_id);
      const s = (st?.transaction_status || '').toLowerCase();
      console.log('[POLL]', order_id, '→', s);
      if (s === 'settlement' || s === 'capture') return { settled: true, data: st };
      if (['expire', 'cancel', 'deny'].includes(s)) return { settled: false, data: st };
    } catch (e) { console.warn('[POLL] err', e?.message || e); }
  }
  return { settled: false, data: null };
}

// ====== Bot ======
const bot = new Telegraf(TELEGRAM_BOT_TOKEN, { handlerTimeout: 30_000 });

(async () => {
  const me = await bot.telegram.getMe();
  console.log(`[OK] Connected as @${me.username} (id=${me.id})`);
})().catch(e => console.error('[getMe] error:', e));

// ====== Common replies ======
function helpText() {
  return [
    '*Cara Pakai*',
    '• /menu — buka katalog',
    '• /buy <KODE> <QTY> — langsung beli',
    '• Ketik nama produk untuk cari (mis: *netflix*)',
    '• Format bebas: *buy cc1b 1*, *#buynow CC1B 2*, atau cukup "*cc1b 1*"',
  ].join('\n');
}
async function sendMenu(ctx) {
  await ensureProductsLoaded();
  const s = getState(ctx.chat.id); s.tab = 'list'; s.page = 1;
  const products = await ensureProductsLoaded();
  await ctx.replyWithMarkdown(
    renderList(products, s.page, PER_PAGE),
    buildFullKeyboard(s.tab, products.length, s.page, PER_PAGE)
  );
}

// helper: kirim text panjang (limit Telegram 4096)
async function sendLong(telegram, chatId, text, extra = {}) {
  const LIM = 4096;
  if (text.length <= LIM) return telegram.sendMessage(chatId, text, extra);
  let off = 0;
  while (off < text.length) {
    const chunk = text.slice(off, off + LIM);
    await telegram.sendMessage(chatId, chunk, extra);
    off += LIM;
  }
}

// ====== Buy Flow (shared) ======
async function handleBuy(ctx, kodeRaw, qtyRaw) {
  const kode = String(kodeRaw || '').trim();
  const qty = Math.max(1, Math.min(999, parseInt(qtyRaw, 10) || 1));
  console.log('[BUY] request', { user: ctx.from?.id, kode, qty });

  const prod = byKode(kode) || (searchProducts(kode)[0]);
  if (!prod) return ctx.reply('❌ Produk tidak ditemukan. Coba cek /menu atau ketik nama produknya.');

  // [A] Tampilkan "Memproses..." (akan kita hapus setelah QR tampil)
  const processingMsg = await ctx.replyWithMarkdown(`⏳ Memproses *${prod.nama}* (${kode}) x${qty}…`);

  // Reserve stock
  const userRef = `tg:${ctx.from.id}`;
  let reserve;
  try {
    reserve = await reserveStock({ kode, qty, userRef });
    console.log('[BUY] reserveStock resp:', reserve);
  } catch (e) {
    console.error('[BUY] reserveStock err:', e);
    return ctx.reply('Gagal reserve stok. Coba lagi sebentar.');
  }
  if (!reserve?.ok || !reserve?.order_id) {
    return ctx.reply(`Gagal reserve stok: ${reserve?.msg || 'unknown'}`);
  }

  const order_id = String(reserve.order_id);
  const gross_amount = Math.round((Number(prod.harga) || 0) * qty);

  // Charge Midtrans
  let charge;
  try {
    charge = await createMidtransQRISCharge({
      order_id,
      gross_amount,
      item_details: [{ id: kode, price: Math.round(Number(prod.harga) || 0), quantity: qty, name: prod.nama }]
    });
    console.log('[BUY] midtrans charge:', { order_id, hasQR: !!(charge?.qr_url || charge?.qr_string) });
  } catch (e) {
    console.error('[BUY] createMidtransQRISCharge err:', e);
    await releaseStock({ order_id, reason: 'charge_error' }).catch(() => {});
    return ctx.reply('Gagal membuat QR. Coba lagi.');
  }
  if (!charge?.qr_string && !charge?.qr_url) {
    await releaseStock({ order_id, reason: 'charge_no_qr' }).catch(() => {});
    return ctx.reply('Gagal membuat QR (kosong).');
  }

  // Simpan mapping dasar (diupdate setelah kirim QR)
  ORDERS[order_id] = { chatId: ctx.chat.id, kode, qty, createdAt: Date.now(), processingMsgId: processingMsg.message_id };

  // ====== Kirim QR (buffer) + caption ======
  try {
    const qrBuffer = await QR.toBuffer(charge.qr_string || '');
    const caption = [
      '───────────────────────────────',
      '🕒 *TRANSAKSI PENDING*',
      '',
      `• *Order ID:* ${order_id}`,
      `• *Produk:* ${prod.nama}`,
      `• *Kode:* ${kode}`,
      `• *Jumlah:* ${qty}`,
      `• *Harga Satuan:* ${IDR(prod.harga)}`,
      `• *Total:* ${IDR(gross_amount)}`,
      '',
      `Bayar sebelum: ${new Date(Date.now() + 15 * 60_000).toLocaleString('id-ID')}`,
      '',
      `[💳 Buka QR di Browser](${charge.actions?.[1]?.url || charge.actions?.[0]?.url || '#'})`,
      '───────────────────────────────',
    ].join('\n');

    const sent = await ctx.replyWithPhoto(
      { source: qrBuffer },
      { caption, parse_mode: 'Markdown', disable_web_page_preview: true }
    );

    // [B] Hapus "Memproses..." setelah QR keluar
    try { await ctx.deleteMessage(processingMsg.message_id); } catch {}

    // [C] Simpan id pesan QR untuk dihapus saat sukses
    ORDERS[order_id].qrMsgId = sent.message_id;

  } catch (err) {
    console.error('[QR GENERATE ERROR]', err);
    await ctx.replyWithMarkdown(
      [
        '💳 *QRIS Pembayaran*',
        '',
        `\`${charge.qr_string}\``,
        '',
        `_Silakan bayar dengan aplikasi QRIS (GoPay/OVO/DANA/ShopeePay, dll)._`
      ].join('\n')
    );
  }

  // Fallback polling (jika webhook telat)
  pollMidtransUntil(order_id).then(async (r) => {
    if (!ORDERS[order_id]) return; // sudah beres via webhook
    if (r.settled) {
      await fulfillAndSend(bot.telegram, order_id, prod, gross_amount);
    } else {
      const o = ORDERS[order_id];
      if (o) {
        // hapus QR agar chat bersih
        if (o.qrMsgId) { try { await ctx.telegram.deleteMessage(o.chatId, o.qrMsgId); } catch {} }
        await releaseStock({ order_id, reason: 'polling_timeout' }).catch(() => {});
        await ctx.telegram.sendMessage(o.chatId, `⌛️ Order #${order_id} belum dibayar/timeout.`);
        delete ORDERS[order_id];
      }
    }
  }).catch(e => console.error('[POLL] unhandled err:', e));
}

// === Fulfillment: struk + item jadi 1 bubble, hapus QR & processing ===
async function fulfillAndSend(telegram, order_id, prodOrNull, gross_amount) {
  const o = ORDERS[order_id];
  if (!o) return;

  const { chatId, qty, kode, qrMsgId, processingMsgId } = o;

  // [D] Hapus pesan QR jika ada
  if (qrMsgId) { try { await telegram.deleteMessage(chatId, qrMsgId); } catch {} }
  // [E] Hapus "Memproses..." jika masih ada (edge case)
  if (processingMsgId) { try { await telegram.deleteMessage(chatId, processingMsgId); } catch {} }

  let prod = prodOrNull || byKode(kode) || (searchProducts(kode)[0]);
  const unitPrice  = Number(prod?.harga) || Math.round(gross_amount / Math.max(1, qty));
  const totalFinal = Math.round(gross_amount);

  // finalize stock → ambil item/akun
  const fin = await finalizeStock({ order_id, total: totalFinal }).catch(e => {
    console.error('[FINALIZE ERR]', e);
    return null;
  });

  // bagian struk sukses
  const ev = { payment_type: 'qris' }; // minimal placeholder
  let receipt = '';
  try {
    receipt =
      `✅ Pembayaran untuk #${order_id} *berhasil*.\n` +
      formatTransaksiSuksesBox({
        ev,
        meta: { product_name: prod?.nama || kode, chatId: `tg:${chatId}`, qty, unit_price: unitPrice },
        gross: totalFinal,
      });
  } catch (_e) {
    receipt = [
      `✅ Pembayaran untuk #${order_id} *berhasil*.`,
      `• Produk     : ${prod?.nama || kode}`,
      `• Jumlah     : ${qty}`,
      `• Harga/Unit : ${IDR(unitPrice)}`,
      `• Total      : ${IDR(totalFinal)}`,
      `• Metode     : QRIS`,
      '────────────────────────────────'
    ].join('\n');
  }

  // bagian item digabung
  let itemsBlock = '';
  if (Array.isArray(fin?.items) && fin.items.length) {
    const fmt = (s='') => s.split('||').map(x => x.trim()).filter(Boolean).map(x => `- ${x}`).join('\n');
    itemsBlock =
      '\n' + fin.items.map((it, i) =>
        `*Item ${i + 1}* (${it?.kode || '-'})\n${fmt(it?.data || '')}`
      ).join('\n\n');
  }

  const after = fin?.after_msg ? `\n\n${fin.after_msg}` : '';
  const fullMsg = `${receipt}${itemsBlock}${after}`;

  await sendLong(telegram, chatId, fullMsg, { parse_mode: 'Markdown', disable_web_page_preview: true });
  delete ORDERS[order_id];
}

// ====== Commands ======
bot.start(async (ctx) => {
  await ensureProductsLoaded({ force: true });
  await ctx.replyWithMarkdown('Selamat datang di *Putra BTT Store Bot*!\n\n' + helpText());
  await sendMenu(ctx);
});
bot.command(['menu','list'], async (ctx) => sendMenu(ctx));
bot.command('reload', async (ctx) => {
  await refreshProductsFromSource();
  await ctx.reply(`✅ Produk dimuat ulang. Total: ${PRODUCTS.length}`);
});
bot.command('help', async (ctx) => ctx.replyWithMarkdown(helpText()));

// /buy CC1B 2
bot.command('buy', async (ctx) => {
  const parts = (ctx.message?.text || '').trim().split(/\s+/);
  const kode = parts[1];
  const qty  = parts[2] || 1;
  if (!kode) return ctx.reply('Format: /buy <KODE> <QTY>\nContoh: /buy CC1B 1');
  return handleBuy(ctx, kode, qty);
});

// Ketik "list" atau "list produk" (tanpa slash) → buka katalog

const mainKb = Markup.keyboard([
  ['📂 Menu', '📦 Stok'],
  ['🔎 Cari']
]).resize();

bot.start(async (ctx) => {
  await ensureProductsLoaded({ force: true });
  await ctx.reply('Selamat datang!', mainKb);
  await sendMenu(ctx);
});

// tangkap tombol "📂 Menu"
// Menangani kata "Menu", "List", "Produk", "List Produk", atau "Stok" (dengan/ tanpa emoji)
bot.hears(
  /^\s*(?:📂\s*)?(?:\/?(?:menu|list|produk|list\s*produk|stok))\s*$/i,
  async (ctx) => {
    // deteksi khusus bila user mengetik "stok" → tampilkan tab stok
    const txt = ctx.message.text.toLowerCase().replace('📂', '').trim();
    if (txt.includes('stok')) {
      const s = getState(ctx.chat.id); s.tab = 'stok'; s.page = 1;
      const products = await ensureProductsLoaded();
      return ctx.replyWithMarkdown(
        renderStok(products, s.page, PER_PAGE),
        buildFullKeyboard(s.tab, products.length, s.page, PER_PAGE)
      );
    }

    // default: tampilkan katalog produk
    await sendMenu(ctx);
  }
);



// Intent teks bebas (buy / buynow / "KODE QTY" / cari nama)
bot.on('text', async (ctx, next) => {
  const txt = (ctx.message?.text || '').trim();

  // pola buy
  let m = txt.match(/^(?:#?buynow|buy)\s+([a-z0-9\-_.]+)\s+(\d{1,3})$/i);
  if (m) return handleBuy(ctx, m[1], m[2]);

  // pola "KODE QTY"
  m = txt.match(/^([a-z0-9\-_.]{2,})\s+(\d{1,3})$/i);
  if (m) return handleBuy(ctx, m[1], m[2]);

  // pencarian nama produk
  if (txt.length >= 2) {
    await ensureProductsLoaded();
    const found = searchProducts(txt) || [];
    if (found.length) {
      const lines = found.slice(0, 20).map((p, i) => `${i + 1}. ${p.nama} — *${p.kode || '-'}* — ${IDR(p.harga)}`);
      await ctx.replyWithMarkdown(`*Hasil pencarian:*\n${lines.join('\n')}\n\nGunakan: /buy <KODE> <QTY>`);
      return;
    }
  }

  if (/^help$|^bantuan$|^cara$/i.test(txt)) return ctx.replyWithMarkdown(helpText());
  return next();
});

// ====== Inline keyboard builders ======
function buildTabs(active) {
  return [TABS.map(t => Markup.button.callback((t.key === active ? '▸ ' : '') + t.label, `tab:${t.key}:1`))];
}
function buildNumberGrid(total, currentPage, perPage) {
  const { totalPages } = paginate(Array.from({ length: total }), currentPage, perPage);
  const base = (currentPage - 1) * perPage;
  const last = Math.min(perPage, total - base);

  const btns = [];
  for (let n = 1; n <= last; n++) {
    const globalIndex = base + n; // 1..total
    btns.push(Markup.button.callback(String(globalIndex), `item:${globalIndex}:${currentPage}`));
  }

  const rows = [];
  for (let i = 0; i < btns.length; i += GRID_COLS) rows.push(btns.slice(i, i + GRID_COLS));

  const nav = [];
  if (currentPage > 1) nav.push(Markup.button.callback('◀️ Hal '+(currentPage-1), `page:${currentPage - 1}`));
  nav.push(Markup.button.callback(`Hal ${currentPage}/${totalPages}`, 'noop:p'));
  if (currentPage < totalPages) nav.push(Markup.button.callback('Hal '+(currentPage+1)+' ▶️', `page:${currentPage + 1}`));
  rows.push(nav);

  return rows;
}
function buildFullKeyboard(tab, total, page, per) {
  return Markup.inlineKeyboard([...buildTabs(tab), ...buildNumberGrid(total, page, per)]);
}

// ====== Inline callbacks (Tabs/Page/Item/Back/BuyNow/Qty/Refresh) ======
bot.action(/^buynow:([^:]+):(\d+)$/, async (ctx) => {
  const kode = ctx.match[1];
  const qty = Math.max(1, Math.min(999, parseInt(ctx.match[2], 10)));
  await ctx.answerCbQuery();
  await handleBuy(ctx, kode, qty);
});

bot.on('callback_query', async (ctx, next) => {
  const data = ctx.callbackQuery?.data || '';
  if (data.startsWith('buynow:')) return next();
  try {
    const s = getState(ctx.chat.id);
    const products = await ensureProductsLoaded();

    if (data.startsWith('noop:')) return ctx.answerCbQuery();

    if (data.startsWith('tab:')) {
      await ensureProductsLoaded();
      const [, tabKey, pageStr] = data.split(':'); s.tab = tabKey || 'list'; s.page = Number(pageStr) || 1;
      if (s.tab === 'list') {
        await ctx.editMessageText(renderList(products, s.page, PER_PAGE), { parse_mode: 'Markdown', ...buildFullKeyboard(s.tab, products.length, s.page, PER_PAGE) });
      } else if (s.tab === 'stok') {
        await ctx.editMessageText(renderStok(products, s.page, PER_PAGE), { parse_mode: 'Markdown', ...buildFullKeyboard(s.tab, products.length, s.page, PER_PAGE) });
      } else {
        await ctx.editMessageText(renderVoucher(), { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buildTabs(s.tab)) });
      }
      return ctx.answerCbQuery();
    }

    if (data.startsWith('page:')) {
      await ensureProductsLoaded();
      s.page = Number(data.split(':')[1]) || 1;
      if (s.tab === 'list') {
        await ctx.editMessageText(renderList(products, s.page, PER_PAGE), { parse_mode: 'Markdown', ...buildFullKeyboard(s.tab, products.length, s.page, PER_PAGE) });
      } else if (s.tab === 'stok') {
        await ctx.editMessageText(renderStok(products, s.page, PER_PAGE), { parse_mode: 'Markdown', ...buildFullKeyboard(s.tab, products.length, s.page, PER_PAGE) });
      } else {
        await ctx.editMessageText(renderVoucher(), { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buildTabs(s.tab)) });
      }
      return ctx.answerCbQuery();
    }

    // Buka detail item + init qty = 1
    if (data.startsWith('item:')) {
      const [, globalStr, pageStr] = data.split(':');
      const globalIndex = Number(globalStr);
      const originPage = Number(pageStr) || s.page;

      s.detail = { idx: globalIndex, qty: 1, page: originPage };

      const p = products[globalIndex - 1];
      const text = renderDetail(products, globalIndex, s.detail.qty);
      const backCb = `back:${s.tab}:${originPage}`;
      const buyCb = p?.kode ? `buynow:${p.kode}:${s.detail.qty}` : 'noop:p';

      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('➖', `qty:-:${globalIndex}:${originPage}`),
            Markup.button.callback('🔄', `refresh:${globalIndex}:${originPage}`),
            Markup.button.callback('➕', `qty:+:${globalIndex}:${originPage}`),
          ],
          [Markup.button.callback(`🛒 Buy Now ( ${s.detail.qty} )`, buyCb)],
          [Markup.button.callback('⬅️ Kembali', backCb)],
        ])
      });
      return ctx.answerCbQuery();
    }

    // qty +/- : qty:+:<idx>:<page> atau qty:-:<idx>:<page>
    if (data.startsWith('qty:')) {
      const [, op, idxStr, pageStr] = data.split(':');
      const idx = Number(idxStr);
      const page = Number(pageStr) || 1;
      const p = products[idx - 1];
      if (!p) return ctx.answerCbQuery('Produk tidak ditemukan');

      if (!s.detail || s.detail.idx !== idx) s.detail = { idx, qty: 1, page };
      let qty = s.detail.qty || 1;

      qty = op === '+' ? qty + 1 : qty - 1;
      if (qty < 1) qty = 1;
      if (typeof p.stok === 'number' && p.stok >= 0) qty = Math.min(qty, Math.max(1, p.stok));

      s.detail.qty = qty;

      const text = renderDetail(products, idx, qty);
      const backCb = `back:${s.tab}:${page}`;
      const buyCb = p?.kode ? `buynow:${p.kode}:${qty}` : 'noop:p';

      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('➖', `qty:-:${idx}:${page}`),
            Markup.button.callback('🔄', `refresh:${idx}:${page}`),
            Markup.button.callback('➕', `qty:+:${idx}:${page}`),
          ],
          [Markup.button.callback(`🛒 Buy Now ( ${qty} )`, buyCb)],
          [Markup.button.callback('⬅️ Kembali', backCb)],
        ])
      });
      return ctx.answerCbQuery();
    }

    // refresh stok/produk dari sheet lalu render ulang
    if (data.startsWith('refresh:')) {
      const [, idxStr, pageStr] = data.split(':');
      const idx = Number(idxStr);
      const page = Number(pageStr) || 1;

      await ensureProductsLoaded({ force: true });
      const p = PRODUCTS[idx - 1];
      const qty = s.detail?.qty || 1;

      const text = renderDetail(PRODUCTS, idx, qty);
      const backCb = `back:${s.tab}:${page}`;
      const buyCb = p?.kode ? `buynow:${p.kode}:${qty}` : 'noop:p';

      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('➖', `qty:-:${idx}:${page}`),
            Markup.button.callback('🔄', `refresh:${idx}:${page}`),
            Markup.button.callback('➕', `qty:+:${idx}:${page}`),
          ],
          [Markup.button.callback(`🛒 Buy Now ( ${qty} )`, buyCb)],
          [Markup.button.callback('⬅️ Kembali', backCb)],
        ])
      });
      return ctx.answerCbQuery('Stok diperbarui');
    }

    if (data.startsWith('back:')) {
      await ensureProductsLoaded();
      const [, tabKey, pageStr] = data.split(':'); s.tab = tabKey; s.page = Number(pageStr) || 1;
      if (s.tab === 'list') {
        await ctx.editMessageText(renderList(products, s.page, PER_PAGE), { parse_mode: 'Markdown', ...buildFullKeyboard(s.tab, products.length, s.page, PER_PAGE) });
      } else if (s.tab === 'stok') {
        await ctx.editMessageText(renderStok(products, s.page, PER_PAGE), { parse_mode: 'Markdown', ...buildFullKeyboard(s.tab, products.length, s.page, PER_PAGE) });
      } else {
        await ctx.editMessageText(renderVoucher(), { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buildTabs(s.tab)) });
      }
      return ctx.answerCbQuery();
    }

    return ctx.answerCbQuery();
  } catch (e) {
    console.error('CBQ error:', e);
    try { await ctx.answerCbQuery('Terjadi kesalahan'); } catch {}
  }
});

// ====== Launch ======
// ====== Launch (Webhook mode, single Express app) ======
import express from 'express';

const PORT = Number(process.env.HTTP_PORT || 3000);
const domain = 'https://bot-pbs.putrabttstorebot.my.id';
const hookPath = '/telegram/webhook';
const webhookUrl = `${domain}${hookPath}`;
const REFRESH_KEY = 'JANGAN_LUPA_MAKAN'; // samakan dengan Apps Script

const app = express();
app.use(express.json({ type: ['application/json', 'application/*+json'] }));

// no-cache (jaga-jaga)
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// --- status
app.get('/status', (_req, res) =>
  res.json({ ok: true, products: PRODUCTS.length, last: new Date(LAST_PRODUCTS_AT).toISOString() })
);

// --- refresh produk (GET/POST) → force load
async function doRefresh(req, res) {
  try {
    const key = req.get('x-refresh-key') || req.query.key || '';
    if (key !== REFRESH_KEY) return res.status(401).json({ ok: false, error: 'unauthorized' });

    console.log('[REFRESH] Triggered by webhook...');
    await loadProducts(true); // paksa ambil terbaru (abaikan TTL)
    res.json({ ok: true, products: PRODUCTS.length, at: new Date().toISOString() });
  } catch (e) {
    console.error('[REFRESH ERROR]', e);
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
app.get('/products/refresh', doRefresh);
app.post('/products/refresh', doRefresh);

// --- webhook Midtrans
app.post('/midtrans/notify', async (req, res) => {
  try {
    const sig = req.get('x-signature') || req.get('X-Signature') || req.get('X-Midtrans-Signature-Key');
    const bodyStr = JSON.stringify(req.body || {});
    if (!verifyMidtransSignature?.(sig, bodyStr)) {
      console.warn('[WEBHOOK] signature invalid');
      return res.status(401).json({ ok: false });
    }

    const ev = req.body || {};
    const order_id = String(ev.order_id || ev?.orderId || '');
    const status = (ev.transaction_status || ev.transactionStatus || '').toLowerCase();
    console.log('[WEBHOOK]', order_id, status);
    if (!order_id) return res.json({ ok: true });

    if (status === 'settlement' || status === 'capture') {
      const o = ORDERS[order_id];
      const gross_amount = Math.round(Number(ev.gross_amount || ev.grossAmount || 0));
      if (o) {
        const prod = byKode(o.kode) || (searchProducts(o.kode)[0]);
        await fulfillAndSend(bot.telegram, order_id, prod, gross_amount || ((Number(prod?.harga) || 0) * (o.qty || 1)));
      } else {
        await finalizeStock({ order_id, total: Number(ev.gross_amount || ev.grossAmount || 0) }).catch(() => {});
      }
    } else if (['expire', 'cancel', 'deny'].includes(status)) {
      await releaseStock({ order_id, reason: status }).catch(() => {});
      const o = ORDERS[order_id];
      if (o) {
        if (o.qrMsgId) { try { await bot.telegram.deleteMessage(o.chatId, o.qrMsgId); } catch {} }
        await bot.telegram.sendMessage(o.chatId, `❌ Order #${order_id} ${status}.`);
        delete ORDERS[order_id];
      }
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error('[WEBHOOK] error', e);
    return res.status(500).json({ ok: false });
  }
});

// --- Telegram webhook wiring
// --- Telegram webhook wiring
(async () => {
  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch(() => {});
    await bot.telegram.setWebhook(webhookUrl, { drop_pending_updates: true });
    console.log(`[OK] Webhook set ke ${webhookUrl}`);

    app.use(bot.webhookCallback(hookPath));          // <-- handler telegraf
    // (opsional) status
    app.get('/status', (_req, res) => res.json({ ok:true, products: PRODUCTS.length }));

    // ===== Admin endpoints (dipanggil dari Apps Script) =====
    const ADMIN_WEBHOOK_SECRET = 'supersecret-bot';   // == BOT_SECRET di kode.gs

    app.post('/admin/reload', async (req, res) => {
      try {
        const body = req.body || {};
        if (body.secret !== ADMIN_WEBHOOK_SECRET) {
          return res.status(401).json({ ok:false, error:'unauthorized' });
        }
        await refreshProductsFromSource(); // paksa ambil terbaru
        console.log('[ADMIN/RELOAD]', body?.what || '-', body?.note || '');
        res.json({ ok:true, products: PRODUCTS.length, at: new Date().toISOString() });
      } catch (e) {
        console.error('[ADMIN/RELOAD] err', e);
        res.status(500).json({ ok:false, error:String(e?.message || e) });
      }
    });

    app.post('/admin/lowstock', async (req, res) => {
      try {
        const body = req.body || {};
        if (body.secret !== ADMIN_WEBHOOK_SECRET) {
          return res.status(401).json({ ok:false, error:'unauthorized' });
        }
        const items = Array.isArray(body.items) ? body.items : [];
        console.log('[ADMIN/LOWSTOCK]', items);

        // (opsional) kirim ke owner
        // const OWNER_CHAT_ID = 1099822426;
        // if (OWNER_CHAT_ID && items.length) {
        //   const txt = '*LOW STOCK ALERT*\n' + items.map(i => `• ${i.kode}: ready ${i.ready}`).join('\n');
        //   await bot.telegram.sendMessage(OWNER_CHAT_ID, txt, { parse_mode: 'Markdown' });
        // }
        // res.json({ ok:true, count: items.length });
      } catch (e) {
        res.status(500).json({ ok:false, error:String(e?.message || e) });
      }
    });

    // --- terakhir: nyalakan server
    app.listen(PORT, async () => {
      await ensureProductsLoaded({ force: true });
      console.log(`[HTTP] listening on :${PORT}`);
      console.log(`[OK] PBS Telegram bot berjalan di mode Webhook`);
    });
  } catch (e) {
    console.error('[WEBHOOK SETUP ERROR]', e);
  }
})();



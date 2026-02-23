// src/bot/handlers/commands.js
import { BOT_CONFIG } from '../config.js';
import { 
  getUserSession, 
  updateUserSession,
  checkRateLimit,
  getUserFavorites,
  getUserPurchaseHistory,
  recordSearchQuery,
} from '../state.js';
import {
  formatHelp,
  formatProductList,
  formatCategoryList,
  formatFavorites,
  formatPurchaseHistory,
  getBannerUrl,
} from '../formatters.js';
import {
  mainMenuKeyboard,
  productGridKeyboard,
  categoryKeyboard,
  favoritesKeyboard,
  historyKeyboard,
} from '../keyboards.js';
import { searchProducts, categories, getAll as getAllProducts } from '../../data/products.js';
import { handlePurchase } from './purchase.js';
import { upsertUser, updateUserActivity } from '../../database/users.js';

/**
 * Start command
 */
export async function handleStart(ctx) {
  const userId = ctx.from.id;
  const userName = ctx.from.first_name || 'User';
  
  // Save user to database
  try {
    await upsertUser({
      user_id: String(userId),
      username: ctx.from.username,
      first_name: ctx.from.first_name,
      last_name: ctx.from.last_name,
      language: ctx.from.language_code || 'id',
    });
  } catch (error) {
    console.error('[START] Failed to save user:', error);
  }
  
  updateUserSession(userId, { currentTab: 'catalog', currentPage: 1 });
  
  const welcomeText = [
    `👋 Selamat datang *${userName}*!`,
    '',
    `🏪 *${BOT_CONFIG.STORE_NAME}*`,
    BOT_CONFIG.STORE_DESCRIPTION,
    '',
    '✨ Kami menyediakan berbagai produk digital berkualitas:',
    '🎬 Streaming (Netflix, Disney+, dll)',
    '🎨 Software & Tools',
    '🎮 Gaming',
    '📚 E-Learning',
    'dan masih banyak lagi!',
    '',
    '💡 Gunakan tombol di bawah untuk mulai berbelanja',
    'atau ketik /help untuk bantuan',
  ].join('\n');
  
  await ctx.replyWithMarkdown(welcomeText, mainMenuKeyboard());
}

/**
 * Help command
 */
export async function handleHelp(ctx) {
  // Track user activity
  try {
    await updateUserActivity(String(ctx.from.id));
  } catch (error) {
    console.error('[HELP] Failed to update user activity:', error);
  }
  
  await ctx.replyWithMarkdown(formatHelp(), mainMenuKeyboard());
}

/**
 * Menu/Catalog command
 */
export async function handleMenu(ctx) {
  const userId = ctx.from.id;
  
  // Track user activity
  try {
    await updateUserActivity(String(userId));
  } catch (error) {
    console.error('[MENU] Failed to update user activity:', error);
  }
  
  if (!checkRateLimit(userId, BOT_CONFIG.USER_COOLDOWN_MS)) {
    return ctx.answerCbQuery?.('⏳ Tunggu sebentar...') || ctx.reply('⏳ Tunggu sebentar...');
  }
  
  const session = getUserSession(userId);
  const products = getAllProducts();
  
  if (products.length === 0) {
    return ctx.reply('❌ Belum ada produk tersedia. Silakan coba lagi nanti.');
  }
  
  const page = session.currentPage || 1;
  const perPage = BOT_CONFIG.ITEMS_PER_PAGE;
  const start = (page - 1) * perPage;
  const pageProducts = products.slice(start, start + perPage);
  
  const text = formatProductList(pageProducts, page, perPage, products.length);
  const keyboard = productGridKeyboard(products.length, page, perPage);
  const bannerUrl = getBannerUrl();
  
  if (ctx.callbackQuery) {
    // Jika update dari callback query (pagination)
    if (bannerUrl) {
      try {
        await ctx.editMessageMedia(
          {
            type: 'photo',
            media: bannerUrl,
            caption: text,
            parse_mode: 'Markdown',
          },
          keyboard
        );
      } catch (error) {
        // Jika edit media gagal, fallback ke edit text
        console.warn('[MENU] Edit media failed, using text fallback:', error.message);
        await ctx.editMessageText(text, { 
          parse_mode: 'Markdown', 
          ...keyboard,
        });
      }
    } else {
      await ctx.editMessageText(text, { 
        parse_mode: 'Markdown', 
        ...keyboard,
      });
    }
    await ctx.answerCbQuery();
  } else {
    // Jika reply baru
    if (bannerUrl) {
      try {
        // Kirim foto dengan caption (1 bubble)
        await ctx.replyWithPhoto(bannerUrl, {
          caption: text,
          parse_mode: 'Markdown',
          ...keyboard,
        });
      } catch (error) {
        console.warn('[MENU] Failed to send banner photo with caption:', error.message);
        // Fallback: kirim text biasa jika foto gagal
        await ctx.replyWithMarkdown(text, keyboard);
      }
    } else {
      // Jika tidak ada banner, kirim text biasa
      await ctx.replyWithMarkdown(text, keyboard);
    }
  }
}

/**
 * Search command
 */
export async function handleSearch(ctx) {
  const userId = ctx.from.id;
  const query = ctx.message?.text?.replace(/^\/search\s*/i, '').trim();
  
  if (!query || query.length < BOT_CONFIG.SEARCH_MIN_LENGTH) {
    return ctx.reply(
      `🔍 *Pencarian Produk*\n\nKirim pesan dengan format:\n/search <kata kunci>\n\nContoh:\n/search netflix\n/search canva`,
      { parse_mode: 'Markdown' }
    );
  }
  
  if (!checkRateLimit(userId, BOT_CONFIG.USER_COOLDOWN_MS)) {
    return ctx.reply('⏳ Tunggu sebentar...');
  }
  
  recordSearchQuery(query);
  
  const results = searchProducts(query);
  
  if (results.length === 0) {
    return ctx.replyWithMarkdown(
      `❌ Tidak ditemukan produk untuk: *${query}*\n\n` +
      `💡 Tips pencarian:\n` +
      `• Coba kata kunci lebih pendek\n` +
      `• Gunakan nama produk atau kategori\n` +
      `• Gunakan /categories untuk lihat kategori\n` +
      `• Gunakan /menu untuk lihat semua produk`
    );
  }
  
  // Store search results in session
  updateUserSession(userId, { 
    searchResults: results,
    searchQuery: query,
  });
  
  const { formatSearchResults } = await import('../formatters.js');
  const { searchResultsKeyboard } = await import('../keyboards.js');
  
  const text = formatSearchResults(results, query);
  const keyboard = searchResultsKeyboard(results.length);
  
  await ctx.replyWithMarkdown(text, keyboard);
}

/**
 * Categories command
 */
export async function handleCategories(ctx) {
  const userId = ctx.from.id;
  
  if (!checkRateLimit(userId, BOT_CONFIG.USER_COOLDOWN_MS)) {
    if (ctx.callbackQuery) {
      return ctx.answerCbQuery('⏳ Tunggu sebentar...');
    }
    return ctx.reply('⏳ Tunggu sebentar...');
  }
  
  const cats = categories();
  
  if (cats.length === 0) {
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery('❌ Belum ada kategori tersedia.');
    }
    return ctx.reply('❌ Belum ada kategori tersedia.');
  }
  
  const text = formatCategoryList(cats);
  const keyboard = categoryKeyboard(cats);
  
  if (ctx.callbackQuery) {
    await ctx.answerCbQuery();
    await ctx.editMessageText(text, { 
      parse_mode: 'Markdown', 
      ...keyboard,
    });
  } else {
    await ctx.replyWithMarkdown(text, keyboard);
  }
}

/**
 * Favorites command
 */
export async function handleFavorites(ctx) {
  const userId = ctx.from.id;
  
  const favCodes = getUserFavorites(userId);
  const allProducts = getAllProducts();
  const favProducts = allProducts.filter(p => favCodes.has(p.kode));
  
  const text = formatFavorites(favProducts);
  const keyboard = favoritesKeyboard(favProducts.length);
  
  updateUserSession(userId, { favoriteProducts: favProducts });
  
  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { 
      parse_mode: 'Markdown', 
      ...keyboard,
    });
    await ctx.answerCbQuery();
  } else {
    await ctx.replyWithMarkdown(text, keyboard);
  }
}

/**
 * Purchase history command
 */
export async function handleHistory(ctx) {
  const userId = ctx.from.id;
  
  const orders = getUserPurchaseHistory(userId);
  const allProducts = getAllProducts();
  
  const text = formatPurchaseHistory(orders, allProducts);
  const keyboard = historyKeyboard();
  
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, { 
        parse_mode: 'Markdown', 
        ...keyboard,
      });
    } catch (error) {
      // Handle "message is not modified" error gracefully
      if (error.message?.includes('message is not modified') || error.description?.includes('message is not modified')) {
        await ctx.answerCbQuery('ℹ️ Tidak ada perubahan');
      } else {
        throw error;
      }
    }
    await ctx.answerCbQuery();
  } else {
    await ctx.replyWithMarkdown(text, keyboard);
  }
}

/**
 * Buy command - Direct purchase
 */
export async function handleBuyCommand(ctx) {
  const parts = ctx.message.text.trim().split(/\s+/);
  
  if (parts.length < 2) {
    return ctx.reply(
      '📦 *Format Pembelian:*\n\n' +
      '/buy <kode> <jumlah>\n\n' +
      'Contoh:\n' +
      '/buy CC1B 1\n' +
      '/buy NETF1B 2',
      { parse_mode: 'Markdown' }
    );
  }
  
  const productCode = parts[1].toUpperCase();
  const quantity = parseInt(parts[2]) || 1;
  
  if (quantity < 1 || quantity > 999) {
    return ctx.reply('❌ Jumlah harus antara 1 - 999');
  }
  
  await handlePurchase(ctx, productCode, quantity);
}

/**
 * Status command - Check order status
 */
export async function handleStatus(ctx) {
  const parts = ctx.message.text.trim().split(/\s+/);
  
  if (parts.length < 2) {
    return ctx.reply(
      '📋 *Cek Status Order:*\n\n' +
      '/status <order_id>\n\n' +
      'Contoh:\n' +
      '/status PBS-1234567890',
      { parse_mode: 'Markdown' }
    );
  }
  
  const orderId = parts[1];
  
  try {
    const { midtransStatus } = await import('../../payments/midtrans.js');
    const status = await midtransStatus(orderId);
    
    const statusText = [
      '📋 *STATUS ORDER*',
      '━━━━━━━━━━━━━━━━━━━━',
      `🆔 Order ID: \`${orderId}\``,
      `📊 Status: *${status.transaction_status}*`,
      `💵 Amount: ${status.gross_amount}`,
      `⏰ Time: ${status.transaction_time}`,
    ].join('\n');
    
    await ctx.replyWithMarkdown(statusText);
  } catch (error) {
    await ctx.reply(`❌ Order ${orderId} tidak ditemukan atau terjadi kesalahan.`);
  }
}

/**
 * Handle text messages (quick buy or search)
 */
export async function handleTextMessage(ctx) {
  const text = ctx.message.text.trim();
  const userId = ctx.from.id;
  
  // Check for quick buy pattern: "CODE QTY" or "CODE"
  const quickBuyMatch = text.match(/^([A-Z0-9]{3,10})\s+(\d{1,3})$/i);
  if (quickBuyMatch) {
    const [, code, qty] = quickBuyMatch;
    return handlePurchase(ctx, code.toUpperCase(), parseInt(qty));
  }
  
  // Check for single code pattern
  const singleCodeMatch = text.match(/^([A-Z0-9]{3,10})$/i);
  if (singleCodeMatch) {
    const code = singleCodeMatch[1].toUpperCase();
    const { byKode } = await import('../../data/products.js');
    const product = byKode(code);
    
    if (product) {
      return handlePurchase(ctx, code, 1);
    }
  }
  
  // If text is longer than 2 chars, treat as search
  if (text.length >= BOT_CONFIG.SEARCH_MIN_LENGTH && !text.startsWith('/')) {
    if (!checkRateLimit(userId, BOT_CONFIG.USER_COOLDOWN_MS)) {
      return;
    }
    
    recordSearchQuery(text);
    const results = searchProducts(text);
    
    if (results.length === 0) {
      return ctx.reply(
        `❌ Tidak ditemukan: "${text}"\n\n` +
        `Gunakan /menu untuk lihat katalog atau /help untuk bantuan`
      );
    }
    
    updateUserSession(userId, { 
      searchResults: results,
      searchQuery: text,
    });
    
    const { formatSearchResults } = await import('../formatters.js');
    const { searchResultsKeyboard } = await import('../keyboards.js');
    
    await ctx.replyWithMarkdown(
      formatSearchResults(results, text),
      searchResultsKeyboard(results.length)
    );
  }
}

// src/bot/handlers/callbacks.js
import { 
  getUserSession, 
  updateUserSession,
  addToFavorites,
  removeFromFavorites,
  isFavorited,
  recordProductView,
} from '../state.js';
import { formatProductDetail } from '../formatters.js';
import { productDetailKeyboard, mainMenuKeyboard } from '../keyboards.js';
import { getAll as getAllProducts, byKode } from '../../data/products.js';
import { loadProducts } from '../../data/products.js';
import { handleMenu, handleCategories, handleFavorites, handleHistory } from './commands.js';
import { handlePurchase, cancelOrder } from './purchase.js';

/**
 * Handle all callback queries
 */
export async function handleCallbackQuery(ctx) {
  const data = ctx.callbackQuery.data;
  const userId = ctx.from.id;
  
  try {
    // Route to appropriate handler based on callback data
    const [action, ...params] = data.split(':');
    
    switch (action) {
      case 'menu':
        await handleMenuCallback(ctx, params);
        break;
      case 'tab':
        await handleTabCallback(ctx, params);
        break;
      case 'page':
        await handlePageCallback(ctx, params);
        break;
      case 'view':
        await handleViewCallback(ctx, params);
        break;
      case 'qty':
        await handleQuantityCallback(ctx, params);
        break;
      case 'buy':
        await handleBuyCallback(ctx, params);
        break;
      case 'fav':
        await handleFavoriteCallback(ctx, params);
        break;
      case 'cat':
        await handleCategoryCallback(ctx, params);
        break;
      case 'refresh':
        await handleRefreshCallback(ctx, params);
        break;
      case 'back':
        await handleBackCallback(ctx, params);
        break;
      case 'check':
        await handleCheckStatusCallback(ctx, params);
        break;
      case 'cancel':
        await handleCancelCallback(ctx, params);
        break;
      case 'admin':
        await handleAdminCallback(ctx, params);
        break;
      default:
        await ctx.answerCbQuery('Action not implemented');
    }
  } catch (error) {
    console.error('[CALLBACK ERROR]', error);
    await ctx.answerCbQuery('Terjadi kesalahan, silakan coba lagi');
  }
}

/**
 * Menu callbacks
 */
async function handleMenuCallback(ctx, params) {
  const [menuType] = params;
  
  if (menuType === 'main') {
    await handleMenu(ctx);
  }
}

/**
 * Tab callbacks (for catalog tabs)
 */
async function handleTabCallback(ctx, params) {
  const [tab, page] = params;
  const userId = ctx.from.id;
  
  updateUserSession(userId, { 
    currentTab: tab,
    currentPage: parseInt(page) || 1,
  });
  
  await handleMenu(ctx);
}

/**
 * Page navigation callbacks
 */
async function handlePageCallback(ctx, params) {
  const [page] = params;
  const userId = ctx.from.id;
  
  if (page === 'current') {
    return ctx.answerCbQuery();
  }
  
  const pageNum = parseInt(page);
  updateUserSession(userId, { currentPage: pageNum });
  
  await handleMenu(ctx);
}

/**
 * View product callbacks
 */
async function handleViewCallback(ctx, params) {
  const [source, index] = params;
  const userId = ctx.from.id;
  const session = getUserSession(userId);
  
  let product;
  let originPage = session.currentPage || 1;
  
  if (source === 'search') {
    // View from search results
    const idx = parseInt(index);
    product = session.searchResults?.[idx];
  } else if (source === 'fav') {
    // View from favorites
    const idx = parseInt(index);
    product = session.favoriteProducts?.[idx];
  } else {
    // View from catalog
    const globalIndex = parseInt(source);
    originPage = parseInt(index);
    const allProducts = getAllProducts();
    product = allProducts[globalIndex - 1];
  }
  
  if (!product) {
    return ctx.answerCbQuery('Produk tidak ditemukan');
  }
  
  // Record view
  recordProductView(product.kode);
  
  // Update session
  updateUserSession(userId, {
    selectedProduct: product,
    selectedQuantity: 1,
    originPage,
  });
  
  const quantity = 1;
  const text = formatProductDetail(product, quantity);
  const favorite = isFavorited(userId, product.kode);
  const keyboard = productDetailKeyboard(product.kode, quantity, favorite, originPage);
  
  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    ...keyboard,
  });
  
  await ctx.answerCbQuery();
}

/**
 * Quantity adjustment callbacks
 */
async function handleQuantityCallback(ctx, params) {
  const [operation, productCode, originPage] = params;
  const userId = ctx.from.id;
  const session = getUserSession(userId);
  
  if (operation === 'current') {
    return ctx.answerCbQuery();
  }
  
  const product = session.selectedProduct || byKode(productCode);
  if (!product) {
    return ctx.answerCbQuery('Produk tidak ditemukan');
  }
  
  let quantity = session.selectedQuantity || 1;
  
  if (operation === 'inc') {
    quantity++;
  } else if (operation === 'dec') {
    quantity = Math.max(1, quantity - 1);
  }
  
  // Check stock limit
  if (product.stok !== null && product.stok !== undefined && product.stok !== '') {
    const availableStock = Number(product.stok);
    if (quantity > availableStock) {
      return ctx.answerCbQuery(`⚠️ Stok hanya tersedia ${availableStock}`);
    }
  }
  
  // Limit max quantity
  if (quantity > 999) {
    return ctx.answerCbQuery('❌ Maksimal 999 item');
  }
  
  updateUserSession(userId, { selectedQuantity: quantity });
  
  const text = formatProductDetail(product, quantity);
  const favorite = isFavorited(userId, product.kode);
  const keyboard = productDetailKeyboard(product.kode, quantity, favorite, parseInt(originPage));
  
  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    ...keyboard,
  });
  
  await ctx.answerCbQuery();
}

/**
 * Buy callbacks
 */
async function handleBuyCallback(ctx, params) {
  const [productCode, quantity] = params;
  
  await ctx.answerCbQuery();
  await handlePurchase(ctx, productCode, parseInt(quantity));
}

/**
 * Favorite callbacks
 */
async function handleFavoriteCallback(ctx, params) {
  const [operation, productCode, originPage] = params;
  const userId = ctx.from.id;
  const session = getUserSession(userId);
  
  if (operation === 'toggle') {
    const favorite = isFavorited(userId, productCode);
    
    if (favorite) {
      removeFromFavorites(userId, productCode);
      await ctx.answerCbQuery('💔 Dihapus dari favorit');
    } else {
      addToFavorites(userId, productCode);
      await ctx.answerCbQuery('⭐ Ditambahkan ke favorit');
    }
    
    // Update keyboard
    const product = session.selectedProduct || byKode(productCode);
    const quantity = session.selectedQuantity || 1;
    const newFavorite = isFavorited(userId, productCode);
    const keyboard = productDetailKeyboard(productCode, quantity, newFavorite, parseInt(originPage));
    
    await ctx.editMessageReplyMarkup(keyboard.reply_markup);
    
  } else if (operation === 'clearall') {
    // Implement clear all favorites with confirmation
    await ctx.answerCbQuery('Fitur dalam pengembangan');
  }
}

/**
 * Category callbacks
 */
async function handleCategoryCallback(ctx, params) {
  const [category] = params;
  const userId = ctx.from.id;
  
  if (category === 'all') {
    updateUserSession(userId, { currentCategory: null, currentPage: 1 });
    await handleMenu(ctx);
  } else {
    updateUserSession(userId, { currentCategory: category, currentPage: 1 });
    // Filter products by category and show
    const allProducts = getAllProducts();
    const filtered = allProducts.filter(p => p.kategori === category);
    
    // Store filtered products in session
    updateUserSession(userId, { filteredProducts: filtered });
    
    // Show filtered catalog
    await handleMenu(ctx);
  }
}

/**
 * Refresh callbacks
 */
async function handleRefreshCallback(ctx, params) {
  const [type, ...extra] = params;
  
  if (type === 'catalog') {
    await loadProducts(true); // Force reload
    await ctx.answerCbQuery('✅ Katalog diperbarui');
    await handleMenu(ctx);
  } else if (type === 'product') {
    const [productCode, originPage] = extra;
    await loadProducts(true);
    
    const product = byKode(productCode);
    if (!product) {
      return ctx.answerCbQuery('Produk tidak ditemukan');
    }
    
    const userId = ctx.from.id;
    const session = getUserSession(userId);
    const quantity = session.selectedQuantity || 1;
    
    updateUserSession(userId, { selectedProduct: product });
    
    const text = formatProductDetail(product, quantity);
    const favorite = isFavorited(userId, productCode);
    const keyboard = productDetailKeyboard(productCode, quantity, favorite, parseInt(originPage));
    
    try {
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...keyboard,
      });
      await ctx.answerCbQuery('✅ Stok diperbarui');
    } catch (error) {
      // Ignore "message is not modified" error
      if (error.description?.includes('message is not modified')) {
        await ctx.answerCbQuery('✅ Produk sudah terbaru');
      } else {
        throw error;
      }
    }
  } else if (type === 'history') {
    await ctx.answerCbQuery('✅ Riwayat diperbarui');
    await handleHistory(ctx);
  }
}

/**
 * Back callbacks
 */
async function handleBackCallback(ctx, params) {
  const [destination, page] = params;
  const userId = ctx.from.id;
  
  if (destination === 'catalog') {
    updateUserSession(userId, { currentPage: parseInt(page) || 1 });
    await handleMenu(ctx);
  } else if (destination === 'categories') {
    await handleCategories(ctx);
  }
}

/**
 * Check order status callbacks
 */
async function handleCheckStatusCallback(ctx, params) {
  const [orderId] = params;
  
  try {
    const { midtransStatus } = await import('../../payments/midtrans.js');
    const status = await midtransStatus(orderId);
    
    await ctx.answerCbQuery(`Status: ${status.transaction_status}`);
  } catch {
    await ctx.answerCbQuery('❌ Gagal cek status');
  }
}

/**
 * Cancel order callbacks
 */
async function handleCancelCallback(ctx, params) {
  const [orderId] = params;
  
  if (orderId && orderId !== 'action') {
    await cancelOrder(ctx, orderId);
  } else {
    await ctx.answerCbQuery('Dibatalkan');
  }
}

/**
 * Admin callbacks
 */
async function handleAdminCallback(ctx, params) {
  const { default: handleAdminAction } = await import('./admin.js');
  await handleAdminAction(ctx, params);
}

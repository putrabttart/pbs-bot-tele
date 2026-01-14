// src/bot/handlers/admin.js
import { BOT_CONFIG } from '../config.js';
import { getAnalyticsSummary, USER_SESSIONS, ACTIVE_ORDERS } from '../state.js';
import { formatAdminDashboard, formatAdminHelp, formatCurrency } from '../formatters.js';
import { adminDashboardKeyboard } from '../keyboards.js';
import { loadProducts } from '../../data/products.js';

/**
 * Check if user is admin
 */
function isAdmin(userId) {
  return BOT_CONFIG.TELEGRAM_ADMIN_IDS.includes(userId);
}

/**
 * Admin command handler
 */
export async function handleAdminCommand(ctx) {
  const userId = ctx.from.id;
  
  if (!isAdmin(userId)) {
    return ctx.reply('❌ Anda tidak memiliki akses admin');
  }
  
  const args = ctx.message.text.split(/\s+/).slice(1);
  const command = args[0]?.toLowerCase();
  
  if (!command || command === 'dashboard') {
    const stats = getAnalyticsSummary();
    const text = formatAdminDashboard(stats);
    await ctx.replyWithMarkdown(text, adminDashboardKeyboard());
    return;
  }
  
  switch (command) {
    case 'help':
      await ctx.replyWithMarkdown(formatAdminHelp());
      break;
      
    case 'refresh':
      await handleAdminRefresh(ctx);
      break;
      
    case 'stats':
      await handleAdminStats(ctx, args.slice(1));
      break;
      
    case 'topproducts':
      await handleAdminTopProducts(ctx);
      break;
      
    case 'users':
      await handleAdminUsers(ctx);
      break;
      
    case 'orders':
      await handleAdminOrders(ctx);
      break;
      
    case 'health':
      await handleAdminHealth(ctx);
      break;
      
    case 'broadcast':
      await handleAdminBroadcast(ctx, args.slice(1));
      break;
      
    case 'settings':
      await handleAdminSettings(ctx, args.slice(1));
      break;
      
    case 'backup':
      await handleAdminBackup(ctx, args.slice(1));
      break;
      
    case 'restore':
      await handleAdminRestore(ctx, args.slice(1));
      break;
      
    default:
      await ctx.reply(`❌ Command tidak dikenal: ${command}\n\nGunakan /admin help untuk bantuan`);
  }
}

/**
 * Admin refresh products
 */
async function handleAdminRefresh(ctx) {
  try {
    await ctx.reply('⏳ Memuat ulang data produk...');
    await loadProducts(true);
    
    const { getAll } = await import('../../data/products.js');
    const products = getAll();
    
    await ctx.reply(`✅ Data produk berhasil dimuat ulang!\n\nTotal: ${products.length} produk`);
  } catch (error) {
    console.error('[ADMIN REFRESH ERROR]', error);
    await ctx.reply('❌ Gagal memuat ulang data produk');
  }
}

/**
 * Admin statistics
 */
async function handleAdminStats(ctx, args) {
  try {
    const stats = getAnalyticsSummary();
    const period = args[0] || 'all';
    
    // Get total users from Supabase
    const { supabase } = await import('../../database/supabase.js');
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    const totalUsers = error ? USER_SESSIONS.size : (count || 0);
    
    const text = [
      '📊 *STATISTIK LENGKAP*',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      '💰 *Revenue*',
      `• Total Orders: ${stats.totalOrders}`,
      `• Total Revenue: ${formatCurrency(stats.totalRevenue)}`,
      `• Avg Order Value: ${formatCurrency(stats.totalOrders > 0 ? stats.totalRevenue / stats.totalOrders : 0)}`,
      '',
      '👥 *Users*',
      `• Active Sessions: ${stats.activeUsers}`,
      `• Total Users: ${totalUsers}`,
      '',
      '📦 *Products*',
      `• Total Views: ${Array.from(stats.topProducts).reduce((sum, [, views]) => sum + views, 0)}`,
      `• Unique Products Viewed: ${stats.topProducts.length}`,
      '',
      '🔍 *Searches*',
      `• Total Searches: ${Array.from(stats.topSearches).reduce((sum, [, count]) => sum + count, 0)}`,
      `• Unique Queries: ${stats.topSearches.length}`,
    ].join('\n');
    
    await ctx.replyWithMarkdown(text);
  } catch (error) {
    console.error('[ADMIN STATS ERROR]', error);
    // Fallback to in-memory stats
    const stats = getAnalyticsSummary();
    const text = [
      '📊 *STATISTIK LENGKAP*',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      '💰 *Revenue*',
      `• Total Orders: ${stats.totalOrders}`,
      `• Total Revenue: ${formatCurrency(stats.totalRevenue)}`,
      '',
      '👥 *Users*',
      `• Active Sessions: ${stats.activeUsers}`,
      '',
      '⚠️ _Using in-memory data (DB error)_',
    ].join('\n');
    await ctx.replyWithMarkdown(text);
  }
}

/**
 * Admin top products
 */
async function handleAdminTopProducts(ctx) {
  const stats = getAnalyticsSummary();
  const { getAll } = await import('../../data/products.js');
  const allProducts = getAll();
  
  const text = [
    '🔥 *TOP PRODUCTS*',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    ...stats.topProducts.slice(0, 15).map(([code, views], i) => {
      const product = allProducts.find(p => p.kode === code);
      const name = product?.nama || code;
      return `${i + 1}. *${name}*\n   ${views} views • ${formatCurrency(product?.harga || 0)}`;
    }),
  ].join('\n');
  
  await ctx.replyWithMarkdown(text);
}

/**
 * Admin users info
 */
async function handleAdminUsers(ctx) {
  try {
    // Get users from Supabase instead of in-memory sessions
    const { supabase } = await import('../../database/supabase.js');
    
    const now = Date.now();
    const fiveMinAgo = now - 5 * 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    
    // Query users from database
    const { data: allUsers, error } = await supabase
      .from('users')
      .select('user_id, last_activity');
    
    if (error) throw error;
    
    const totalUsers = allUsers?.length || 0;
    let active5min = 0;
    let active1hour = 0;
    let active1day = 0;
    
    if (allUsers) {
      for (const user of allUsers) {
        if (!user.last_activity) continue;
        const lastActivity = new Date(user.last_activity).getTime();
        
        if (lastActivity > fiveMinAgo) active5min++;
        if (lastActivity > oneHourAgo) active1hour++;
        if (lastActivity > oneDayAgo) active1day++;
      }
    }
    
    const text = [
      '👥 *USER ACTIVITY*',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      `• Active now: ${active5min}`,
      `• Last 5 minutes: ${active5min}`,
      `• Last hour: ${active1hour}`,
      `• Last 24 hours: ${active1day}`,
      `• Total users: ${totalUsers}`,
      '',
      '💡 _Data dari Supabase database_',
    ].join('\n');
    
    await ctx.replyWithMarkdown(text);
  } catch (error) {
    console.error('[ADMIN USERS ERROR]', error);
    
    // Fallback to in-memory sessions
    const now = Date.now();
    const fiveMinAgo = now - 5 * 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    
    let active5min = 0;
    let active1hour = 0;
    let active1day = 0;
    
    for (const [userId, session] of USER_SESSIONS.entries()) {
      if (session.lastActivity > fiveMinAgo) active5min++;
      if (session.lastActivity > oneHourAgo) active1hour++;
      if (session.lastActivity > oneDayAgo) active1day++;
    }
    
    const text = [
      '👥 *USER ACTIVITY*',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      `• Active now: ${active5min}`,
      `• Last 5 minutes: ${active5min}`,
      `• Last hour: ${active1hour}`,
      `• Last 24 hours: ${active1day}`,
      `• Total users: ${USER_SESSIONS.size}`,
      '',
      '⚠️ _Fallback: in-memory sessions_',
      '_(Database query failed)_',
    ].join('\n');
    
    await ctx.replyWithMarkdown(text);
  }
}

/**
 * Admin orders info
 */
async function handleAdminOrders(ctx) {
  const pendingOrders = Array.from(ACTIVE_ORDERS.values()).filter(o => o.status === 'pending');
  const completedOrders = Array.from(ACTIVE_ORDERS.values()).filter(o => o.status === 'completed');
  
  const text = [
    '📦 *ACTIVE ORDERS*',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    `• Pending: ${pendingOrders.length}`,
    `• Completed: ${completedOrders.length}`,
    `• Total: ${ACTIVE_ORDERS.size}`,
    '',
  ];
  
  if (pendingOrders.length > 0) {
    text.push('*Pending Orders:*');
    pendingOrders.slice(0, 10).forEach(order => {
      const timeLeft = Math.max(0, order.expiresAt - Date.now());
      const minutesLeft = Math.floor(timeLeft / 60000);
      text.push(`• ${order.orderId}: ${order.productName} x${order.quantity} (${minutesLeft}m left)`);
    });
  }
  
  await ctx.replyWithMarkdown(text.join('\n'));
}

/**
 * Admin health check
 */
async function handleAdminHealth(ctx) {
  try {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    
    const memUsage = process.memoryUsage();
    const memMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const memTotal = Math.round(memUsage.heapTotal / 1024 / 1024);
    
    const { getAll } = await import('../../data/products.js');
    const products = getAll();
    
    // Get total users from Supabase
    const { supabase } = await import('../../database/supabase.js');
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    const totalUsers = error ? '?' : (count || 0);
    
    const text = [
      '🔧 *SYSTEM HEALTH*',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      '📊 *Status:* 🟢 Online',
      `⏱️ *Uptime:* ${hours}h ${minutes}m`,
      `💾 *Memory:* ${memMB}/${memTotal} MB`,
      '',
      '📦 *Data:*',
      `• Products: ${products.length}`,
      `• Active Orders: ${ACTIVE_ORDERS.size}`,
      `• Active Sessions: ${USER_SESSIONS.size}`,
      `• Total Users: ${totalUsers}`,
      '',
      '🔧 *Environment:*',
      `• Node: ${process.version}`,
      `• Platform: ${process.platform}`,
      `• Arch: ${process.arch}`,
    ].join('\n');
    
    await ctx.replyWithMarkdown(text);
  } catch (error) {
    console.error('[ADMIN HEALTH ERROR]', error);
    await ctx.reply('❌ Failed to get system health');
  }
}

/**
 * Admin broadcast message
 */
async function handleAdminBroadcast(ctx, args) {
  const message = args.join(' ');
  
  if (!message) {
    return ctx.reply(
      '📢 *BROADCAST*\n\n' +
      'Format: /admin broadcast <pesan>\n\n' +
      'Contoh:\n' +
      '/admin broadcast Promo spesial hari ini!',
      { parse_mode: 'Markdown' }
    );
  }
  
  try {
    // Get all users from Supabase
    const { supabase } = await import('../../database/supabase.js');
    const { data: allUsers, error } = await supabase
      .from('users')
      .select('user_id');
    
    if (error) throw error;
    
    const users = allUsers?.map(u => u.user_id) || [];
    
    if (users.length === 0) {
      return ctx.reply('❌ Tidak ada user untuk broadcast');
    }
    
    await ctx.reply(`📢 Mengirim broadcast ke ${users.length} user...`);
    
    let sent = 0;
    let failed = 0;
    
    for (const userId of users) {
      try {
        await ctx.telegram.sendMessage(
          userId,
          `📢 *PENGUMUMAN*\n\n${message}`,
          { parse_mode: 'Markdown' }
        );
        sent++;
        
        // Rate limiting - wait 50ms between messages
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        failed++;
        console.error(`[BROADCAST] Failed to send to ${userId}:`, error.message);
      }
    }
    
    await ctx.reply(
      `✅ Broadcast selesai!\n\n` +
      `• Terkirim: ${sent}\n` +
      `• Gagal: ${failed}\n` +
      `• Total: ${users.length}`
    );
  } catch (error) {
    console.error('[BROADCAST ERROR]', error);
    
    // Fallback to active sessions
    const users = Array.from(USER_SESSIONS.keys());
    
    if (users.length === 0) {
      return ctx.reply('❌ Tidak ada user aktif untuk broadcast\n\n⚠️ Database query failed, fallback to active sessions');
    }
    
    await ctx.reply(`📢 Mengirim broadcast ke ${users.length} user aktif...`);
    
    let sent = 0;
    let failed = 0;
    
    for (const userId of users) {
      try {
        await ctx.telegram.sendMessage(
          userId,
          `📢 *PENGUMUMAN*\n\n${message}`,
          { parse_mode: 'Markdown' }
        );
        sent++;
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        failed++;
        console.error(`[BROADCAST] Failed to send to ${userId}:`, error.message);
      }
    }
    
    await ctx.reply(
      `✅ Broadcast selesai!\n\n` +
      `• Terkirim: ${sent}\n` +
      `• Gagal: ${failed}\n` +
      `• Total: ${users.length}\n\n` +
      `⚠️ _Fallback: active sessions only_`
    );
  }
}

/**
 * Admin settings management
 */
async function handleAdminSettings(ctx, args) {
  const { settings } = await import('../../services/settings.js');
  const subcommand = args[0]?.toLowerCase();
  
  if (!subcommand || subcommand === 'show') {
    const text = settings.getFormattedSettings();
    await ctx.reply(text, { parse_mode: 'HTML' });
    return;
  }
  
  switch (subcommand) {
    case 'set': {
      const path = args[1];
      const value = args.slice(2).join(' ');
      
      if (!path || value === undefined) {
        await ctx.reply(
          '⚙️ *SET SETTING*\n\n' +
          'Format: /admin settings set <path> <value>\n\n' +
          'Contoh:\n' +
          '/admin settings set store.name My Store\n' +
          '/admin settings set payment.autoConfirm true\n' +
          '/admin settings set notifications.lowStockThreshold 10',
          { parse_mode: 'Markdown' }
        );
        return;
      }
      
      // Parse value
      let parsedValue = value;
      if (value === 'true') parsedValue = true;
      else if (value === 'false') parsedValue = false;
      else if (!isNaN(value)) parsedValue = Number(value);
      
      const success = settings.set(path, parsedValue);
      
      if (success) {
        await ctx.reply(`✅ Setting updated: ${path} = ${parsedValue}`);
      } else {
        await ctx.reply('❌ Failed to update setting');
      }
      break;
    }
    
    case 'get': {
      const path = args[1];
      
      if (!path) {
        await ctx.reply('❌ Missing path. Usage: /admin settings get <path>');
        return;
      }
      
      const value = settings.get(path);
      await ctx.reply(`⚙️ ${path} = ${JSON.stringify(value)}`);
      break;
    }
    
    case 'reset': {
      settings.reset();
      await ctx.reply('✅ Settings reset to defaults');
      break;
    }
    
    case 'export': {
      const data = settings.export();
      const jsonStr = JSON.stringify(data, null, 2);
      
      await ctx.replyWithDocument({
        source: Buffer.from(jsonStr),
        filename: `settings-${new Date().toISOString().split('T')[0]}.json`
      }, {
        caption: '⚙️ Settings exported'
      });
      break;
    }
    
    default:
      await ctx.reply('❌ Unknown subcommand. Use: show, set, get, reset, export');
  }
}

/**
 * Admin backup
 */
async function handleAdminBackup(ctx, args) {
  const { backup } = await import('../../services/backup.js');
  const subcommand = args[0]?.toLowerCase();
  
  if (!subcommand || subcommand === 'create') {
    await ctx.reply('⏳ Creating backup...');
    
    const result = await backup.createBackup({
      includeProducts: true,
      includePayments: true,
      includeSettings: true,
      includeState: true,
      compress: true
    });
    
    if (result.success) {
      await ctx.replyWithDocument({
        source: result.path,
        filename: result.filename
      }, {
        caption: `✅ Backup created\n\nSize: ${(result.size / 1024).toFixed(2)} KB`
      });
    } else {
      await ctx.reply(`❌ Backup failed: ${result.error}`);
    }
    return;
  }
  
  switch (subcommand) {
    case 'list': {
      const text = backup.formatBackupList();
      await ctx.replyWithMarkdown(text);
      break;
    }
    
    case 'delete': {
      const filename = args[1];
      
      if (!filename) {
        await ctx.reply('❌ Missing filename. Usage: /admin backup delete <filename>');
        return;
      }
      
      const result = backup.deleteBackup(filename);
      
      if (result.success) {
        await ctx.reply(`✅ Backup deleted: ${filename}`);
      } else {
        await ctx.reply(`❌ Failed to delete: ${result.error}`);
      }
      break;
    }
    
    case 'cleanup': {
      const result = backup.cleanupOldBackups(10);
      await ctx.reply(`✅ Cleanup completed. Deleted ${result.deleted} old backups.`);
      break;
    }
    
    default:
      await ctx.reply(
        '📦 *BACKUP COMMANDS*\n\n' +
        '• /admin backup create - Create new backup\n' +
        '• /admin backup list - List all backups\n' +
        '• /admin backup delete <filename> - Delete backup\n' +
        '• /admin backup cleanup - Delete old backups',
        { parse_mode: 'Markdown' }
      );
  }
}

/**
 * Admin restore
 */
async function handleAdminRestore(ctx, args) {
  const { backup } = await import('../../services/backup.js');
  const filename = args[0];
  
  if (!filename) {
    const text = backup.formatBackupList();
    await ctx.replyWithMarkdown(
      text + '\n\n⚠️ *Restore*\n\nFormat: /admin restore <filename>'
    );
    return;
  }
  
  await ctx.reply('⏳ Restoring backup...');
  
  const result = await backup.restoreBackup(filename, {
    restoreProducts: true,
    restorePayments: true,
    restoreSettings: true,
    restoreState: true
  });
  
  if (result.success) {
    await ctx.reply(
      `✅ Restore completed!\n\n` +
      `Restored: ${result.restored.join(', ')}\n` +
      `Backup date: ${new Date(result.backupDate).toLocaleString('id-ID')}\n\n` +
      `⚠️ Please restart bot to apply all changes.`
    );
  } else {
    await ctx.reply(`❌ Restore failed: ${result.error}`);
  }
}

/**
 * Handle admin callback actions
 */
export default async function handleAdminAction(ctx, params) {
  const userId = ctx.from.id;
  
  if (!isAdmin(userId)) {
    return ctx.answerCbQuery('❌ Akses ditolak');
  }
  
  const [action] = params;
  
  switch (action) {
    case 'stats':
      await handleAdminStats(ctx, []);
      await ctx.answerCbQuery();
      break;
      
    case 'topproducts':
      await handleAdminTopProducts(ctx);
      await ctx.answerCbQuery();
      break;
      
    case 'users':
      await handleAdminUsers(ctx);
      await ctx.answerCbQuery();
      break;
      
    case 'orders':
      await handleAdminOrders(ctx);
      await ctx.answerCbQuery();
      break;
      
    case 'refresh':
      await ctx.answerCbQuery('⏳ Memuat ulang...');
      await handleAdminRefresh(ctx);
      break;
      
    case 'backup':
      await ctx.answerCbQuery('⏳ Creating backup...');
      await handleAdminBackup(ctx, ['create']);
      break;
      
    case 'broadcast':
      await ctx.answerCbQuery();
      await ctx.reply(
        '📢 *BROADCAST MESSAGE*\n\n' +
        'Gunakan command: /admin broadcast <pesan>',
        { parse_mode: 'Markdown' }
      );
      break;
      
    case 'settings':
      await ctx.answerCbQuery();
      await handleAdminSettings(ctx, ['show']);
      break;
      
    default:
      await ctx.answerCbQuery('Action tidak dikenal');
  }
}

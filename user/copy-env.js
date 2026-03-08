#!/usr/bin/env node

/**
 * Script untuk copy environment variables dari bot/dashboard ke user store
 * Usage: node copy-env.js
 */

const fs = require('fs');
const path = require('path');

const botEnvPath = path.join(__dirname, '..', 'bot-telegram', '.env');
const dashboardEnvPath = path.join(__dirname, '..', 'dashboard', '.env.local');
const userEnvPath = path.join(__dirname, '.env.local');

console.log('🔧 Copying environment variables to user store...\n');

let supabaseUrl = '';
let supabaseKey = '';
let midtransServerKey = '';
let midtransClientKey = '';
let telegramBotToken = '';
let telegramAdminIds = '';

// Try to read from bot .env
if (fs.existsSync(botEnvPath)) {
  console.log('📖 Reading from bot-telegram/.env');
  const botEnv = fs.readFileSync(botEnvPath, 'utf8');
  
  const supabaseUrlMatch = botEnv.match(/SUPABASE_URL=(.+)/);
  const supabaseKeyMatch = botEnv.match(/SUPABASE_ANON_KEY=(.+)/);
  const midtransServerMatch = botEnv.match(/MIDTRANS_SERVER_KEY=(.+)/);
  const midtransClientMatch = botEnv.match(/MIDTRANS_CLIENT_KEY=(.+)/);
  const telegramTokenMatch = botEnv.match(/TELEGRAM_BOT_TOKEN=(.+)/);
  const telegramAdminsMatch = botEnv.match(/TELEGRAM_ADMIN_IDS=(.+)/);
  
  if (supabaseUrlMatch) supabaseUrl = supabaseUrlMatch[1].trim();
  if (supabaseKeyMatch) supabaseKey = supabaseKeyMatch[1].trim();
  if (midtransServerMatch) midtransServerKey = midtransServerMatch[1].trim();
  if (midtransClientMatch) midtransClientKey = midtransClientMatch[1].trim();
  if (telegramTokenMatch) telegramBotToken = telegramTokenMatch[1].trim();
  if (telegramAdminsMatch) telegramAdminIds = telegramAdminsMatch[1].trim();
}

// Preserve existing Telegram values from user env when already configured
if (fs.existsSync(userEnvPath) && (!telegramBotToken || !telegramAdminIds)) {
  const userEnv = fs.readFileSync(userEnvPath, 'utf8');
  const telegramTokenMatch = userEnv.match(/TELEGRAM_BOT_TOKEN=(.+)/);
  const telegramAdminsMatch = userEnv.match(/TELEGRAM_ADMIN_IDS=(.+)/);

  if (telegramTokenMatch && !telegramBotToken) telegramBotToken = telegramTokenMatch[1].trim();
  if (telegramAdminsMatch && !telegramAdminIds) telegramAdminIds = telegramAdminsMatch[1].trim();
}

// Try dashboard if bot didn't have everything
if (fs.existsSync(dashboardEnvPath) && (!supabaseUrl || !supabaseKey)) {
  console.log('📖 Reading from dashboard/.env.local');
  const dashboardEnv = fs.readFileSync(dashboardEnvPath, 'utf8');
  
  const supabaseUrlMatch = dashboardEnv.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
  const supabaseKeyMatch = dashboardEnv.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/);
  
  if (supabaseUrlMatch && !supabaseUrl) supabaseUrl = supabaseUrlMatch[1].trim();
  if (supabaseKeyMatch && !supabaseKey) supabaseKey = supabaseKeyMatch[1].trim();
}

// Generate .env.local content
const envContent = `# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl || 'your_supabase_url'}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${supabaseKey || 'your_supabase_anon_key'}

# Midtrans Configuration
MIDTRANS_SERVER_KEY=${midtransServerKey || 'your_midtrans_server_key'}
MIDTRANS_CLIENT_KEY=${midtransClientKey || 'your_midtrans_client_key'}
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=${midtransClientKey || 'your_midtrans_client_key'}
MIDTRANS_IS_PRODUCTION=false

# Telegram Admin Notification
TELEGRAM_BOT_TOKEN=${telegramBotToken || 'your_telegram_bot_token'}
TELEGRAM_ADMIN_IDS=${telegramAdminIds || 'your_admin_id_comma_separated'}
`;

// Write to user .env.local
fs.writeFileSync(userEnvPath, envContent, 'utf8');

console.log('\n✅ Environment variables copied successfully!\n');
console.log('📁 Created: user/.env.local\n');

// Show what was found
if (supabaseUrl && supabaseUrl !== 'your_supabase_url') {
  console.log('✓ Supabase URL found');
  console.log('✓ Supabase Anon Key found');
} else {
  console.log('⚠️  Supabase credentials not found - please add manually');
}

if (midtransServerKey && midtransServerKey !== 'your_midtrans_server_key') {
  console.log('✓ Midtrans Server Key found');
  console.log('✓ Midtrans Client Key found');
} else {
  console.log('⚠️  Midtrans credentials not found - please add manually');
}

if (telegramBotToken && telegramBotToken !== 'your_telegram_bot_token') {
  console.log('✓ Telegram Bot Token found');
} else {
  console.log('⚠️  Telegram Bot Token not found - please add manually');
}

if (telegramAdminIds && telegramAdminIds !== 'your_admin_id_comma_separated') {
  console.log('✓ Telegram Admin IDs found');
} else {
  console.log('⚠️  Telegram Admin IDs not found - please add manually');
}

console.log('\n📝 Next steps:');
console.log('1. Review user/.env.local');
console.log('2. Add missing credentials if any');
console.log('3. Run: npm run dev');
console.log('\n🚀 Happy coding!\n');

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
let emailProvider = '';
let resendApiKey = '';
let resendFromName = '';
let resendFromEmail = '';
let emailTestTo = '';
let resendTestTo = '';
let smtpUrl = '';
let smtpHost = '';
let smtpPort = '';
let smtpSecure = '';
let smtpUser = '';
let smtpPass = '';
let smtpFromName = '';
let smtpFromEmail = '';
let orderEmailMaxAttempts = '';
let orderEmailRetryDelay = '';

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
  const emailProviderMatch = botEnv.match(/EMAIL_PROVIDER=(.+)/);
  const resendApiKeyMatch = botEnv.match(/RESEND_API_KEY=(.+)/);
  const resendFromNameMatch = botEnv.match(/RESEND_FROM_NAME=(.+)/);
  const resendFromEmailMatch = botEnv.match(/RESEND_FROM_EMAIL=(.+)/);
  const emailTestToMatch = botEnv.match(/EMAIL_TEST_TO=(.+)/);
  const resendTestToMatch = botEnv.match(/RESEND_TEST_TO=(.+)/);
  const smtpUrlMatch = botEnv.match(/SMTP_URL=(.+)/);
  const smtpHostMatch = botEnv.match(/SMTP_HOST=(.+)/);
  const smtpPortMatch = botEnv.match(/SMTP_PORT=(.+)/);
  const smtpSecureMatch = botEnv.match(/SMTP_SECURE=(.+)/);
  const smtpUserMatch = botEnv.match(/SMTP_USER=(.+)/);
  const smtpPassMatch = botEnv.match(/SMTP_PASS=(.+)/);
  const smtpFromNameMatch = botEnv.match(/SMTP_FROM_NAME=(.+)/);
  const smtpFromEmailMatch = botEnv.match(/SMTP_FROM_EMAIL=(.+)/);
  const orderEmailMaxAttemptsMatch = botEnv.match(/ORDER_EMAIL_MAX_ATTEMPTS=(.+)/);
  const orderEmailRetryDelayMatch = botEnv.match(/ORDER_EMAIL_RETRY_DELAY_MS=(.+)/);
  
  if (supabaseUrlMatch) supabaseUrl = supabaseUrlMatch[1].trim();
  if (supabaseKeyMatch) supabaseKey = supabaseKeyMatch[1].trim();
  if (midtransServerMatch) midtransServerKey = midtransServerMatch[1].trim();
  if (midtransClientMatch) midtransClientKey = midtransClientMatch[1].trim();
  if (telegramTokenMatch) telegramBotToken = telegramTokenMatch[1].trim();
  if (telegramAdminsMatch) telegramAdminIds = telegramAdminsMatch[1].trim();
  if (emailProviderMatch) emailProvider = emailProviderMatch[1].trim();
  if (resendApiKeyMatch) resendApiKey = resendApiKeyMatch[1].trim();
  if (resendFromNameMatch) resendFromName = resendFromNameMatch[1].trim();
  if (resendFromEmailMatch) resendFromEmail = resendFromEmailMatch[1].trim();
  if (emailTestToMatch) emailTestTo = emailTestToMatch[1].trim();
  if (resendTestToMatch) resendTestTo = resendTestToMatch[1].trim();
  if (smtpUrlMatch) smtpUrl = smtpUrlMatch[1].trim();
  if (smtpHostMatch) smtpHost = smtpHostMatch[1].trim();
  if (smtpPortMatch) smtpPort = smtpPortMatch[1].trim();
  if (smtpSecureMatch) smtpSecure = smtpSecureMatch[1].trim();
  if (smtpUserMatch) smtpUser = smtpUserMatch[1].trim();
  if (smtpPassMatch) smtpPass = smtpPassMatch[1].trim();
  if (smtpFromNameMatch) smtpFromName = smtpFromNameMatch[1].trim();
  if (smtpFromEmailMatch) smtpFromEmail = smtpFromEmailMatch[1].trim();
  if (orderEmailMaxAttemptsMatch) orderEmailMaxAttempts = orderEmailMaxAttemptsMatch[1].trim();
  if (orderEmailRetryDelayMatch) orderEmailRetryDelay = orderEmailRetryDelayMatch[1].trim();
}

// Preserve existing values from user env when already configured
if (fs.existsSync(userEnvPath)) {
  const userEnv = fs.readFileSync(userEnvPath, 'utf8');
  const telegramTokenMatch = userEnv.match(/TELEGRAM_BOT_TOKEN=(.+)/);
  const telegramAdminsMatch = userEnv.match(/TELEGRAM_ADMIN_IDS=(.+)/);
  const emailProviderMatch = userEnv.match(/EMAIL_PROVIDER=(.+)/);
  const resendApiKeyMatch = userEnv.match(/RESEND_API_KEY=(.+)/);
  const resendFromNameMatch = userEnv.match(/RESEND_FROM_NAME=(.+)/);
  const resendFromEmailMatch = userEnv.match(/RESEND_FROM_EMAIL=(.+)/);
  const emailTestToMatch = userEnv.match(/EMAIL_TEST_TO=(.+)/);
  const resendTestToMatch = userEnv.match(/RESEND_TEST_TO=(.+)/);
  const smtpUrlMatch = userEnv.match(/SMTP_URL=(.+)/);
  const smtpHostMatch = userEnv.match(/SMTP_HOST=(.+)/);
  const smtpPortMatch = userEnv.match(/SMTP_PORT=(.+)/);
  const smtpSecureMatch = userEnv.match(/SMTP_SECURE=(.+)/);
  const smtpUserMatch = userEnv.match(/SMTP_USER=(.+)/);
  const smtpPassMatch = userEnv.match(/SMTP_PASS=(.+)/);
  const smtpFromNameMatch = userEnv.match(/SMTP_FROM_NAME=(.+)/);
  const smtpFromEmailMatch = userEnv.match(/SMTP_FROM_EMAIL=(.+)/);
  const orderEmailMaxAttemptsMatch = userEnv.match(/ORDER_EMAIL_MAX_ATTEMPTS=(.+)/);
  const orderEmailRetryDelayMatch = userEnv.match(/ORDER_EMAIL_RETRY_DELAY_MS=(.+)/);

  if (telegramTokenMatch && !telegramBotToken) telegramBotToken = telegramTokenMatch[1].trim();
  if (telegramAdminsMatch && !telegramAdminIds) telegramAdminIds = telegramAdminsMatch[1].trim();
  if (emailProviderMatch && !emailProvider) emailProvider = emailProviderMatch[1].trim();
  if (resendApiKeyMatch && !resendApiKey) resendApiKey = resendApiKeyMatch[1].trim();
  if (resendFromNameMatch && !resendFromName) resendFromName = resendFromNameMatch[1].trim();
  if (resendFromEmailMatch && !resendFromEmail) resendFromEmail = resendFromEmailMatch[1].trim();
  if (emailTestToMatch && !emailTestTo) emailTestTo = emailTestToMatch[1].trim();
  if (resendTestToMatch && !resendTestTo) resendTestTo = resendTestToMatch[1].trim();
  if (smtpUrlMatch && !smtpUrl) smtpUrl = smtpUrlMatch[1].trim();
  if (smtpHostMatch && !smtpHost) smtpHost = smtpHostMatch[1].trim();
  if (smtpPortMatch && !smtpPort) smtpPort = smtpPortMatch[1].trim();
  if (smtpSecureMatch && !smtpSecure) smtpSecure = smtpSecureMatch[1].trim();
  if (smtpUserMatch && !smtpUser) smtpUser = smtpUserMatch[1].trim();
  if (smtpPassMatch && !smtpPass) smtpPass = smtpPassMatch[1].trim();
  if (smtpFromNameMatch && !smtpFromName) smtpFromName = smtpFromNameMatch[1].trim();
  if (smtpFromEmailMatch && !smtpFromEmail) smtpFromEmail = smtpFromEmailMatch[1].trim();
  if (orderEmailMaxAttemptsMatch && !orderEmailMaxAttempts) orderEmailMaxAttempts = orderEmailMaxAttemptsMatch[1].trim();
  if (orderEmailRetryDelayMatch && !orderEmailRetryDelay) orderEmailRetryDelay = orderEmailRetryDelayMatch[1].trim();
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

# Email Delivery Provider
EMAIL_PROVIDER=${emailProvider || 'resend'}
EMAIL_TEST_TO=${emailTestTo || resendTestTo || ''}

# Email Delivery (Resend)
RESEND_API_KEY=${resendApiKey || ''}
RESEND_FROM_NAME=${resendFromName || smtpFromName || 'Putra BTT Store'}
RESEND_FROM_EMAIL=${resendFromEmail || smtpFromEmail || 'onboarding@resend.dev'}
RESEND_TEST_TO=${resendTestTo || emailTestTo || ''}

# Email Delivery (SMTP fallback)
SMTP_URL=${smtpUrl || ''}
SMTP_HOST=${smtpHost || 'smtp.gmail.com'}
SMTP_PORT=${smtpPort || '587'}
SMTP_SECURE=${smtpSecure || 'false'}
SMTP_USER=${smtpUser || 'your_smtp_user'}
SMTP_PASS=${smtpPass || 'your_smtp_password'}
SMTP_FROM_NAME=${smtpFromName || 'Putra BTT Store'}
SMTP_FROM_EMAIL=${smtpFromEmail || 'your_sender_email@example.com'}
ORDER_EMAIL_MAX_ATTEMPTS=${orderEmailMaxAttempts || '3'}
ORDER_EMAIL_RETRY_DELAY_MS=${orderEmailRetryDelay || '1000'}
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

if (emailProvider) {
  console.log(`✓ Email provider configured: ${emailProvider}`);
} else {
  console.log('⚠️  EMAIL_PROVIDER not found - defaulting to resend');
}

if (resendApiKey && resendFromEmail) {
  console.log('✓ Resend configuration found (API key + sender)');
} else {
  console.log('⚠️  Resend configuration incomplete - please set RESEND_API_KEY and RESEND_FROM_EMAIL');
}

if ((smtpUrl && smtpUrl !== 'your_smtp_url') || (smtpHost && smtpUser)) {
  console.log('✓ SMTP fallback configuration found (partial/full)');
} else {
  console.log('⚠️  SMTP fallback configuration not found');
}

console.log('\n📝 Next steps:');
console.log('1. Review user/.env.local');
console.log('2. Add missing credentials if any');
console.log('3. Run: npm run dev');
console.log('\n🚀 Happy coding!\n');

import 'dotenv/config';

const bool = (v, def=false) => {
  const s = (v ?? '').toString().trim().toLowerCase();
  return s ? (s === 'true' || s === '1' || s === 'yes') : def;
};

export const ENV = {
  ADMIN_JIDS: new Set((process.env.ADMINS || '').split(',').map(s=>s.trim()).filter(Boolean)),
  ADMIN_CONTACT: process.env.ADMIN_CONTACT || '',
  CLIENT_ID: process.env.CLIENT_ID || 'botwa-local',
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || '',
  PAY_PROV: (process.env.PAYMENT_PROVIDER || 'midtrans').toLowerCase(),
  MID_SKEY: process.env.MIDTRANS_SERVER_KEY || '',
  MID_PROD: bool(process.env.MIDTRANS_IS_PRODUCTION, true),
  SHOW_PRODUCT_IMAGE: bool(process.env.SHOW_PRODUCT_IMAGE, false),
  QUIET_MODE: bool(process.env.QUIET_MODE, true),
  COOLDOWN_MS: Math.max(0, Number(process.env.COOLDOWN_SEC || 2) * 1000),
  EXEC_PATH: (process.env.PUPPETEER_EXECUTABLE_PATH || '').trim() || (process.platform === 'linux' ? '/usr/bin/chromium' : undefined),
  PAY_TTL_MS: Number(process.env.PAY_TTL_MS || 20*60*1000),
  ADMIN_SECRET: process.env.ADMIN_WEBHOOK_SECRET || '',
  PORT: process.env.PORT || 3000
};
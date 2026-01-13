// src/payments/midtrans.js
import crypto from 'crypto';
import fs from 'fs';

/* =========================
   Helper: Env & Logging
   ========================= */

// Import from bot config instead of old env
let BOT_CONFIG;
try {
  const module = await import('../bot/config.js');
  BOT_CONFIG = module.BOT_CONFIG;
} catch {
  // Fallback for backward compatibility
  const envModule = await import('../config/env.js');
  BOT_CONFIG = {
    MIDTRANS_SERVER_KEY: envModule.ENV.MID_SKEY,
    MIDTRANS_IS_PRODUCTION: envModule.ENV.MID_PROD,
    MID_LOG_FILE: envModule.ENV.MID_LOG_FILE,
  };
}

function isProd() {
  return BOT_CONFIG.MIDTRANS_IS_PRODUCTION === true
      || BOT_CONFIG.MIDTRANS_IS_PRODUCTION === 'true'
      || BOT_CONFIG.MIDTRANS_IS_PRODUCTION === 1
      || BOT_CONFIG.MIDTRANS_IS_PRODUCTION === '1';
}

function midtransBase() {
  const API_BASE  = isProd() ? 'https://api.midtrans.com'  : 'https://api.sandbox.midtrans.com';
  const SNAP_BASE = isProd() ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com';
  const auth = Buffer.from(String(BOT_CONFIG.MIDTRANS_SERVER_KEY || '') + ':').toString('base64');
  return { API_BASE, SNAP_BASE, auth };
}

function logLine(...args) {
  console.log('[MIDTRANS]', ...args);
  if (BOT_CONFIG.MID_LOG_FILE) {
    const line = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ') + '\n';
    try { fs.appendFileSync(BOT_CONFIG.MID_LOG_FILE, `[${new Date().toISOString()}] ${line}`); } catch {}
  }
}

/* =========================
   Helper: Ekstrak pointer QR
   ========================= */
function extractQrisPointers(json) {
  const actions = Array.isArray(json?.actions) ? json.actions : [];
  const qrV2 = actions.find(a => a?.name === 'generate-qr-code-v2')?.url;
  const qrV1 = actions.find(a => a?.name === 'generate-qr-code')?.url
            || actions.find(a => a?.name === 'qr-code')?.url;
  const qr_url = qrV2 || qrV1 || json?.qr_url || null;
  const qr_string = json?.qr_string || null;
  return { qr_url, qr_string };
}

/* =========================
   SNAP (Invoice)
   ========================= */
export async function createMidtransInvoice({ order_id, gross_amount, customer_phone, product_name }) {
  const { SNAP_BASE, auth } = midtransBase();

  const payload = {
    transaction_details: { order_id, gross_amount: Math.round(gross_amount) },
    item_details: [{ id: order_id, price: Math.round(gross_amount), quantity: 1, name: product_name }],
    customer_details: { phone: customer_phone },
    credit_card: { secure: true }
  };

  const url = `${SNAP_BASE}/snap/v1/transactions`;
  logLine('SNAP Request:', url);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'accept': 'application/json', Authorization: `Basic ${auth}` },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  logLine('SNAP Response:', res.status, text.slice(0, 200));

  if (!res.ok) throw new Error('Midtrans create error: ' + res.status + ' ' + text);
  return JSON.parse(text);
}

/* =========================
   Core API: Status
   ========================= */
export async function midtransStatus(order_id) {
  const { API_BASE, auth } = midtransBase();
  const url = `${API_BASE}/v2/${encodeURIComponent(order_id)}/status`;

  logLine('Status Request:', order_id);

  const res = await fetch(url, { headers: { 'accept': 'application/json', Authorization: `Basic ${auth}` } });
  const text = await res.text();

  logLine('Status Response:', res.status, text.slice(0, 200));

  if (!res.ok) throw new Error('Midtrans status error: ' + res.status + ' ' + text);
  return JSON.parse(text);
}

/* =========================
   Core API: QRIS Charge
   ========================= */
export async function createMidtransQRISCharge({ order_id, gross_amount }) {
  const { API_BASE, auth } = midtransBase();

  const payload = {
    payment_type: 'qris',
    transaction_details: { order_id, gross_amount: Math.round(gross_amount) }
  };

  const url = `${API_BASE}/v2/charge`;
  logLine('QRIS Request:', order_id, gross_amount);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'accept': 'application/json', Authorization: `Basic ${auth}` },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  logLine('QRIS Response:', res.status, text.slice(0, 200));

  if (!res.ok) throw new Error('QRIS charge error: ' + res.status + ' ' + text);

  const json = JSON.parse(text);
  const { qr_url, qr_string } = extractQrisPointers(json);
  
  logLine('QRIS Created:', { order_id, qr_url: !!qr_url, qr_string: !!qr_string });
  
  return { ...json, qr_url, qr_string };
}

/* =========================
   Signature Verification
   ========================= */
export function verifyMidtransSignature({ order_id, status_code, gross_amount, signature_key }) {
  const raw = String(order_id) + String(status_code) + String(gross_amount) + String(BOT_CONFIG.MIDTRANS_SERVER_KEY || '');
  const calc = crypto.createHash('sha512').update(raw).digest('hex');
  const isValid = calc === String(signature_key);
  
  logLine('Signature Verify:', { order_id, isValid });
  
  return isValid;
}


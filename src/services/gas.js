// src/services/gas.js

// Import from bot config
let BOT_CONFIG;
try {
  const module = await import('../bot/config.js');
  BOT_CONFIG = module.BOT_CONFIG;
} catch {
  // Fallback for backward compatibility
  BOT_CONFIG = {
    GAS_URL: process.env.GAS_WEBHOOK_URL || '',
    GAS_SECRET: process.env.GAS_SECRET || 'rahasia-super-aman',
  };
}

async function postjson(url, data, timeoutMs = 15000, tag = 'gas') {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: BOT_CONFIG.GAS_SECRET, ...data }),
    });
    const txt = await res.text();
    let json; 
    try { 
      json = JSON.parse(txt); 
    } catch { 
      throw new Error(`${tag} non-JSON response: ${txt.slice(0,180)}`); 
    }
    if (!res.ok) throw new Error(`${tag} http ${res.status}: ${json?.msg || json?.error || 'http_error'}`);
    
    // DEBUG: Log response detail untuk finalize
    if (tag === 'finalize') {
      console.log(`[GAS] ✅ ${tag} success`);
      console.log(`[GAS] Response:`, JSON.stringify(json, null, 2));
      console.log(`[GAS] Items in response:`, json?.items?.length || 0);
      if (!json?.items || json.items.length === 0) {
        console.error('[GAS] ⚠️ WARNING: Finalize returned empty items array!');
        console.error('[GAS] Check your Google Apps Script code!');
      }
    } else {
      console.log(`[GAS] ${tag} success:`, json);
    }
    
    return json;
  } finally { 
    clearTimeout(to); 
  }
}

async function withRetry(fn, tries = 2, label='call') {
  let lastErr;
  for (let i=0;i<tries;i++){
    try { 
      return await fn(); 
    } catch(e){ 
      lastErr = e;
      console.warn(`[GAS] ${label} attempt ${i+1} failed:`, e.message);
    }
  }
  throw lastErr;
}

export async function reserveStock({ kode, qty, userRef }) {
  if (!BOT_CONFIG.GAS_URL) {
    console.warn('[GAS] GAS_URL not configured');
    return { ok:false, msg:'GAS_URL_not_configured' };
  }
  
  try {
    console.log('[GAS] Reserving stock:', { kode, qty, userRef });
    const r = await withRetry(
      () => postjson(BOT_CONFIG.GAS_URL, { action:'reserve', kode, qty, userRef }, 10000, 'reserve'), 
      2, 
      'reserve'
    );
    if (!r?.ok && !r?.msg) r.msg = 'reserve_failed';
    return r;
  } catch (e) { 
    console.error('[GAS] Reserve error:', e);
    return { ok:false, msg: e?.message || 'reserve_exception' }; 
  }
}

export async function finalizeStock({ order_id, total }) {
  if (!BOT_CONFIG.GAS_URL) {
    console.warn('[GAS] GAS_URL not configured');
    return { ok:false, msg:'GAS_URL_not_configured' };
  }
  
  try {
    console.log('[GAS] Finalizing stock:', { order_id, total });
    const r = await withRetry(
      () => postjson(BOT_CONFIG.GAS_URL, { action:'finalize', order_id, total }, 15000, 'finalize'), 
      2, 
      'finalize'
    );
    if (!r?.ok && !r?.msg) r.msg = 'finalize_failed';
    return r;
  } catch (e) { 
    console.error('[GAS] Finalize error:', e);
    return { ok:false, msg: e?.message || 'finalize_exception' }; 
  }
}

export async function releaseStock({ order_id, reason }) {
  if (!BOT_CONFIG.GAS_URL) {
    console.warn('[GAS] GAS_URL not configured');
    return { ok:false, msg:'GAS_URL_not_configured' };
  }
  
  try {
    console.log('[GAS] Releasing stock:', { order_id, reason });
    const r = await withRetry(
      () => postjson(BOT_CONFIG.GAS_URL, { action:'release', order_id, reason }, 12000, 'release'), 
      2, 
      'release'
    );
    if (!r?.ok && !r?.msg) r.msg = 'release_failed';
    return r;
  } catch (e) { 
    console.error('[GAS] Release error:', e);
    return { ok:false, msg: e?.message || 'release_exception' }; 
  }
}


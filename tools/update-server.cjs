/**
 * FrontStores Server
 *
 * Port 3001 — PUBLIC  — exposed via Cloudflare Tunnel (register, license, error)
 * Port 3002 — ADMIN   — localhost:127.0.0.1 ONLY, never tunneled, never internet-accessible
 *
 * Usage:  node tools/update-server.cjs
 * Env:    PORT=3001  ADMIN_PORT=3002  ADMIN_PASSWORD=xxx  DATA_DIR=/path/to/data
 */

const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const PUBLIC_PORT = parseInt(process.env.PORT       || '3001');
const ADMIN_PORT  = parseInt(process.env.ADMIN_PORT || '3002');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  console.error('❌  ADMIN_PASSWORD env var is not set. Set it before starting the server.');
  console.error('    Example: ADMIN_PASSWORD=your-strong-password node tools/update-server.cjs');
  process.exit(1);
}

// HMAC with admin password as key — defeats rainbow table attacks on 6-digit PINs
function hashCode(code) {
  return crypto.createHmac('sha256', ADMIN_PASSWORD).update(String(code)).digest('hex');
}

// Input sanitizer — truncates and trims string inputs from untrusted sources
function sanitize(s, max = 200) {
  return typeof s === 'string' ? s.trim().substring(0, max) : '';
}

// ── Rate limiting ────────────────────────────────────────────────────────────
// Simple in-memory rate limiter per IP. Resets after the window expires.
const _rateBuckets = new Map(); // ip -> { [endpoint]: { count, resetAt } }

function rateLimit(req, res, endpoint, maxPerWindow, windowMs) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const key = `${ip}:${endpoint}`;
  const now = Date.now();
  let bucket = _rateBuckets.get(key);
  if (!bucket || now > bucket.resetAt) bucket = { count: 0, resetAt: now + windowMs };
  bucket.count++;
  _rateBuckets.set(key, bucket);
  if (bucket.count > maxPerWindow) {
    res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': Math.ceil((bucket.resetAt - now) / 1000) });
    res.end(JSON.stringify({ error: 'Too many requests. Please try again later.' }));
    return true; // blocked
  }
  return false; // allowed
}

// Purge stale rate buckets every 10 minutes to prevent memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of _rateBuckets) {
    if (now > bucket.resetAt) _rateBuckets.delete(key);
  }
}, 10 * 60 * 1000);

// DATA_DIR — all tenant + error data lives here. Change this env var on Mac Mini if needed.
const DATA_DIR   = process.env.DATA_DIR || path.join(__dirname, 'data');
const SUBS_FILE  = path.join(DATA_DIR, 'subscriptions.json');
const ERRORS_FILE = path.join(DATA_DIR, 'errors.json');

// Ensure data dir exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ── Data helpers ────────────────────────────────────────────────────────────
function loadSubs()      { try { return JSON.parse(fs.readFileSync(SUBS_FILE,  'utf8')); } catch { return {}; } }
function saveSubs(d)     { fs.writeFileSync(SUBS_FILE,  JSON.stringify(d, null, 2)); }
function loadErrors()    { try { return JSON.parse(fs.readFileSync(ERRORS_FILE,'utf8')); } catch { return []; } }
function saveErrors(d)   { fs.writeFileSync(ERRORS_FILE, JSON.stringify(d, null, 2)); }

function addDays(from, days) {
  const d = new Date(from); d.setDate(d.getDate() + days);
  return d.toISOString().replace('T',' ').substring(0,19);
}
function readBody(req) {
  return new Promise(r => { let b=''; req.on('data',c=>b+=c); req.on('end',()=>r(b)); });
}
function json(res, data, status=200) {
  res.writeHead(status, {'Content-Type':'application/json'});
  res.end(JSON.stringify(data));
}
// Per-session CSRF token — regenerated on each server start
const CSRF_TOKEN = crypto.randomBytes(32).toString('hex');

function checkAuth(req) {
  const auth = req.headers['authorization'] || '';
  return auth === `Basic ${Buffer.from(`:${ADMIN_PASSWORD}`).toString('base64')}`;
}

function checkCsrf(req) {
  return req.headers['x-csrf-token'] === CSRF_TOKEN;
}

// ── PUBLIC SERVER — port 3001 — tunneled to update.frontstores.com ──────────
const publicServer = http.createServer(async (req, res) => {
  const url      = new URL(req.url, `http://localhost:${PUBLIC_PORT}`);
  const pathname = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // POST /register — max 10 per IP per hour
  if (req.method === 'POST' && pathname === '/register') {
    if (rateLimit(req, res, 'register', 10, 60 * 60 * 1000)) return;
    const body = await readBody(req);
    try {
      const { tenant_id, shop_name, owner_name, shop_type, phone, email, city, gstin } = JSON.parse(body);
      if (!tenant_id || typeof tenant_id !== 'string' || tenant_id.length > 36 || !/^[a-f0-9\-]{32,36}$/i.test(tenant_id)) {
        res.writeHead(400); res.end('Invalid tenant_id'); return;
      }
      const subs = loadSubs();
      if (!subs[tenant_id]) {
        subs[tenant_id] = {
          tenant_id,
          shop_name:  sanitize(shop_name,  100) || 'Unknown',
          owner_name: sanitize(owner_name, 100),
          shop_type:  sanitize(shop_type,   50),
          phone:      sanitize(phone,        20),
          email:      sanitize(email,       200),
          city:       sanitize(city,        100),
          gstin:      sanitize(gstin,        15),
          expires_at: addDays(new Date().toISOString(), 30),
          registered_at: new Date().toISOString(),
          account_status: 'active',
        };
        console.log(`🆕 New: ${shop_name} (${tenant_id.substring(0,8)})`);
      }
      // Existing tenant: never overwrite their data from a re-register payload.
      // Contact info updates must go through the admin panel.
      saveSubs(subs);
      const sub = subs[tenant_id];
      json(res, { ok: true, expires_at: sub.expires_at, account_status: sub.account_status||'active' });
    } catch { res.writeHead(400); res.end('Bad request'); }
    return;
  }

  // GET /license/:tenant_id
  if (req.method === 'GET' && pathname.startsWith('/license/')) {
    const tenantId = pathname.split('/')[2];
    const sub = loadSubs()[tenantId];
    const server_time = new Date().toISOString();
    if (!sub)                              { json(res, { active: false, server_time }); return; }
    if (sub.account_status === 'frozen')   { json(res, { active: false, reason: 'frozen', server_time }); return; }
    if (sub.account_status === 'revoked')  { json(res, { active: false, reason: 'revoked', server_time }); return; }
    json(res, new Date(sub.expires_at) > new Date()
      ? { active: true,  expires_at: sub.expires_at, server_time }
      : { active: false, server_time });
    return;
  }

  // POST /error — max 20 per IP per minute
  if (req.method === 'POST' && pathname === '/error') {
    if (rateLimit(req, res, 'error', 20, 60 * 1000)) return;
    const body = await readBody(req);
    try {
      const { tenant_id, message, stack, context, app_version } = JSON.parse(body);
      if (!tenant_id || !message) { res.writeHead(400); res.end('Missing fields'); return; }
      const errors = loadErrors();
      errors.unshift({
        id: Date.now().toString(), tenant_id,
        message: String(message).substring(0,500),
        stack: String(stack||'').substring(0,2000),
        context: context||'', app_version: app_version||'',
        received_at: new Date().toISOString(), resolved: false,
      });
      saveErrors(errors.slice(0,500));
      const shop = loadSubs()[tenant_id]?.shop_name || tenant_id.substring(0,8);
      console.log(`⚠️  Error from ${shop}: ${String(message).substring(0,80)}`);
      json(res, { ok: true });
    } catch { res.writeHead(400); res.end('Bad request'); }
    return;
  }

  if (req.method === 'GET' && pathname === '/update') { res.writeHead(204); res.end(); return; }

  // POST /reset-request — max 5 per IP per 15 minutes
  if (req.method === 'POST' && pathname === '/reset-request') {
    if (rateLimit(req, res, 'reset-request', 5, 15 * 60 * 1000)) return;
    const body = await readBody(req);
    try {
      const { tenant_id, shop_name, requested_at } = JSON.parse(body);
      if (!tenant_id) { res.writeHead(400); res.end('Missing tenant_id'); return; }
      const subs = loadSubs();
      if (subs[tenant_id]) {
        subs[tenant_id].reset_requested_at = requested_at || new Date().toISOString();
        subs[tenant_id].reset_token = null;
        subs[tenant_id].reset_token_expires = null;
        saveSubs(subs);
        console.log(`🔑 Reset request from ${shop_name || tenant_id.substring(0, 8)}`);
      }
      json(res, { ok: true });
    } catch { res.writeHead(400); res.end('Bad request'); }
    return;
  }

  // POST /unlock-request — max 5 per IP per 15 minutes
  if (req.method === 'POST' && pathname === '/unlock-request') {
    if (rateLimit(req, res, 'unlock-request', 5, 15 * 60 * 1000)) return;
    const body = await readBody(req);
    try {
      const { tenant_id, shop_name, requested_at } = JSON.parse(body);
      if (!tenant_id) { res.writeHead(400); res.end('Missing tenant_id'); return; }
      const subs = loadSubs();
      if (subs[tenant_id]) {
        subs[tenant_id].unlock_requested_at = requested_at || new Date().toISOString();
        subs[tenant_id].unlock_token = null;
        subs[tenant_id].unlock_token_expires = null;
        saveSubs(subs);
        console.log(`🔓 Unlock request from ${shop_name || tenant_id.substring(0, 8)}`);
      }
      json(res, { ok: true });
    } catch { res.writeHead(400); res.end('Bad request'); }
    return;
  }

  // POST /verify-unlock-code — max 10 per IP per 15 minutes
  if (req.method === 'POST' && pathname === '/verify-unlock-code') {
    if (rateLimit(req, res, 'verify-unlock', 10, 15 * 60 * 1000)) return;
    const body = await readBody(req);
    try {
      const { tenant_id, code } = JSON.parse(body);
      if (!tenant_id || !code) { res.writeHead(400); res.end('Missing fields'); return; }
      const subs = loadSubs();
      const sub = subs[tenant_id];
      if (!sub || !sub.unlock_token) { json(res, { ok: false, error: 'No unlock code found' }); return; }
      if (sub.unlock_token !== hashCode(code)) { json(res, { ok: false, error: 'Invalid code' }); return; }
      if (sub.unlock_token_expires && new Date(sub.unlock_token_expires) < new Date()) {
        json(res, { ok: false, error: 'Code has expired' }); return;
      }
      subs[tenant_id].unlock_token = null;
      subs[tenant_id].unlock_token_expires = null;
      subs[tenant_id].unlock_requested_at = null;
      saveSubs(subs);
      console.log(`✅ Account unlocked for ${sub.shop_name}`);
      json(res, { ok: true });
    } catch { res.writeHead(400); res.end('Bad request'); }
    return;
  }

  // POST /verify-reset-code — max 10 per IP per 15 minutes
  if (req.method === 'POST' && pathname === '/verify-reset-code') {
    if (rateLimit(req, res, 'verify-reset', 10, 15 * 60 * 1000)) return;
    const body = await readBody(req);
    try {
      const { tenant_id, code } = JSON.parse(body);
      if (!tenant_id || !code) { res.writeHead(400); res.end('Missing fields'); return; }
      const subs = loadSubs();
      const sub = subs[tenant_id];
      if (!sub || !sub.reset_token) { json(res, { ok: false, error: 'No reset code found' }); return; }
      if (sub.reset_token !== hashCode(code)) { json(res, { ok: false, error: 'Invalid code' }); return; }
      if (sub.reset_token_expires && new Date(sub.reset_token_expires) < new Date()) {
        json(res, { ok: false, error: 'Code has expired' }); return;
      }
      // Clear token after use
      subs[tenant_id].reset_token = null;
      subs[tenant_id].reset_token_expires = null;
      subs[tenant_id].reset_requested_at = null;
      saveSubs(subs);
      console.log(`✅ Password reset approved for ${sub.shop_name}`);
      json(res, { ok: true });
    } catch { res.writeHead(400); res.end('Bad request'); }
    return;
  }

  // Block any attempt to reach admin from public port
  if (pathname.startsWith('/admin')) { res.writeHead(403); res.end('Forbidden'); return; }

  res.writeHead(404); res.end('Not found');
});

// ── ADMIN SERVER — port 3002 — 127.0.0.1 ONLY, never internet-accessible ───
const ADMIN_HTML = path.join(__dirname, '..', 'admin-app', 'index.html');

const adminServer = http.createServer(async (req, res) => {
  const url      = new URL(req.url, `http://localhost:${ADMIN_PORT}`);
  const pathname = url.pathname;

  // Serve the admin panel HTML
  if (req.method === 'GET' && (pathname === '/' || pathname === '/admin' || pathname === '/index.html')) {
    if (fs.existsSync(ADMIN_HTML)) {
      const html = fs.readFileSync(ADMIN_HTML, 'utf8')
        .replace('</head>', `<script>window.__CSRF_TOKEN__="${CSRF_TOKEN}";</script></head>`);
      res.writeHead(200, {'Content-Type':'text/html'});
      res.end(html);
    } else {
      res.writeHead(404); res.end('Admin panel not found');
    }
    return;
  }

  res.setHeader('Access-Control-Allow-Origin', `http://localhost:${ADMIN_PORT}`);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (!checkAuth(req)) {
    res.writeHead(401, {'WWW-Authenticate':'Basic realm="FrontStores Admin"'});
    res.end('Unauthorized'); return;
  }

  // CSRF check on all state-changing requests
  if (req.method === 'POST' && !checkCsrf(req)) {
    res.writeHead(403); res.end('Invalid CSRF token'); return;
  }

  // GET /admin/api/customers
  if (req.method === 'GET' && pathname === '/admin/api/customers') {
    const list = Object.entries(loadSubs()).map(([id,s])=>({tenant_id:id,...s}));
    list.sort((a,b)=>new Date(b.registered_at||0)-new Date(a.registered_at||0));
    json(res, list); return;
  }

  // POST /admin/api/customers/:id/extend|freeze|unfreeze|revoke
  const customerAction = pathname.match(/^\/admin\/api\/customers\/([^/]+)\/(extend|freeze|unfreeze|revoke)$/);
  if (req.method === 'POST' && customerAction) {
    const [, tenantId, action] = customerAction;
    const subs = loadSubs();
    if (!subs[tenantId]) { json(res, {ok:false,error:'Not found'}, 404); return; }
    if (action === 'extend') {
      const base = new Date(subs[tenantId].expires_at) > new Date() ? subs[tenantId].expires_at : new Date().toISOString();
      subs[tenantId].expires_at = addDays(base, 30);
      subs[tenantId].account_status = 'active';
      subs[tenantId].extended_at = new Date().toISOString();
      console.log(`✅ Extended: ${subs[tenantId].shop_name} → ${subs[tenantId].expires_at}`);
    } else if (action === 'freeze') {
      subs[tenantId].account_status = 'frozen';
      subs[tenantId].frozen_at = new Date().toISOString();
      console.log(`🧊 Frozen: ${subs[tenantId].shop_name}`);
    } else if (action === 'unfreeze') {
      subs[tenantId].account_status = 'active';
      delete subs[tenantId].frozen_at;
      console.log(`✅ Unfrozen: ${subs[tenantId].shop_name}`);
    } else if (action === 'revoke') {
      subs[tenantId].account_status = 'revoked';
      subs[tenantId].revoked_at = new Date().toISOString();
      console.log(`🚫 Revoked: ${subs[tenantId].shop_name}`);
    }
    saveSubs(subs);
    json(res, { ok: true, expires_at: subs[tenantId].expires_at }); return;
  }

  // POST /admin/api/customers/:id/set-unlock-code
  const unlockCodeAction = pathname.match(/^\/admin\/api\/customers\/([^/]+)\/set-unlock-code$/);
  if (req.method === 'POST' && unlockCodeAction) {
    const tenantId = unlockCodeAction[1];
    const body = await readBody(req);
    const { code, expires } = JSON.parse(body);
    const subs = loadSubs();
    if (!subs[tenantId]) { json(res, {ok:false,error:'Not found'}, 404); return; }
    subs[tenantId].unlock_token = code ? hashCode(code) : null;
    subs[tenantId].unlock_token_expires = expires || null;
    if (!code) subs[tenantId].unlock_requested_at = null;
    saveSubs(subs);
    if (code) console.log(`🔓 Unlock code set for ${subs[tenantId].shop_name}`);
    json(res, { ok: true }); return;
  }

  // POST /admin/api/customers/:id/set-reset-code
  const resetCodeAction = pathname.match(/^\/admin\/api\/customers\/([^/]+)\/set-reset-code$/);
  if (req.method === 'POST' && resetCodeAction) {
    const tenantId = resetCodeAction[1];
    const body = await readBody(req);
    const { code, expires } = JSON.parse(body);
    const subs = loadSubs();
    if (!subs[tenantId]) { json(res, {ok:false,error:'Not found'}, 404); return; }
    subs[tenantId].reset_token = code ? hashCode(code) : null;
    subs[tenantId].reset_token_expires = expires || null;
    saveSubs(subs);
    if (code) console.log(`🔑 Reset code set for ${subs[tenantId].shop_name}`);
    json(res, { ok: true }); return;
  }

  // GET /admin/api/errors
  if (req.method === 'GET' && pathname === '/admin/api/errors') {
    const subs = loadSubs();
    json(res, loadErrors().map(e => ({
      ...e,
      shop_name: subs[e.tenant_id]?.shop_name || 'Unknown',
      shop_type: subs[e.tenant_id]?.shop_type || '',
    }))); return;
  }

  // POST /admin/api/errors/:id/resolve
  const errAction = pathname.match(/^\/admin\/api\/errors\/([^/]+)\/resolve$/);
  if (req.method === 'POST' && errAction) {
    const errors = loadErrors();
    const idx = errors.findIndex(e => e.id === errAction[1]);
    if (idx !== -1) errors[idx].resolved = true;
    saveErrors(errors);
    json(res, { ok: true }); return;
  }

  res.writeHead(404); res.end('Not found');
});

// Public server — listen on all interfaces (tunneled via Cloudflare)
publicServer.listen(PUBLIC_PORT, '0.0.0.0', () => {
  console.log(`🌐 Public  server: http://localhost:${PUBLIC_PORT}  (tunneled → update.frontstores.com)`);
});

// Admin server — 127.0.0.1 ONLY — physically impossible to reach from internet
adminServer.listen(ADMIN_PORT, '127.0.0.1', () => {
  console.log(`🔒 Admin   server: http://localhost:${ADMIN_PORT}   (localhost only — never internet-accessible)`);
  console.log(`   Open admin panel: http://localhost:${ADMIN_PORT}`);
});

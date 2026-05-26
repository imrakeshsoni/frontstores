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

process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err.stack || err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('unhandledRejection:', reason);
  process.exit(1);
});
process.on('SIGTERM', () => { process.exit(0); });
process.on('SIGINT',  () => { process.exit(0); });

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
const DATA_DIR      = process.env.DATA_DIR || path.join(__dirname, 'data');
const SUBS_FILE     = path.join(DATA_DIR, 'subscriptions.json');
const ERRORS_FILE   = path.join(DATA_DIR, 'errors.json');
const CONTACTS_FILE = path.join(DATA_DIR, 'contacts.json');

// Ensure data dir exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ── Data helpers ────────────────────────────────────────────────────────────
function loadSubs()         { try { return JSON.parse(fs.readFileSync(SUBS_FILE,      'utf8')); } catch { return {}; } }
function saveSubs(d)        { fs.writeFileSync(SUBS_FILE,      JSON.stringify(d, null, 2)); }
function loadErrors()       { try { return JSON.parse(fs.readFileSync(ERRORS_FILE,    'utf8')); } catch { return []; } }
function loadContacts()     { try { return JSON.parse(fs.readFileSync(CONTACTS_FILE,  'utf8')); } catch { return []; } }
function saveContacts(d)    { fs.writeFileSync(CONTACTS_FILE,  JSON.stringify(d, null, 2)); }
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

  // GET /lookup-tenant?email=xxx — used by reinstall flow to find existing tenant by email
  if (req.method === 'GET' && pathname === '/lookup-tenant') {
    const email = url.searchParams.get('email')?.toLowerCase().trim();
    if (!email) { json(res, { found: false }); return; }
    const subs = loadSubs();
    const match = Object.values(subs).find(s => s.email?.toLowerCase().trim() === email);
    if (!match) { json(res, { found: false }); return; }
    json(res, {
      found: true,
      tenant_id: match.tenant_id,
      shop_name: match.shop_name,
      owner_name: match.owner_name,
      shop_type: match.shop_type,
      phone: match.phone || '',
      email: match.email || '',
      city: match.city || '',
      account_status: match.account_status,
    });
    return;
  }

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
          expires_at: null,
          registered_at: new Date().toISOString(),
          account_status: 'pending',
        };
        console.log(`🆕 New registration (pending approval): ${sanitize(shop_name,50)} (${tenant_id.substring(0,8)})`);
      }
      // Existing tenant: never overwrite their data from a re-register payload.
      saveSubs(subs);
      const sub = subs[tenant_id];
      json(res, { ok: true, account_status: sub.account_status });
    } catch { res.writeHead(400); res.end('Bad request'); }
    return;
  }

  // GET /license/:tenant_id
  if (req.method === 'GET' && pathname.startsWith('/license/')) {
    const tenantId = pathname.split('/')[2];
    const sub = loadSubs()[tenantId];
    const server_time = new Date().toISOString();
    if (!sub)                               { json(res, { active: false, server_time }); return; }
    if (sub.account_status === 'pending')  { json(res, { active: false, reason: 'pending', server_time }); return; }
    if (sub.account_status === 'frozen')   { json(res, { active: false, reason: 'frozen',  server_time }); return; }
    if (sub.account_status === 'revoked')  { json(res, { active: false, reason: 'revoked', server_time }); return; }
    json(res, sub.expires_at && new Date(sub.expires_at) > new Date()
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

  // POST /contact — website inquiry form — max 5 per IP per 15 minutes
  if (req.method === 'POST' && pathname === '/contact') {
    if (rateLimit(req, res, 'contact', 5, 15 * 60 * 1000)) return;
    const body = await readBody(req);
    try {
      const { name, shop_type, mobile, email, message } = JSON.parse(body);
      if (!mobile || !email) { res.writeHead(400); res.end('Mobile and email are required'); return; }
      const contacts = loadContacts();
      contacts.unshift({
        id: crypto.randomBytes(8).toString('hex'),
        name:      sanitize(name,      100),
        shop_type: sanitize(shop_type,  50),
        mobile:    sanitize(mobile,     20),
        email:     sanitize(email,     200),
        message:   sanitize(message,  1000),
        received_at: new Date().toISOString(),
        resolved: false,
      });
      saveContacts(contacts.slice(0, 1000));
      console.log(`📩 Contact: ${sanitize(name,30)} (${sanitize(mobile,20)}) — ${sanitize(shop_type,30)}`);
      json(res, { ok: true });
    } catch { res.writeHead(400); res.end('Bad request'); }
    return;
  }

  if (req.method === 'GET' && pathname === '/update') { res.writeHead(204); res.end(); return; }

  // POST /ai/chat — voice AI assistant, proxies to local Ollama (dolphin3, unrestricted)
  // Rate limit: 60 requests per minute per IP
  if (req.method === 'POST' && pathname === '/ai/chat') {
    if (rateLimit(req, res, 'ai-chat', 60, 60 * 1000)) return;
    const body = await readBody(req);
    try {
      const { tenant_id, messages } = JSON.parse(body);
      if (!tenant_id || !Array.isArray(messages) || messages.length === 0) {
        res.writeHead(400); res.end('Missing tenant_id or messages'); return;
      }

      const ollamaRes = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'dolphin3',
          messages: messages.map(m => ({
            role: sanitize(m.role, 20),
            content: sanitize(m.content, 4000),
          })),
          stream: false,
          options: { temperature: 0.7, num_predict: 512 },
        }),
      });

      if (!ollamaRes.ok) {
        const errText = await ollamaRes.text();
        console.error(`AI error: ${errText.substring(0, 200)}`);
        res.writeHead(503); res.end(JSON.stringify({ error: 'AI service unavailable' })); return;
      }

      const data = await ollamaRes.json();
      json(res, { ok: true, content: data.message?.content || '' });
    } catch (e) {
      console.error(`AI chat error: ${e.message}`);
      res.writeHead(503); res.end(JSON.stringify({ error: 'AI not available' }));
    }
    return;
  }

  // GET /ai/status — check if Ollama + dolphin3 are ready
  if (req.method === 'GET' && pathname === '/ai/status') {
    try {
      const r = await fetch('http://localhost:11434/api/tags');
      if (!r.ok) { json(res, { available: false }); return; }
      const data = await r.json();
      const hasModel = (data.models || []).some(m => m.name.startsWith('dolphin3'));
      json(res, { available: hasModel });
    } catch {
      json(res, { available: false });
    }
    return;
  }

  // POST /ai/tts — Kokoro TTS proxy (proxies to local Kokoro server on port 8880)
  // Rate limit: 60 per minute per IP
  if (req.method === 'POST' && pathname === '/ai/tts') {
    if (rateLimit(req, res, 'ai-tts', 60, 60 * 1000)) return;
    const body = await readBody(req);
    try {
      const { text, voice, speed } = JSON.parse(body);
      if (!text) { res.writeHead(400); res.end('Missing text'); return; }

      const kokoroRes = await fetch('http://127.0.0.1:8880/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: String(text).substring(0, 500),
          voice: voice || 'heart',
          speed: Number(speed) || 1.0,
        }),
      });

      if (!kokoroRes.ok) {
        const err = await kokoroRes.text();
        console.error(`TTS error: ${err.substring(0, 100)}`);
        res.writeHead(503); res.end(JSON.stringify({ error: 'TTS unavailable' })); return;
      }

      const audioBuffer = await kokoroRes.arrayBuffer();
      res.writeHead(200, {
        'Content-Type': 'audio/wav',
        'Content-Length': audioBuffer.byteLength,
        'Cache-Control': 'no-store',
      });
      res.end(Buffer.from(audioBuffer));
    } catch (e) {
      console.error(`TTS proxy error: ${e.message}`);
      res.writeHead(503); res.end(JSON.stringify({ error: 'TTS not available' }));
    }
    return;
  }

  // POST /ai/stt — Whisper STT proxy (proxies to local Kokoro server on port 8880)
  if (req.method === 'POST' && pathname === '/ai/stt') {
    if (rateLimit(req, res, 'ai-stt', 30, 60 * 1000)) return;
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const audioBuffer = Buffer.concat(chunks);
      const contentType = req.headers['content-type'] || 'audio/webm';

      const sttRes = await fetch('http://127.0.0.1:8880/stt', {
        method: 'POST',
        headers: { 'Content-Type': contentType, 'Content-Length': String(audioBuffer.length) },
        body: audioBuffer,
        signal: AbortSignal.timeout(30000),
      });

      const data = await sttRes.json();
      json(res, data);
    } catch (e) {
      console.error(`STT proxy error: ${e.message}`);
      json(res, { ok: false, error: 'STT not available' });
    }
    return;
  }

  // GET /ai/tts/status — check if Kokoro TTS is ready
  if (req.method === 'GET' && pathname === '/ai/tts/status') {
    try {
      const r = await fetch('http://127.0.0.1:8880/health', { signal: AbortSignal.timeout(2000) });
      const data = await r.json();
      json(res, { available: data.ok && data.kokoro });
    } catch {
      json(res, { available: false });
    }
    return;
  }

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
  const customerAction = pathname.match(/^\/admin\/api\/customers\/([^/]+)\/(extend|freeze|unfreeze|revoke|approve)$/);
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
    } else if (action === 'approve') {
      subs[tenantId].account_status = 'active';
      subs[tenantId].expires_at = addDays(new Date().toISOString(), 30);
      subs[tenantId].approved_at = new Date().toISOString();
      console.log(`✅ Approved: ${subs[tenantId].shop_name} → 30-day trial starts now`);
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

  // POST /admin/api/errors/:id/resolve — deletes the record entirely
  const errAction = pathname.match(/^\/admin\/api\/errors\/([^/]+)\/resolve$/);
  if (req.method === 'POST' && errAction) {
    const errors = loadErrors();
    const filtered = errors.filter(e => e.id !== errAction[1]);
    saveErrors(filtered);
    json(res, { ok: true }); return;
  }

  // GET /admin/api/contacts
  if (req.method === 'GET' && pathname === '/admin/api/contacts') {
    json(res, loadContacts()); return;
  }

  // POST /admin/api/contacts/:id/resolve
  const contactAction = pathname.match(/^\/admin\/api\/contacts\/([^/]+)\/resolve$/);
  if (req.method === 'POST' && contactAction) {
    const contacts = loadContacts();
    const idx = contacts.findIndex(c => c.id === contactAction[1]);
    if (idx !== -1) contacts[idx].resolved = true;
    saveContacts(contacts);
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

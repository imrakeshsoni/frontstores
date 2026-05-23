/**
 * FrontStores Admin Server
 * node tools/update-server.cjs  (or: PORT=3001 node tools/update-server.cjs)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'subscriptions.json');
const ERRORS_FILE = path.join(__dirname, 'errors.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'frontstores2025';

function loadSubs() {
  if (!fs.existsSync(DATA_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { return {}; }
}
function saveSubs(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }
function loadErrors() {
  if (!fs.existsSync(ERRORS_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(ERRORS_FILE, 'utf8')); } catch { return []; }
}
function saveErrors(data) { fs.writeFileSync(ERRORS_FILE, JSON.stringify(data, null, 2)); }

function addDays(fromDate, days) {
  const d = new Date(fromDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().replace('T', ' ').substring(0, 19);
}
function checkAuth(req) {
  const auth = req.headers['authorization'] || '';
  return auth === `Basic ${Buffer.from(`:${ADMIN_PASSWORD}`).toString('base64')}`;
}
function readBody(req) {
  return new Promise(resolve => { let b = ''; req.on('data', c => b += c); req.on('end', () => resolve(b)); });
}
function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ── POST /register ─────────────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/register') {
    const body = await readBody(req);
    try {
      const { tenant_id, shop_name, owner_name, shop_type, phone, email, city, gstin } = JSON.parse(body);
      if (!tenant_id) { res.writeHead(400); res.end('Missing tenant_id'); return; }
      const subs = loadSubs();
      if (!subs[tenant_id]) {
        subs[tenant_id] = {
          tenant_id, shop_name: shop_name || 'Unknown', owner_name: owner_name || '',
          shop_type: shop_type || '', phone: phone || '', email: email || '',
          city: city || '', gstin: gstin || '',
          expires_at: addDays(new Date().toISOString(), 30),
          registered_at: new Date().toISOString(),
          account_status: 'active',
        };
        console.log(`🆕 New customer: ${shop_name} (${tenant_id.substring(0, 8)})`);
      } else {
        Object.assign(subs[tenant_id], { shop_name, owner_name, shop_type, phone, email, city, gstin });
      }
      saveSubs(subs);
      const sub = subs[tenant_id];
      // Return blocked status so the app knows immediately
      json(res, { ok: true, expires_at: sub.expires_at, account_status: sub.account_status || 'active' });
    } catch { res.writeHead(400); res.end('Bad request'); }
    return;
  }

  // ── GET /license/:tenant_id ─────────────────────────────────────────────
  if (req.method === 'GET' && pathname.startsWith('/license/')) {
    const tenantId = pathname.split('/')[2];
    const subs = loadSubs();
    const sub = subs[tenantId];
    if (!sub) { json(res, { active: false }); return; }
    if (sub.account_status === 'frozen') { json(res, { active: false, reason: 'frozen' }); return; }
    if (sub.account_status === 'revoked') { json(res, { active: false, reason: 'revoked' }); return; }
    if (new Date(sub.expires_at) > new Date()) {
      json(res, { active: true, expires_at: sub.expires_at });
    } else {
      json(res, { active: false });
    }
    return;
  }

  // ── POST /error ─────────────────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/error') {
    const body = await readBody(req);
    try {
      const { tenant_id, message, stack, context, app_version } = JSON.parse(body);
      if (!tenant_id || !message) { res.writeHead(400); res.end('Missing fields'); return; }
      const errors = loadErrors();
      errors.unshift({
        id: Date.now().toString(),
        tenant_id,
        message: String(message).substring(0, 500),
        stack: String(stack || '').substring(0, 2000),
        context: context || '',
        app_version: app_version || '',
        received_at: new Date().toISOString(),
        resolved: false,
      });
      saveErrors(errors.slice(0, 500));
      const shop = loadSubs()[tenant_id]?.shop_name || tenant_id.substring(0, 8);
      console.log(`⚠️  Error from ${shop}: ${String(message).substring(0, 80)}`);
      json(res, { ok: true });
    } catch { res.writeHead(400); res.end('Bad request'); }
    return;
  }

  // ── GET /update ─────────────────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/update') { res.writeHead(204); res.end(); return; }

  // ── Admin routes (password protected) ──────────────────────────────────
  if (pathname.startsWith('/admin')) {
    if (!checkAuth(req)) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="FrontStores Admin"' });
      res.end('Unauthorized'); return;
    }

    // GET /admin/api/customers
    if (req.method === 'GET' && pathname === '/admin/api/customers') {
      const subs = loadSubs();
      const list = Object.entries(subs).map(([id, s]) => ({ tenant_id: id, ...s }));
      list.sort((a, b) => new Date(b.registered_at || 0) - new Date(a.registered_at || 0));
      json(res, list); return;
    }

    // POST /admin/api/customers/:id/extend
    if (req.method === 'POST' && pathname.match(/^\/admin\/api\/customers\/[^/]+\/extend$/)) {
      const tenantId = pathname.split('/')[4];
      const subs = loadSubs();
      if (!subs[tenantId]) { json(res, { ok: false, error: 'Not found' }, 404); return; }
      const base = new Date(subs[tenantId].expires_at) > new Date() ? subs[tenantId].expires_at : new Date().toISOString();
      subs[tenantId].expires_at = addDays(base, 30);
      subs[tenantId].extended_at = new Date().toISOString();
      subs[tenantId].account_status = 'active';
      saveSubs(subs);
      console.log(`✅ Extended for ${subs[tenantId].shop_name} → ${subs[tenantId].expires_at}`);
      json(res, { ok: true, expires_at: subs[tenantId].expires_at }); return;
    }

    // POST /admin/api/customers/:id/freeze
    if (req.method === 'POST' && pathname.match(/^\/admin\/api\/customers\/[^/]+\/freeze$/)) {
      const tenantId = pathname.split('/')[4];
      const subs = loadSubs();
      if (!subs[tenantId]) { json(res, { ok: false, error: 'Not found' }, 404); return; }
      subs[tenantId].account_status = 'frozen';
      subs[tenantId].frozen_at = new Date().toISOString();
      saveSubs(subs);
      console.log(`🧊 Frozen: ${subs[tenantId].shop_name}`);
      json(res, { ok: true }); return;
    }

    // POST /admin/api/customers/:id/unfreeze
    if (req.method === 'POST' && pathname.match(/^\/admin\/api\/customers\/[^/]+\/unfreeze$/)) {
      const tenantId = pathname.split('/')[4];
      const subs = loadSubs();
      if (!subs[tenantId]) { json(res, { ok: false, error: 'Not found' }, 404); return; }
      subs[tenantId].account_status = 'active';
      delete subs[tenantId].frozen_at;
      saveSubs(subs);
      console.log(`✅ Unfrozen: ${subs[tenantId].shop_name}`);
      json(res, { ok: true }); return;
    }

    // POST /admin/api/customers/:id/revoke
    if (req.method === 'POST' && pathname.match(/^\/admin\/api\/customers\/[^/]+\/revoke$/)) {
      const tenantId = pathname.split('/')[4];
      const subs = loadSubs();
      if (!subs[tenantId]) { json(res, { ok: false, error: 'Not found' }, 404); return; }
      subs[tenantId].account_status = 'revoked';
      subs[tenantId].revoked_at = new Date().toISOString();
      saveSubs(subs);
      console.log(`🚫 Revoked: ${subs[tenantId].shop_name}`);
      json(res, { ok: true }); return;
    }

    // GET /admin/api/errors
    if (req.method === 'GET' && pathname === '/admin/api/errors') {
      const errors = loadErrors();
      const subs = loadSubs();
      json(res, errors.map(e => ({ ...e, shop_name: subs[e.tenant_id]?.shop_name || 'Unknown', shop_type: subs[e.tenant_id]?.shop_type || '' })));
      return;
    }

    // POST /admin/api/errors/:id/resolve
    if (req.method === 'POST' && pathname.match(/^\/admin\/api\/errors\/[^/]+\/resolve$/)) {
      const id = pathname.split('/')[4];
      const errors = loadErrors();
      const idx = errors.findIndex(e => e.id === id);
      if (idx !== -1) errors[idx].resolved = true;
      saveErrors(errors);
      json(res, { ok: true }); return;
    }
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════╗
║      FrontStores Server  :${PORT}               ║
╠═══════════════════════════════════════════════╣
║  Admin:   http://localhost:${PORT}/admin         ║
║  Password: ${ADMIN_PASSWORD}                  ║
╚═══════════════════════════════════════════════╝
  `);
});

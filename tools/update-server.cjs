/**
 * FrontStores Update + License Server
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
function saveSubs(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}
function loadErrors() {
  if (!fs.existsSync(ERRORS_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(ERRORS_FILE, 'utf8')); } catch { return []; }
}
function saveErrors(data) {
  fs.writeFileSync(ERRORS_FILE, JSON.stringify(data, null, 2));
}

function addDays(fromDate, days) {
  const d = new Date(fromDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().replace('T', ' ').substring(0, 19);
}
function checkAuth(req) {
  const auth = req.headers['authorization'] || '';
  const expected = `Basic ${Buffer.from(`:${ADMIN_PASSWORD}`).toString('base64')}`;
  return auth === expected;
}
function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => resolve(body));
  });
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

  // ── POST /register — auto-register new customer ──────────────────────
  if (req.method === 'POST' && pathname === '/register') {
    const body = await readBody(req);
    try {
      const data = JSON.parse(body);
      const { tenant_id, shop_name, owner_name, shop_type, phone, email, city, gstin } = data;
      if (!tenant_id) { res.writeHead(400); res.end('Missing tenant_id'); return; }
      const subs = loadSubs();
      if (!subs[tenant_id]) {
        subs[tenant_id] = {
          tenant_id, shop_name: shop_name || 'Unknown', owner_name: owner_name || '',
          shop_type: shop_type || '', phone: phone || '', email: email || '',
          city: city || '', gstin: gstin || '',
          expires_at: addDays(new Date().toISOString(), 30),
          registered_at: new Date().toISOString(),
          subscription_status: 'trial',
        };
        console.log(`🆕 New customer: ${shop_name} (${tenant_id.substring(0,8)})`);
      } else {
        Object.assign(subs[tenant_id], { shop_name, owner_name, shop_type, phone, email, city, gstin });
      }
      saveSubs(subs);
      const sub = subs[tenant_id];
      json(res, { ok: true, expires_at: sub.expires_at });
    } catch { res.writeHead(400); res.end('Bad request'); }
    return;
  }

  // ── GET /license/:tenant_id ───────────────────────────────────────────
  if (req.method === 'GET' && pathname.startsWith('/license/')) {
    const tenantId = pathname.split('/')[2];
    const subs = loadSubs();
    const sub = subs[tenantId];
    if (sub && new Date(sub.expires_at) > new Date()) {
      json(res, { active: true, expires_at: sub.expires_at });
    } else {
      json(res, { active: false });
    }
    return;
  }

  // ── POST /error — receive error reports from customer apps ────────────
  if (req.method === 'POST' && pathname === '/error') {
    const body = await readBody(req);
    try {
      const data = JSON.parse(body);
      const { tenant_id, message, stack, context, app_version } = data;
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
      // Keep max 500 errors
      saveErrors(errors.slice(0, 500));
      const subs = loadSubs();
      const shop = subs[tenant_id]?.shop_name || tenant_id.substring(0, 8);
      console.log(`⚠️  Error from ${shop}: ${message.substring(0, 80)}`);
      json(res, { ok: true });
    } catch { res.writeHead(400); res.end('Bad request'); }
    return;
  }

  // ── GET /update — Tauri updater ───────────────────────────────────────
  if (req.method === 'GET' && pathname === '/update') {
    res.writeHead(204); res.end(); return;
  }

  // ── Admin routes (password protected) ────────────────────────────────
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

    // GET /admin/api/errors
    if (req.method === 'GET' && pathname === '/admin/api/errors') {
      const errors = loadErrors();
      const subs = loadSubs();
      const enriched = errors.map(e => ({
        ...e,
        shop_name: subs[e.tenant_id]?.shop_name || 'Unknown',
        shop_type: subs[e.tenant_id]?.shop_type || '',
      }));
      json(res, enriched); return;
    }

    // POST /admin/api/errors/:id/resolve
    if (req.method === 'POST' && pathname.startsWith('/admin/api/errors/') && pathname.endsWith('/resolve')) {
      const id = pathname.split('/')[4];
      const errors = loadErrors();
      const idx = errors.findIndex(e => e.id === id);
      if (idx !== -1) errors[idx].resolved = true;
      saveErrors(errors);
      json(res, { ok: true }); return;
    }

    // POST /admin/extend
    if (req.method === 'POST' && pathname === '/admin/extend') {
      const body = await readBody(req);
      const p = new URLSearchParams(body);
      const tenantId = p.get('tenant_id')?.trim();
      if (!tenantId) { res.writeHead(400); res.end('Missing tenant_id'); return; }
      const subs = loadSubs();
      const existing = subs[tenantId];
      const base = existing && new Date(existing.expires_at) > new Date()
        ? existing.expires_at : new Date().toISOString();
      subs[tenantId] = {
        ...(existing || {}),
        shop_name: p.get('shop_name')?.trim() || existing?.shop_name || 'Unknown',
        owner_name: p.get('owner_name')?.trim() || existing?.owner_name || '',
        expires_at: addDays(base, 30),
        extended_at: new Date().toISOString(),
      };
      saveSubs(subs);
      console.log(`✅ Extended for ${tenantId.substring(0,8)} → ${subs[tenantId].expires_at}`);
      // Return JSON if called from admin app (Accept: application/json)
      const accept = req.headers['accept'] || '';
      if (accept.includes('application/json')) {
        json(res, { ok: true, expires_at: subs[tenantId].expires_at });
      } else {
        res.writeHead(302, { Location: '/admin' }); res.end();
      }
      return;
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

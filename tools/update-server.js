/**
 * FrontStores Update + License Server
 * Runs on Rakesh's Mac via Cloudflare Tunnel
 *
 * Start: node tools/update-server.js
 * Admin: http://localhost:3000/admin  (password in ADMIN_PASSWORD env var)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'subscriptions.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'frontstores2025';

function loadSubs() {
  if (!fs.existsSync(DATA_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { return {}; }
}

function saveSubs(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
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

function adminPage(subs) {
  const rows = Object.entries(subs).map(([id, s]) => {
    const expires = new Date(s.expires_at);
    const daysLeft = Math.ceil((expires - Date.now()) / (1000 * 60 * 60 * 24));
    const active = daysLeft > 0;
    const statusHtml = active
      ? `<span style="color:#16a34a;font-weight:600">✅ ${daysLeft} days left</span>`
      : `<span style="color:#dc2626;font-weight:600">❌ Expired</span>`;
    return `
      <tr style="border-bottom:1px solid #f1f5f9">
        <td style="padding:14px 16px">
          <div style="font-weight:600;color:#0f172a">${s.shop_name || 'Unknown'}</div>
          <div style="font-size:11px;color:#94a3b8;margin-top:2px;font-family:monospace">${id.substring(0,20)}…</div>
        </td>
        <td style="padding:14px 16px;color:#475569">${s.owner_name || '—'}</td>
        <td style="padding:14px 16px;color:#475569;font-size:13px">${s.expires_at}</td>
        <td style="padding:14px 16px">${statusHtml}</td>
        <td style="padding:14px 16px">
          <form method="POST" action="/admin/extend" style="display:inline">
            <input type="hidden" name="tenant_id" value="${id}">
            <button type="submit" style="background:#4f8ef7;color:#fff;border:none;padding:6px 16px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600">+30 days</button>
          </form>
        </td>
      </tr>`;
  }).join('');

  const total = Object.keys(subs).length;
  const active = Object.values(subs).filter(s => new Date(s.expires_at) > new Date()).length;
  const expired = total - active;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>FrontStores Admin</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;padding:28px;color:#1e293b}
    .header{background:linear-gradient(135deg,#1e293b,#0f172a);color:#fff;padding:24px 28px;border-radius:20px;margin-bottom:24px}
    .header h1{font-size:22px;font-weight:800;letter-spacing:-.5px}
    .header p{color:#94a3b8;font-size:13px;margin-top:4px}
    .stats{display:flex;gap:16px;margin-bottom:24px}
    .stat{background:#fff;border-radius:16px;padding:20px 24px;flex:1;box-shadow:0 1px 3px rgba(0,0,0,.08)}
    .stat-num{font-size:32px;font-weight:900;letter-spacing:-.02em}
    .stat-label{font-size:12px;color:#64748b;margin-top:4px}
    .card{background:#fff;border-radius:20px;padding:24px;margin-bottom:24px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
    .card h2{font-size:15px;font-weight:700;margin-bottom:16px}
    input[type=text]{padding:9px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;margin-right:8px;width:260px}
    .btn-green{background:#22c55e;color:#fff;border:none;padding:9px 22px;border-radius:10px;cursor:pointer;font-size:14px;font-weight:700}
    table{width:100%;border-collapse:collapse}
    th{text-align:left;padding:10px 16px;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;border-bottom:2px solid #f1f5f9}
  </style>
</head>
<body>
  <div class="header">
    <h1>FrontStores Admin</h1>
    <p>Subscription management · ${total} customers</p>
  </div>

  <div class="stats">
    <div class="stat"><div class="stat-num" style="color:#16a34a">${active}</div><div class="stat-label">Active subscriptions</div></div>
    <div class="stat"><div class="stat-num" style="color:#dc2626">${expired}</div><div class="stat-label">Expired</div></div>
    <div class="stat"><div class="stat-num" style="color:#4f8ef7">${total}</div><div class="stat-label">Total customers</div></div>
  </div>

  <div class="card">
    <h2>➕ Activate / Extend Subscription (after receiving payment)</h2>
    <form method="POST" action="/admin/extend">
      <input type="text" name="tenant_id" placeholder="Customer's Shop ID" required>
      <input type="text" name="shop_name" placeholder="Shop name">
      <input type="text" name="owner_name" placeholder="Owner name">
      <button type="submit" class="btn-green">Activate 30 Days ✓</button>
    </form>
    <p style="font-size:12px;color:#94a3b8;margin-top:10px">Customer can find their Shop ID inside the app on the subscription screen.</p>
  </div>

  <div class="card" style="padding:0;overflow:hidden">
    <table>
      <thead><tr>
        <th>Shop</th><th>Owner</th><th>Expires</th><th>Status</th><th>Action</th>
      </tr></thead>
      <tbody>
        ${rows || '<tr><td colspan="5" style="padding:32px;text-align:center;color:#94a3b8">No customers yet. They will appear here once their app checks in.</td></tr>'}
      </tbody>
    </table>
  </div>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ── Public: Auto-register new customer ────────────────────────────
  if (req.method === 'POST' && pathname === '/register') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { tenant_id, shop_name, owner_name, shop_type, phone, email, city, gstin } = data;
        if (!tenant_id) { res.writeHead(400); res.end('Missing tenant_id'); return; }
        const subs = loadSubs();
        if (!subs[tenant_id]) {
          // New customer — give 30-day trial
          subs[tenant_id] = {
            tenant_id,
            shop_name: shop_name || 'Unknown',
            owner_name: owner_name || '',
            shop_type: shop_type || '',
            phone: phone || '',
            email: email || '',
            city: city || '',
            gstin: gstin || '',
            expires_at: addDays(new Date().toISOString(), 30),
            registered_at: new Date().toISOString(),
            subscription_status: 'trial',
          };
          saveSubs(subs);
          console.log(`🆕 New customer registered: ${shop_name} (${tenant_id.substring(0,8)})`);
        } else {
          // Update contact details if changed
          Object.assign(subs[tenant_id], { shop_name, owner_name, shop_type, phone, email, city, gstin });
          saveSubs(subs);
        }
        const sub = subs[tenant_id];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, expires_at: sub.expires_at }));
      } catch (e) {
        res.writeHead(400); res.end('Bad request');
      }
    });
    return;
  }

  // ── Public: License check (called by the app) ──────────────────────
  if (req.method === 'GET' && pathname.startsWith('/license/')) {
    const tenantId = pathname.split('/')[2];
    const subs = loadSubs();
    const sub = subs[tenantId];
    if (sub && new Date(sub.expires_at) > new Date()) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ active: true, expires_at: sub.expires_at }));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ active: false }));
    }
    return;
  }

  // ── Public: Tauri update check ──────────────────────────────────────
  if (req.method === 'GET' && pathname === '/update') {
    res.writeHead(204); res.end(); return;
  }

  // ── Admin routes (password protected) ──────────────────────────────
  if (pathname.startsWith('/admin')) {
    if (!checkAuth(req)) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="FrontStores Admin"' });
      res.end('Unauthorized'); return;
    }

    if (req.method === 'GET' && pathname === '/admin') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(adminPage(loadSubs())); return;
    }

    // JSON API for admin app
    if (req.method === 'GET' && pathname === '/admin/api/customers') {
      const subs = loadSubs();
      const list = Object.entries(subs).map(([id, s]) => ({ tenant_id: id, ...s }));
      list.sort((a, b) => new Date(b.registered_at || 0) - new Date(a.registered_at || 0));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(list)); return;
    }

    if (req.method === 'POST' && pathname === '/admin/extend') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        const p = new URLSearchParams(body);
        const tenantId = p.get('tenant_id')?.trim();
        if (!tenantId) { res.writeHead(400); res.end('Missing tenant_id'); return; }

        const subs = loadSubs();
        const existing = subs[tenantId];
        const base = existing && new Date(existing.expires_at) > new Date()
          ? existing.expires_at
          : new Date().toISOString();

        subs[tenantId] = {
          shop_name: p.get('shop_name')?.trim() || existing?.shop_name || 'Unknown',
          owner_name: p.get('owner_name')?.trim() || existing?.owner_name || '',
          expires_at: addDays(base, 30),
          extended_at: new Date().toISOString(),
        };
        saveSubs(subs);
        console.log(`✅ Extended subscription for ${tenantId} → expires ${subs[tenantId].expires_at}`);
        res.writeHead(302, { Location: '/admin' });
        res.end();
      });
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
║  Admin:    http://localhost:${PORT}/admin         ║
║  Password: ${ADMIN_PASSWORD}                  ║
║  License:  GET /license/:tenant_id            ║
╚═══════════════════════════════════════════════╝
  `);
});

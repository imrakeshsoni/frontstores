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
const { spawn, execSync } = require('child_process');

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
const ACTIVITY_FILE  = path.join(DATA_DIR, 'activity.json');
const ANNOUNCEMENTS_FILE = path.join(DATA_DIR, 'announcements.json'); // [core] [all apps] [all tenants]
const NOTES_FILE     = path.join(DATA_DIR, 'notes.json');
const SYNC_DIR      = path.join(DATA_DIR, 'sync');
const CLOUD_DB_DIR  = path.join(DATA_DIR, 'cloud-db'); // [all apps] [all tenants] — full DB snapshots for Cloud Database mode
const DEVICES_FILE  = path.join(DATA_DIR, 'devices.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
// [crm] [all tenants] — WhatsApp bot & lead capture
const WA_CONVOS_FILE = path.join(DATA_DIR, 'wa-conversations.json');
const WA_LEADS_FILE  = path.join(DATA_DIR, 'wa-leads.json');
const WA_CREDS_FILE  = path.join(DATA_DIR, 'wa-credentials.json');

// Ensure data dirs exist
if (!fs.existsSync(DATA_DIR))     fs.mkdirSync(DATA_DIR,     { recursive: true });
if (!fs.existsSync(SYNC_DIR))     fs.mkdirSync(SYNC_DIR,     { recursive: true });
if (!fs.existsSync(CLOUD_DB_DIR)) fs.mkdirSync(CLOUD_DB_DIR, { recursive: true });

// Cloud DB helpers
function cloudDbFile(tenantId) { return path.join(CLOUD_DB_DIR, tenantId + '.json'); }
function loadCloudDb(tenantId) { try { return JSON.parse(fs.readFileSync(cloudDbFile(tenantId), 'utf8')); } catch { return null; } }
function saveCloudDb(tenantId, data) { fs.writeFileSync(cloudDbFile(tenantId), JSON.stringify(data)); }

// ── Device helpers ────────────────────────────────────────────────────────────
function loadDevices() { try { return JSON.parse(fs.readFileSync(DEVICES_FILE, 'utf8')); } catch { return {}; } }
function saveDevices(d) { fs.writeFileSync(DEVICES_FILE, JSON.stringify(d, null, 2)); }

function loadSessions() { try { return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8')); } catch { return {}; } }
function saveSessions(d) { fs.writeFileSync(SESSIONS_FILE, JSON.stringify(d, null, 2)); }

// [crm] [all tenants] — WhatsApp bot helpers
function loadWaConvos() { try { return JSON.parse(fs.readFileSync(WA_CONVOS_FILE, 'utf8')); } catch { return {}; } }
function saveWaConvos(d) { fs.writeFileSync(WA_CONVOS_FILE, JSON.stringify(d, null, 2)); }
function loadWaLeads()  { try { return JSON.parse(fs.readFileSync(WA_LEADS_FILE,  'utf8')); } catch { return []; } }
function saveWaLeads(d)  { fs.writeFileSync(WA_LEADS_FILE,  JSON.stringify(d, null, 2)); }
function loadWaCreds()  { try { return JSON.parse(fs.readFileSync(WA_CREDS_FILE,  'utf8')); } catch { return {}; } }
function saveWaCreds(d)  { fs.writeFileSync(WA_CREDS_FILE,  JSON.stringify(d, null, 2)); }

// Send a WhatsApp message via Meta Graph API
async function sendWaMessage(phoneId, token, to, text) {
  const https = require('https');
  const body = JSON.stringify({
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text },
  });
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'graph.facebook.com',
      path: `/v18.0/${phoneId}/messages`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { resolve({ status: res.statusCode, body: data }); });
    });
    req.on('error', (e) => { console.error('WA send error:', e.message); resolve({ status: 0, error: e.message }); });
    req.write(body);
    req.end();
  });
}

// Bot conversation step logic
async function handleWaBotStep(from, text, tenantId) {
  const convos = loadWaConvos();
  const key = `${tenantId}:${from}`;
  const creds = loadWaCreds()[tenantId];
  if (!creds) return; // no WA credentials registered for this tenant

  let c = convos[key] || { step: 0, from_phone: from, tenant_id: tenantId, started_at: new Date().toISOString() };

  const reply = async (msg) => {
    await sendWaMessage(creds.phone_id, creds.token, from, msg);
  };

  if (c.step === 0) {
    // First contact — greet and ask name
    c.step = 1;
    await reply(`👋 Hello! Welcome to FrontStores.\n\nI'm here to help you find the right software for your business.\n\nCould you please tell me *your name*?`);
  } else if (c.step === 1) {
    c.name = text.trim();
    c.step = 2;
    await reply(`Nice to meet you, ${c.name}! 😊\n\nWhat is the *name of your business or company*?`);
  } else if (c.step === 2) {
    c.company = text.trim();
    c.step = 3;
    await reply(`Got it — *${c.company}*.\n\nWhat *type of business* do you run? (e.g. Medical Store, Restaurant, Grocery, Salon, etc.)`);
  } else if (c.step === 3) {
    c.business_type = text.trim();
    c.step = 4;
    await reply(`Interesting! And what kind of *software solution* are you looking for from FrontStores?\n\n(e.g. billing, inventory, customer management, CRM, etc.)`);
  } else if (c.step === 4) {
    c.software_interest = text.trim();
    c.step = 5;
    c.completed_at = new Date().toISOString();

    // Save as pending lead
    const leads = loadWaLeads();
    const existing = leads.findIndex(l => l.from_phone === from && l.tenant_id === tenantId && !l.imported);
    const lead = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      from_phone: from,
      from_name: c.name || '',
      company: c.company || '',
      business_type: c.business_type || '',
      software_interest: c.software_interest || '',
      message_preview: `Business: ${c.business_type}. Needs: ${c.software_interest}`,
      received_at: c.started_at,
      imported: false,
    };
    if (existing >= 0) leads[existing] = lead; else leads.push(lead);
    saveWaLeads(leads);

    await reply(`Thank you, ${c.name}! 🙏\n\nOur team is reviewing your information and will get back to you shortly.\n\nWe look forward to helping *${c.company}* with their ${c.business_type} software needs!`);
  } else {
    // Already captured
    await reply(`Hi ${c.name || 'there'}! We already have your information. Our team will be in touch with you soon. 😊`);
  }

  convos[key] = c;
  saveWaConvos(convos);
}
// A session is considered abandoned (crashed app, force-quit, etc.) if no heartbeat for this long —
// after which another device may claim it. Heartbeats should run well inside this window.
const SESSION_TTL_MS = 15 * 60 * 1000;
async function hashPin(pin) {
  const encoder = new TextEncoder ? new TextEncoder() : { encode: s => Buffer.from(s, 'utf8') };
  const data = encoder.encode('frontstores-mobile-' + pin);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Buffer.from(buf).toString('hex');
}

// ── Real-time SSE clients — Map<tenantId, Set<res>> ──────────────────────────
// [all apps] [all tenants] — tracks open SSE connections per tenant for instant push notifications
const sseClients = new Map();
function sseAdd(tenantId, res) {
  if (!sseClients.has(tenantId)) sseClients.set(tenantId, new Set());
  sseClients.get(tenantId).add(res);
}
function sseRemove(tenantId, res) {
  sseClients.get(tenantId)?.delete(res);
}
function sseBroadcast(tenantId, event, data) {
  const clients = sseClients.get(tenantId);
  if (!clients || clients.size === 0) return;
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try { client.write(msg); } catch { sseRemove(tenantId, client); }
  }
}

// [all apps] [all tenants] — dedicated announcement SSE (no auth, works for ALL tenants incl. non-Cloud-Sync)
const announceClients = new Set();
function announceSseAdd(res) { announceClients.add(res); }
function announceSseRemove(res) { announceClients.delete(res); }
function announceBroadcast(data) {
  const msg = `event: announcement-new\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of announceClients) {
    try { client.write(msg); } catch { announceSseRemove(client); }
  }
}

function generateSyncCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(6))).map(b => chars[b % chars.length]).join('');
}

// ── Sync helpers ─────────────────────────────────────────────────────────────
function syncFile(tenantId) { return path.join(SYNC_DIR, `${tenantId}.json`); }
function loadSync(tenantId) {
  try { return JSON.parse(fs.readFileSync(syncFile(tenantId), 'utf8')); } catch { return null; }
}
function saveSync(tenantId, data) {
  fs.writeFileSync(syncFile(tenantId), JSON.stringify(data));
}

// ── Data helpers ────────────────────────────────────────────────────────────
function loadSubs()         { try { return JSON.parse(fs.readFileSync(SUBS_FILE,      'utf8')); } catch { return {}; } }
function saveSubs(d)        { fs.writeFileSync(SUBS_FILE,      JSON.stringify(d, null, 2)); }
function loadErrors()       { try { return JSON.parse(fs.readFileSync(ERRORS_FILE,    'utf8')); } catch { return []; } }
function loadContacts()     { try { return JSON.parse(fs.readFileSync(CONTACTS_FILE,  'utf8')); } catch { return []; } }
function saveContacts(d)    { fs.writeFileSync(CONTACTS_FILE,  JSON.stringify(d, null, 2)); }
function saveErrors(d)      { fs.writeFileSync(ERRORS_FILE, JSON.stringify(d, null, 2)); }
function loadActivity()     { try { return JSON.parse(fs.readFileSync(ACTIVITY_FILE,  'utf8')); } catch { return []; } }
function saveActivity(d)    { fs.writeFileSync(ACTIVITY_FILE,  JSON.stringify(d, null, 2)); }
// [core] [all apps] [all tenants] — announcements silently polled by every desktop app
function loadAnnouncements()  { try { return JSON.parse(fs.readFileSync(ANNOUNCEMENTS_FILE, 'utf8')); } catch { return []; } }
function saveAnnouncements(d) { fs.writeFileSync(ANNOUNCEMENTS_FILE, JSON.stringify(d, null, 2)); }
function loadNotes()        { try { return JSON.parse(fs.readFileSync(NOTES_FILE,     'utf8')); } catch { return {}; } }
function saveNotes(d)       { fs.writeFileSync(NOTES_FILE,     JSON.stringify(d, null, 2)); }

// Merge incoming sync data — update existing records by id using last-write-wins on updated_at
// Non-table keys riding along in the sync payload — every other array-valued key
// is treated as a synced table, so this works for any app's table set without
// per-shopType configuration.
const SYNC_META_KEYS = new Set(['tenant_id', 'sync_code', 'is_delta', 'shop_name', 'shop_type', 'synced_at']);
function syncTableNames(obj) {
  return Object.keys(obj || {}).filter(k => !SYNC_META_KEYS.has(k) && Array.isArray(obj[k]));
}

function mergeSyncData(existing, incoming) {
  const tables = new Set([...syncTableNames(existing), ...syncTableNames(incoming)]);
  const result = {};
  for (const table of tables) {
    const incomingRows = incoming[table];
    if (!Array.isArray(incomingRows)) { result[table] = existing[table] || []; continue; }
    const existingMap = {};
    for (const r of (existing[table] || [])) if (r && r.id) existingMap[r.id] = r;
    for (const r of incomingRows) {
      if (!r || !r.id) continue;
      const ex = existingMap[r.id];
      // Last-write-wins: keep whichever has newer updated_at
      if (!ex || !ex.updated_at || !r.updated_at || r.updated_at >= ex.updated_at) {
        existingMap[r.id] = r;
      }
    }
    result[table] = Object.values(existingMap);
  }
  return result;
}

function fmtINR(n) { return '₹' + Number(n||0).toLocaleString('en-IN', { maximumFractionDigits: 0 }); }
function fmtDate(iso) { try { return new Date(iso).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }); } catch { return iso||''; } }

function buildMobileDashboard(data) {
  const today = new Date().toISOString().slice(0, 10);
  const allJobs = (data.jobs || []).filter(j => !j.deleted_at);
  const todayJobs = allJobs.filter(j => (j.created_at||'').startsWith(today));
  const todayRevenue = todayJobs.filter(j => j.status === 'delivered').reduce((s, j) => s + (j.total||0), 0);
  const activeJobs = todayJobs.filter(j => j.status !== 'delivered');
  const recentJobs = allJobs.sort((a, b) => (b.created_at||'').localeCompare(a.created_at||'')).slice(0, 30);
  const statusColor = { waiting: '#d97706', in_progress: '#2563eb', ready: '#7c3aed', delivered: '#16a34a' };
  const statusLabel = { waiting: 'Waiting', in_progress: 'In Progress', ready: 'Ready', delivered: 'Delivered' };
  const syncAge = data.synced_at ? Math.round((Date.now() - new Date(data.synced_at).getTime()) / 60000) : null;
  const syncLabel = syncAge === null ? 'Never synced' : syncAge < 1 ? 'Just now' : syncAge < 60 ? `${syncAge}m ago` : syncAge < 1440 ? `${Math.floor(syncAge/60)}h ago` : `${Math.floor(syncAge/1440)}d ago`;

  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<meta name="apple-mobile-web-app-capable" content="yes">
<title>${data.shop_name||'Shop'} Dashboard</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#f1f5f9;min-height:100vh}
.header{background:linear-gradient(135deg,#f59e0b,#d97706);padding:16px 20px 12px;position:sticky;top:0;z-index:100}
.header h1{font-size:18px;font-weight:800;color:#111;line-height:1.2}
.header .sync{font-size:11px;color:#78350f;margin-top:2px}
.tabs{display:flex;background:#1e293b;border-bottom:1px solid #334155;position:sticky;top:56px;z-index:99}
.tab{flex:1;padding:10px 4px;text-align:center;font-size:11px;font-weight:600;color:#64748b;cursor:pointer;border-bottom:2px solid transparent;transition:.2s}
.tab.active{color:#f59e0b;border-color:#f59e0b}
.page{display:none;padding:16px}
.page.active{display:block}
.stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}
.stat{background:#1e293b;border-radius:14px;padding:14px;border:1px solid #334155}
.stat .label{font-size:11px;color:#64748b;margin-bottom:4px}
.stat .val{font-size:22px;font-weight:800}
.card{background:#1e293b;border-radius:14px;padding:14px;margin-bottom:10px;border:1px solid #334155}
.card .top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px}
.card .job-num{font-size:13px;font-weight:700;color:#f59e0b}
.card .amount{font-size:15px;font-weight:800;color:#f59e0b}
.badge{display:inline-block;padding:3px 8px;border-radius:20px;font-size:10px;font-weight:700;text-transform:capitalize}
.card .reg{font-size:14px;font-weight:700;color:#f1f5f9;margin-bottom:3px}
.card .sub{font-size:12px;color:#94a3b8}
.card .services{font-size:11px;color:#64748b;margin-top:4px}
.empty{text-align:center;padding:40px 20px;color:#475569;font-size:14px}
.section-title{font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px}
.customer-card{background:#1e293b;border-radius:14px;padding:12px;margin-bottom:8px;border:1px solid #334155;display:flex;align-items:center;gap:12px}
.avatar{width:40px;height:40px;border-radius:50%;background:#f59e0b;display:flex;align-items:center;justify-content:center;font-weight:800;color:#111;font-size:16px;flex-shrink:0}
.customer-info .name{font-weight:700;font-size:14px}
.customer-info .phone{font-size:12px;color:#94a3b8;margin-top:2px}
.search-input{width:100%;background:#1e293b;border:1px solid #334155;border-radius:12px;padding:10px 14px;color:#f1f5f9;font-size:14px;margin-bottom:12px;outline:none}
.search-input:focus{border-color:#f59e0b}
</style></head>
<body>
<div class="header">
  <h1>🚗 ${data.shop_name||'Car Wash'}</h1>
  <div class="sync">☁️ Synced ${syncLabel}</div>
</div>
<div class="tabs">
  <div class="tab active" onclick="showTab('dashboard')">📊 Dashboard</div>
  <div class="tab" onclick="showTab('active')">🔄 Active (${activeJobs.length})</div>
  <div class="tab" onclick="showTab('history')">📋 History</div>
  <div class="tab" onclick="showTab('customers')">👥 Customers</div>
</div>

<div id="dashboard" class="page active">
  <div class="stat-grid">
    <div class="stat"><div class="label">Today's Revenue</div><div class="val" style="color:#f59e0b">${fmtINR(todayRevenue)}</div></div>
    <div class="stat"><div class="label">Jobs Today</div><div class="val" style="color:#2563eb">${todayJobs.length}</div></div>
    <div class="stat"><div class="label">Active Now</div><div class="val" style="color:#d97706">${activeJobs.length}</div></div>
    <div class="stat"><div class="label">Completed</div><div class="val" style="color:#16a34a">${todayJobs.filter(j=>j.status==='delivered').length}</div></div>
  </div>
  ${activeJobs.length > 0 ? `
  <div class="section-title">Active Jobs</div>
  ${activeJobs.map(j => `
  <div class="card">
    <div class="top"><span class="job-num">${j.job_number||''}</span><span class="badge" style="background:${(statusColor[j.status]||'#475569')}22;color:${statusColor[j.status]||'#94a3b8'}">${statusLabel[j.status]||j.status}</span></div>
    <div class="reg">🚗 ${j.reg_number||''}${j.make?` · ${j.make}`:''}${j.model?` ${j.model}`:''}</div>
    ${j.customer_name?`<div class="sub">👤 ${j.customer_name}${j.customer_phone?` · ${j.customer_phone}`:''}</div>`:''}
    ${j.staff_name?`<div class="sub">🧑 ${j.staff_name}</div>`:''}
  </div>`).join('')}` : '<div class="empty">No active jobs right now</div>'}
</div>

<div id="active" class="page">
  ${activeJobs.length === 0 ? '<div class="empty">No active jobs</div>' : activeJobs.map(j => `
  <div class="card">
    <div class="top"><span class="job-num">${j.job_number||''}</span><span class="badge" style="background:${(statusColor[j.status]||'#475569')}22;color:${statusColor[j.status]||'#94a3b8'}">${statusLabel[j.status]||j.status}</span></div>
    <div class="reg">🚗 ${j.reg_number||''}${j.vehicle_type?` · ${j.vehicle_type}`:''}</div>
    ${j.make||j.model?`<div class="sub">${[j.make,j.model,j.color].filter(Boolean).join(' · ')}</div>`:''}
    ${j.customer_name?`<div class="sub">👤 ${j.customer_name}${j.customer_phone?` · ${j.customer_phone}`:''}</div>`:''}
    ${j.staff_name?`<div class="sub">🧑 ${j.staff_name}</div>`:''}
  </div>`).join('')}
</div>

<div id="history" class="page">
  <div class="section-title">Recent Jobs</div>
  ${recentJobs.map(j => `
  <div class="card">
    <div class="top">
      <div><span class="job-num">${j.job_number||''}</span> <span style="font-size:11px;color:#64748b">${fmtDate(j.created_at)}</span></div>
      <div><div class="amount">${fmtINR(j.total)}</div><div style="text-align:right;margin-top:2px"><span class="badge" style="background:${(statusColor[j.status]||'#475569')}22;color:${statusColor[j.status]||'#94a3b8'}">${statusLabel[j.status]||j.status}</span></div></div>
    </div>
    <div class="reg">🚗 ${j.reg_number||''}</div>
    ${j.customer_name?`<div class="sub">👤 ${j.customer_name}</div>`:''}
  </div>`).join('')}
</div>

<div id="customers" class="page">
  <input class="search-input" id="cust-search" placeholder="🔍 Search customers..." oninput="filterCustomers(this.value)">
  <div id="cust-list">
  ${(data.customers||[]).filter(c=>!c.deleted_at).slice(0,50).map(c=>`
  <div class="customer-card" data-name="${(c.name||'').toLowerCase()}" data-phone="${c.phone||''}">
    <div class="avatar">${(c.name||'?')[0].toUpperCase()}</div>
    <div class="customer-info"><div class="name">${c.name||'—'}</div><div class="phone">${c.phone||'No phone'}</div></div>
  </div>`).join('')}
  </div>
</div>

<script>
function showTab(id) {
  document.querySelectorAll('.tab').forEach((t,i) => t.classList.toggle('active', ['dashboard','active','history','customers'][i]===id));
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id===id));
}
function filterCustomers(q) {
  const v = q.toLowerCase();
  document.querySelectorAll('#cust-list .customer-card').forEach(c => {
    c.style.display = (c.dataset.name.includes(v) || c.dataset.phone.includes(v)) ? '' : 'none';
  });
}
</script>
</body></html>`;
}

function logActivity(tenantId, shopName, action, detail='') {
  const log = loadActivity();
  log.unshift({ id: crypto.randomUUID(), tenant_id: tenantId, shop_name: shopName, action, detail, at: new Date().toISOString() });
  if (log.length > 500) log.length = 500; // keep last 500
  saveActivity(log);
}

function addDays(from, days) {
  const d = new Date(from); d.setDate(d.getDate() + days);
  return d.toISOString().replace('T',' ').substring(0,19);
}
function addMonths(from, months) {
  const d = new Date(from); d.setMonth(d.getMonth() + months);
  return d.toISOString().replace('T',' ').substring(0,19);
}
function readBody(req) {
  return new Promise(r => { let b=''; req.on('data',c=>b+=c); req.on('end',()=>r(b)); });
}
function json(res, data, status=200) {
  res.writeHead(status, {'Content-Type':'application/json'});
  res.end(JSON.stringify(data));
}
function checkAuth(req) {
  const auth = req.headers['authorization'] || '';
  return auth === `Basic ${Buffer.from(`:${ADMIN_PASSWORD}`).toString('base64')}`;
}

// ── PUBLIC SERVER — port 3001 — tunneled to update.frontstores.com ──────────
const publicServer = http.createServer(async (req, res) => {
  const url      = new URL(req.url, `http://localhost:${PUBLIC_PORT}`);
  const pathname = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // GET /lookup-tenant?phone=xxx (primary) or ?email=xxx (fallback) — used by reinstall flow to find existing tenant
  if (req.method === 'GET' && pathname === '/lookup-tenant') {
    if (rateLimit(req, res, 'lookup-tenant', 20, 60 * 60 * 1000)) return;
    const phone = url.searchParams.get('phone')?.trim();
    const email = url.searchParams.get('email')?.toLowerCase().trim();
    if (!phone && !email) { json(res, { found: false }); return; }
    const subs = loadSubs();
    let match = null;
    // Phone is the guaranteed identity key — match on the last 10 digits (handles +91, spaces, etc.)
    if (phone) {
      const p = phone.replace(/\D/g, '');
      if (p.length >= 10) {
        match = Object.values(subs).find(s => {
          const sp = String(s.phone || '').replace(/\D/g, '');
          return sp.length >= 10 && sp.slice(-10) === p.slice(-10);
        }) || null;
      }
    }
    // Email is optional — only used as a fallback when phone doesn't resolve
    if (!match && email) {
      match = Object.values(subs).find(s => s.email?.toLowerCase().trim() === email) || null;
    }
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

  // POST /verify-pin-reset — self-service password reset using phone + Cloud Sync PIN
  // Only works for tenants who've enabled Cloud Sync and set a mobile PIN — no admin involvement needed.
  if (req.method === 'POST' && pathname === '/verify-pin-reset') {
    if (rateLimit(req, res, 'verify-pin-reset', 5, 60 * 60 * 1000)) return;
    try {
      const { phone, pin_hash } = JSON.parse(await readBody(req));
      if (!phone || !pin_hash) { json(res, { ok: false, error: 'Missing fields' }, 400); return; }
      const p = String(phone).replace(/\D/g, '');
      if (p.length < 10) { json(res, { ok: false, error: 'Enter a valid mobile number' }, 400); return; }
      const subs = loadSubs();
      const entry = Object.entries(subs).find(([, s]) => {
        const sp = String(s.phone || '').replace(/\D/g, '');
        return sp.length >= 10 && sp.slice(-10) === p.slice(-10);
      });
      if (!entry) { json(res, { ok: false, error: 'No account found with that mobile number' }, 404); return; }
      const [tenantId, sub] = entry;
      if (!sub.sync_enabled || !sub.mobile_pin_hash) {
        json(res, { ok: false, error: 'Self-service reset needs Cloud Sync + a PIN set up first. Use the support reset code instead, or set up Cloud Sync from Settings.' }, 403);
        return;
      }
      if (sub.mobile_pin_hash !== pin_hash) { json(res, { ok: false, error: 'Incorrect PIN' }, 401); return; }
      logActivity(tenantId, sub.shop_name, 'pin_password_reset', 'Password reset via phone + Cloud Sync PIN (self-service)');
      json(res, { ok: true, tenant_id: tenantId });
    } catch {
      json(res, { ok: false, error: 'Invalid request' }, 400);
    }
    return;
  }

  // ── Single-session enforcement (best-effort — only when online) ─────────────
  // One tenant_id should only be "active" on one device at a time. Each login
  // claims a session; the owning device renews it via heartbeat. If a device goes
  // offline/crashes, its session naturally expires after SESSION_TTL_MS and
  // another device can claim it. This is advisory, not a hard lock — the app
  // must keep working fully offline even if the server can't be reached.

  // Session slots are keyed by `tenant_id::username` so the owner and each
  // staff login (each their own username under the same tenant) hold separate
  // slots — only the SAME login is blocked from running on two devices at once.
  const sessionKey = (tenant_id, username) => `${tenant_id}::${username || 'owner'}`;

  // POST /session/claim — { tenant_id, username, device_id, device_name }
  if (req.method === 'POST' && pathname === '/session/claim') {
    if (rateLimit(req, res, 'session-claim', 60, 60 * 60 * 1000)) return;
    try {
      const { tenant_id, username, device_id, device_name } = JSON.parse(await readBody(req));
      if (!tenant_id || !device_id) { json(res, { ok: false, error: 'Missing fields' }, 400); return; }
      const key = sessionKey(tenant_id, username);
      const sessions = loadSessions();
      const existing = sessions[key];
      const isStale = existing && (Date.now() - new Date(existing.last_heartbeat).getTime()) > SESSION_TTL_MS;
      if (existing && existing.device_id !== device_id && !isStale) {
        json(res, {
          ok: false,
          error: `Already logged in on ${existing.device_name || 'another device'}`,
          active_device: existing.device_name || 'another device',
          active_since: existing.claimed_at,
        }, 409);
        return;
      }
      const session_id = crypto.randomBytes(16).toString('hex');
      sessions[key] = {
        session_id,
        device_id,
        device_name: sanitize(device_name, 60) || 'Unknown device',
        claimed_at: existing && existing.device_id === device_id ? existing.claimed_at : new Date().toISOString(),
        last_heartbeat: new Date().toISOString(),
      };
      saveSessions(sessions);
      json(res, { ok: true, session_id });
    } catch {
      json(res, { ok: false, error: 'Invalid request' }, 400);
    }
    return;
  }

  // POST /session/heartbeat — { tenant_id, username, device_id, session_id }
  if (req.method === 'POST' && pathname === '/session/heartbeat') {
    if (rateLimit(req, res, 'session-heartbeat', 240, 60 * 60 * 1000)) return;
    try {
      const { tenant_id, username, device_id, session_id } = JSON.parse(await readBody(req));
      const key = sessionKey(tenant_id, username);
      const sessions = loadSessions();
      const existing = sessions[key];
      if (!existing || existing.session_id !== session_id || existing.device_id !== device_id) {
        json(res, { ok: false, error: 'Session no longer active on this device' }, 409);
        return;
      }
      existing.last_heartbeat = new Date().toISOString();
      saveSessions(sessions);
      json(res, { ok: true });
    } catch {
      json(res, { ok: false, error: 'Invalid request' }, 400);
    }
    return;
  }

  // POST /session/release — { tenant_id, username, device_id, session_id } — called on logout
  if (req.method === 'POST' && pathname === '/session/release') {
    if (rateLimit(req, res, 'session-release', 60, 60 * 60 * 1000)) return;
    try {
      const { tenant_id, username, device_id, session_id } = JSON.parse(await readBody(req));
      const key = sessionKey(tenant_id, username);
      const sessions = loadSessions();
      const existing = sessions[key];
      if (existing && existing.session_id === session_id && existing.device_id === device_id) {
        delete sessions[key];
        saveSessions(sessions);
      }
      json(res, { ok: true });
    } catch {
      json(res, { ok: false, error: 'Invalid request' }, 400);
    }
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

  // POST /ai/chat — AI assistant, auto-selects best available model (gemma3:4b preferred, dolphin3 fallback)
  // Supports streaming SSE when request body includes stream: true
  // Rate limit: 60 requests per minute per IP
  if (req.method === 'POST' && pathname === '/ai/chat') {
    if (rateLimit(req, res, 'ai-chat', 60, 60 * 1000)) return;
    const body = await readBody(req);
    try {
      const { tenant_id, messages, model: requestedModel, stream: wantStream } = JSON.parse(body);
      if (!tenant_id || !Array.isArray(messages) || messages.length === 0) {
        res.writeHead(400); res.end('Missing tenant_id or messages'); return;
      }
      // Auto-select: use requested model, else gemma3 if available, else dolphin3
      let model = requestedModel || 'gemma3:4b';
      try {
        const tagRes = await fetch('http://localhost:11434/api/tags');
        const tagData = await tagRes.json();
        const names = (tagData.models||[]).map(m => m.name);
        if (!names.some(n => n.startsWith(model.split(':')[0]))) {
          model = names.find(n => n.startsWith('dolphin3')) || names[0] || 'gemma3:4b';
        }
      } catch {}

      if (wantStream) {
        // Streaming mode — SSE [study] [all tenants]
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        });

        const ollamaRes = await fetch('http://localhost:11434/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: messages.map(m => ({ role: sanitize(m.role, 20), content: sanitize(m.content, 16000) })),
            stream: true,
            options: { temperature: 0.3, num_predict: 2048 },
          }),
        });

        if (!ollamaRes.ok) {
          res.write('data: [ERROR]\n\n');
          res.end();
          return;
        }

        const reader = ollamaRes.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() || '';
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const chunk = JSON.parse(line);
              if (chunk.message?.content) {
                res.write(`data: ${JSON.stringify({ content: chunk.message.content })}\n\n`);
              }
              if (chunk.done) { res.write('data: [DONE]\n\n'); res.end(); return; }
            } catch {}
          }
        }
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        // Non-streaming mode (used by MCQ/flashcard generators)
        const ollamaRes = await fetch('http://localhost:11434/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: messages.map(m => ({
              role: sanitize(m.role, 20),
              content: sanitize(m.content, 16000),
            })),
            stream: false,
            options: { temperature: 0.3, num_predict: 2048 },
          }),
        });

        if (!ollamaRes.ok) {
          const errText = await ollamaRes.text();
          console.error(`AI error: ${errText.substring(0, 200)}`);
          res.writeHead(503); res.end(JSON.stringify({ error: 'AI service unavailable' })); return;
        }

        const data = await ollamaRes.json();
        json(res, { ok: true, content: data.message?.content || '' });
      }
    } catch (e) {
      console.error(`AI chat error: ${e.message}`);
      if (!res.headersSent) { res.writeHead(503); res.end(JSON.stringify({ error: 'AI not available' })); }
    }
    return;
  }

  // GET /ai/status — check if Ollama + any supported model is ready
  if (req.method === 'GET' && pathname === '/ai/status') {
    try {
      const r = await fetch('http://localhost:11434/api/tags');
      if (!r.ok) { json(res, { available: false }); return; }
      const data = await r.json();
      const models = data.models || [];
      const hasGemma   = models.some(m => m.name.startsWith('gemma3'));
      const hasDolphin = models.some(m => m.name.startsWith('dolphin3'));
      json(res, { available: hasGemma || hasDolphin, model: hasGemma ? 'gemma3:4b' : hasDolphin ? 'dolphin3' : null });
    } catch {
      json(res, { available: false });
    }
    return;
  }

  // POST /ai/study/websearch — [study] search the web via DuckDuckGo and return context snippets
  if (req.method === 'POST' && pathname === '/ai/study/websearch') {
    if (rateLimit(req, res, 'ai-study-search', 20, 60 * 1000)) return;
    const body = await readBody(req);
    try {
      const { query } = JSON.parse(body);
      if (!query) { res.writeHead(400); res.end('Missing query'); return; }
      const q = encodeURIComponent(sanitize(query, 200));
      const results = [];

      // 1. DuckDuckGo Instant Answers (JSON, free, no key)
      try {
        const iaRes = await fetch(`https://api.duckduckgo.com/?q=${q}&format=json&no_html=1&skip_disambig=1`, {
          headers: { 'User-Agent': 'StudyMate/1.0' }, signal: AbortSignal.timeout(6000),
        });
        const ia = await iaRes.json();
        if (ia.AbstractText) results.push({ source: ia.AbstractSource || 'Web', text: ia.AbstractText });
        if (ia.Answer)       results.push({ source: 'Direct Answer', text: ia.Answer });
        for (const t of (ia.RelatedTopics || []).slice(0, 3)) {
          if (t.Text && t.Text.length > 40) results.push({ source: t.FirstURL || '', text: t.Text });
        }
      } catch {}

      // 2. DuckDuckGo HTML search for more results
      if (results.length < 3) {
        try {
          const htmlRes = await fetch(`https://html.duckduckgo.com/html/?q=${q}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
            signal: AbortSignal.timeout(8000),
          });
          const html = await htmlRes.text();
          const snippets = [...html.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)].slice(0, 5);
          for (const m of snippets) {
            const text = m[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim();
            if (text.length > 50) results.push({ source: 'Web', text });
          }
        } catch {}
      }

      json(res, { ok: true, results: results.slice(0, 5) });
    } catch (e) {
      console.error('websearch error:', e);
      json(res, { ok: false, results: [] });
    }
    return;
  }

  // POST /ai/study/test — [study] generate mock test MCQs via Ollama
  if (req.method === 'POST' && pathname === '/ai/study/test') {
    if (rateLimit(req, res, 'ai-study-test', 10, 60 * 1000)) return;
    const body = await readBody(req);
    try {
      const { tenant_id, subject, chapter, count, class_grade } = JSON.parse(body);
      if (!tenant_id || !subject || !chapter) { res.writeHead(400); res.end('Missing fields'); return; }
      const prompt = `Generate exactly ${count || 10} multiple choice questions for a student${class_grade ? ` in class ${class_grade}` : ''} on the topic: "${sanitize(chapter, 200)}" in subject: "${sanitize(subject, 100)}".
Return ONLY a valid JSON array with exactly ${count || 10} objects. Each object must have these exact keys:
{"question_no":(number),"question":"...","option_a":"...","option_b":"...","option_c":"...","option_d":"...","correct_answer":"A" or "B" or "C" or "D","explanation":"..."}
Mix easy, medium, and hard questions. Return ONLY the JSON array, no other text.`;
      const ollamaRes = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gemma3:4b', messages: [{ role: 'system', content: 'You are a test generator. Return only valid JSON arrays, no markdown, no code blocks.' }, { role: 'user', content: prompt }], stream: false, options: { temperature: 0.4, num_predict: 4096 } }),
      });
      if (!ollamaRes.ok) { res.writeHead(503); res.end(JSON.stringify({ error: 'AI unavailable' })); return; }
      const data = await ollamaRes.json();
      json(res, { ok: true, content: data.message?.content || '' });
    } catch (e) { console.error('study/test error:', e); res.writeHead(503); res.end(JSON.stringify({ error: 'AI not available' })); }
    return;
  }

  // POST /ai/study/flashcards — [study] generate flashcards from notes via Ollama
  if (req.method === 'POST' && pathname === '/ai/study/flashcards') {
    if (rateLimit(req, res, 'ai-study-fc', 10, 60 * 1000)) return;
    const body = await readBody(req);
    try {
      const { tenant_id, notes, subject } = JSON.parse(body);
      if (!tenant_id || !notes) { res.writeHead(400); res.end('Missing fields'); return; }
      const prompt = `Read the following study notes and create flashcards from them.${subject ? `\nSubject: ${sanitize(subject, 100)}` : ''}
Notes:\n${sanitize(notes, 4000)}
Return ONLY a valid JSON array of flashcard objects. Each object must have:
{"front":"question or key term","back":"answer or definition"}
Create 8-15 flashcards covering all key concepts. Return ONLY the JSON array, no other text.`;
      const ollamaRes = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gemma3:4b', messages: [{ role: 'system', content: 'You are a flashcard generator. Return only valid JSON arrays, no markdown, no code blocks.' }, { role: 'user', content: prompt }], stream: false, options: { temperature: 0.3, num_predict: 2048 } }),
      });
      if (!ollamaRes.ok) { res.writeHead(503); res.end(JSON.stringify({ error: 'AI unavailable' })); return; }
      const data = await ollamaRes.json();
      json(res, { ok: true, content: data.message?.content || '' });
    } catch (e) { console.error('study/flashcards error:', e); res.writeHead(503); res.end(JSON.stringify({ error: 'AI not available' })); }
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
        // Only clear token if admin hasn't already set one — don't wipe a pre-set code
        if (!subs[tenant_id].reset_token) {
          subs[tenant_id].reset_token = null;
          subs[tenant_id].reset_token_expires = null;
        }
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

  // POST /register-app-type — [core] [all tenants]
  // Existing tenant requests access to a different app type
  if (req.method === 'POST' && pathname === '/register-app-type') {
    if (rateLimit(req, res, 'register-app-type', 5, 60 * 60 * 1000)) return;
    const body = await readBody(req);
    try {
      const { existing_tenant_id, shop_type, shop_name, owner_name, phone, email, city } = JSON.parse(body);
      if (!existing_tenant_id || !shop_type || !shop_name) { res.writeHead(400); res.end('Missing fields'); return; }
      const subs = loadSubs();
      // Verify existing tenant exists
      if (!subs[existing_tenant_id]) { json(res, { ok: false, error: 'Your current account was not found. Please re-launch the app.' }); return; }
      const existingSub = subs[existing_tenant_id];
      // Check if this phone already has this app type registered
      const alreadyRegistered = Object.values(subs).find((s) =>
        (s.phone === sanitize(phone, 20) || s.email === sanitize(email, 200)) &&
        s.shop_type === sanitize(shop_type, 50) &&
        s.tenant_id !== existing_tenant_id
      );
      if (alreadyRegistered) {
        json(res, { ok: true, new_tenant_id: alreadyRegistered.tenant_id, status: alreadyRegistered.account_status, already_exists: true });
        return;
      }
      // Create new pending registration for this app type
      const newTenantId = crypto.randomUUID();
      subs[newTenantId] = {
        tenant_id:     newTenantId,
        shop_name:     sanitize(shop_name,  100),
        owner_name:    sanitize(owner_name, 100) || existingSub.owner_name,
        shop_type:     sanitize(shop_type,   50),
        phone:         sanitize(phone,        20) || existingSub.phone || '',
        email:         sanitize(email,       200) || existingSub.email || '',
        city:          sanitize(city,        100) || existingSub.city  || '',
        expires_at:    null,
        registered_at: new Date().toISOString(),
        account_status: 'pending',
        switch_request: { from_tenant_id: existing_tenant_id, requested_at: new Date().toISOString() },
      };
      saveSubs(subs);
      logActivity(newTenantId, sanitize(shop_name, 50), 'switch_request', `${existingSub.shop_type} → ${sanitize(shop_type, 50)}`);
      console.log(`🔄 App switch request: ${existingSub.shop_name} wants ${sanitize(shop_type, 50)} (new: ${newTenantId.substring(0,8)})`);
      json(res, { ok: true, new_tenant_id: newTenantId, status: 'pending' });
    } catch { res.writeHead(400); res.end('Bad request'); }
    return;
  }

  // GET /linked-apps?tenant_id=xxx — [core] [all tenants]
  // Returns all app registrations linked to the same owner (by phone or email)
  if (req.method === 'GET' && pathname === '/linked-apps') {
    const tenantId = url.searchParams.get('tenant_id');
    if (!tenantId) { res.writeHead(400); res.end('Missing tenant_id'); return; }
    const subs = loadSubs();
    const current = subs[tenantId];
    if (!current) { json(res, { apps: [] }); return; }
    // Find all subs with matching phone or email
    const phone = current.phone;
    const email = current.email;
    const linked = Object.values(subs).filter(s =>
      s.tenant_id !== tenantId &&
      ((phone && s.phone === phone) || (email && s.email === email))
    ).map(s => ({
      tenant_id:      s.tenant_id,
      shop_type:      s.shop_type,
      shop_name:      s.shop_name,
      account_status: s.account_status,
      expires_at:     s.expires_at,
      registered_at:  s.registered_at,
    }));
    // Include the current one too
    linked.unshift({
      tenant_id:      current.tenant_id,
      shop_type:      current.shop_type,
      shop_name:      current.shop_name,
      account_status: current.account_status,
      expires_at:     current.expires_at,
      registered_at:  current.registered_at,
    });
    json(res, { apps: linked }); return;
  }

  // Block any attempt to reach admin from public port
  if (pathname.startsWith('/admin')) { res.writeHead(403); res.end('Forbidden'); return; }

  // ── CLOUD SYNC ENDPOINTS ──────────────────────────────────────────────────

  // POST /sync/set-pin — desktop sets mobile access PIN for tenant
  if (req.method === 'POST' && pathname === '/sync/set-pin') {
    if (rateLimit(req, res, 'set-pin', 10, 60 * 60 * 1000)) return;
    const body = JSON.parse(await readBody(req));
    const { tenant_id, sync_code, pin_hash } = body;
    if (!tenant_id || !sync_code || !pin_hash) { json(res, { ok: false, error: 'Missing fields' }, 400); return; }
    const subs = loadSubs();
    const sub = subs[tenant_id];
    if (!sub || !sub.sync_enabled || sub.sync_code !== sync_code.trim().toUpperCase()) {
      json(res, { ok: false, error: 'Unauthorized' }, 401); return;
    }
    sub.mobile_pin_hash = pin_hash;
    saveSubs(subs);
    json(res, { ok: true });
    return;
  }

  // POST /device/register — Android device registers, pending admin approval
  if (req.method === 'POST' && pathname === '/device/register') {
    if (rateLimit(req, res, 'device-register', 10, 60 * 60 * 1000)) return;
    const body = JSON.parse(await readBody(req));
    const { phone, pin, device_id, device_name, platform, app_version } = body;
    if (!phone || !pin || !device_id) { json(res, { ok: false, error: 'Missing fields' }, 400); return; }
    // Find tenant by phone
    const subs = loadSubs();
    const entry = Object.entries(subs).find(([, s]) => {
      const p = String(s.phone || '').replace(/\D/g, '');
      return p.length >= 10 && phone.replace(/\D/g, '').endsWith(p.slice(-10));
    });
    if (!entry) { json(res, { ok: false, error: 'No shop found for this phone number' }, 404); return; }
    const [tenantId, sub] = entry;
    if (!sub.sync_enabled) { json(res, { ok: false, error: 'Cloud sync not enabled for this shop. Contact shop owner.' }, 403); return; }
    if (!sub.mobile_pin_hash) { json(res, { ok: false, error: 'Mobile PIN not set. Ask owner to set it from desktop app Settings → Cloud Sync.' }, 403); return; }
    // Validate PIN
    const pinHash = await hashPin(pin);
    if (pinHash !== sub.mobile_pin_hash) { json(res, { ok: false, error: 'Incorrect PIN' }, 401); return; }
    // Register device
    const devices = loadDevices();
    const existing = devices[device_id];
    if (existing && existing.status === 'approved' && existing.tenant_id === tenantId) {
      // Already approved — return session token
      json(res, { ok: true, status: 'approved', tenant_id: tenantId, shop_name: sub.shop_name, shop_type: sub.shop_type, session_token: existing.session_token });
      return;
    }
    if (existing && existing.status === 'revoked') {
      json(res, { ok: false, error: 'This device has been revoked. Contact your administrator.' }, 403); return;
    }
    // New device or re-registering pending device
    const sessionToken = crypto.randomBytes(32).toString('hex');
    devices[device_id] = {
      tenant_id: tenantId, shop_name: sub.shop_name, shop_type: sub.shop_type,
      device_name: device_name || 'Unknown Device', platform: platform || 'android',
      app_version: app_version || '', status: 'pending', session_token: sessionToken,
      registered_at: new Date().toISOString(), approved_at: null,
    };
    saveDevices(devices);
    logActivity(tenantId, sub.shop_name, 'device_registered', `New device: ${device_name||'Unknown'} (${platform||'android'}) — awaiting approval`);
    console.log(`📱 New device registered for ${sub.shop_name}: ${device_name} — PENDING APPROVAL`);
    json(res, { ok: true, status: 'pending', tenant_id: tenantId, shop_name: sub.shop_name, shop_type: sub.shop_type });
    return;
  }

  // GET /device/status/:device_id — polling for approval
  const deviceStatus = pathname.match(/^\/device\/status\/([a-zA-Z0-9_-]{10,})$/);
  if (req.method === 'GET' && deviceStatus) {
    const device_id = deviceStatus[1];
    const devices = loadDevices();
    const device = devices[device_id];
    if (!device) { json(res, { status: 'not_found' }); return; }
    if (device.status === 'approved') {
      const subs = loadSubs();
      const sub = subs[device.tenant_id];
      json(res, { status: 'approved', tenant_id: device.tenant_id, shop_name: device.shop_name, shop_type: device.shop_type, session_token: device.session_token, sync_enabled: sub?.sync_enabled });
    } else {
      json(res, { status: device.status });
    }
    return;
  }

  // POST /device/sync — approved device pulls sync data
  if (req.method === 'POST' && pathname === '/device/sync') {
    const body = JSON.parse(await readBody(req));
    const { device_id, session_token } = body;
    if (!device_id || !session_token) { json(res, { ok: false, error: 'Missing auth' }, 400); return; }
    const devices = loadDevices();
    const device = devices[device_id];
    if (!device || device.status !== 'approved' || device.session_token !== session_token) {
      json(res, { ok: false, error: 'Unauthorized' }, 401); return;
    }
    const syncData = loadSync(device.tenant_id);
    if (!syncData) { json(res, { ok: false, error: 'No sync data yet. Ask owner to sync from desktop Settings → Cloud Sync.' }, 404); return; }
    device.last_accessed_at = new Date().toISOString();
    saveDevices(devices);
    json(res, { ok: true, data: syncData }); return;
  }

  // GET /sync/pull/:tenant_id?since=ISO&sync_code=CODE — delta pull: records newer than `since`
  const syncPullMatch = pathname.match(/^\/sync\/pull\/([a-f0-9-]{36})$/);
  if (req.method === 'GET' && syncPullMatch) {
    if (rateLimit(req, res, 'sync-pull', 120, 60 * 60 * 1000)) return;
    const tenantId = syncPullMatch[1];
    const syncCode = url.searchParams.get('sync_code') ?? '';
    const since    = url.searchParams.get('since') ?? '';
    const subs = loadSubs();
    const sub = subs[tenantId];
    if (!sub || !sub.sync_enabled || sub.sync_code !== syncCode.trim().toUpperCase()) {
      json(res, { ok: false, error: 'Unauthorized' }, 401); return;
    }
    const stored = loadSync(tenantId);
    if (!stored) { json(res, { ok: true, delta: {}, server_time: new Date().toISOString() }); return; }
    if (!since) {
      // No since → return everything (first sync)
      json(res, { ok: true, delta: stored, server_time: new Date().toISOString(), full: true }); return;
    }
    // Return only records updated after `since` — table list is whatever this tenant's app actually synced
    const tables = syncTableNames(stored);
    const delta = {};
    let hasChanges = false;
    for (const table of tables) {
      const changed = (stored[table] || []).filter(r => r.updated_at && r.updated_at > since);
      if (changed.length > 0) { delta[table] = changed; hasChanges = true; }
    }
    json(res, { ok: true, delta, server_time: new Date().toISOString(), has_changes: hasChanges }); return;
  }

  // POST /sync/request — tenant requests Cloud Sync access; lands in admin approval queue
  if (req.method === 'POST' && pathname === '/sync/request') {
    if (rateLimit(req, res, 'sync-request', 5, 60 * 60 * 1000)) return;
    const body = JSON.parse(await readBody(req));
    const { tenant_id } = body;
    if (!tenant_id) { json(res, { ok: false, error: 'Missing tenant_id' }, 400); return; }
    const subs = loadSubs();
    const sub = subs[tenant_id];
    if (!sub) { json(res, { ok: false, error: 'Shop not found' }, 404); return; }
    if (sub.sync_enabled) { json(res, { ok: true, status: 'approved' }); return; }
    if (sub.sync_request_status !== 'pending') {
      sub.sync_request_status = 'pending';
      sub.sync_requested_at = new Date().toISOString();
      saveSubs(subs);
      logActivity(tenant_id, sub.shop_name, 'sync_requested', 'Requested Cloud Sync access');
      console.log(`☁️  ${sub.shop_name} requested Cloud Sync`);
    }
    json(res, { ok: true, status: 'pending' });
    return;
  }

  // GET /sync/status/:tenant_id — tenant polls request/approval status (tenant_id acts as the bearer, same as /license/:tenant_id)
  const syncStatusMatch = pathname.match(/^\/sync\/status\/([a-f0-9-]{36})$/);
  if (req.method === 'GET' && syncStatusMatch) {
    if (rateLimit(req, res, 'sync-status', 120, 60 * 60 * 1000)) return;
    const tenantId = syncStatusMatch[1];
    const sub = loadSubs()[tenantId];
    if (!sub) { json(res, { ok: false, error: 'Shop not found' }, 404); return; }
    json(res, {
      ok: true,
      enabled: !!sub.sync_enabled,
      request_status: sub.sync_request_status || null,
      sync_code: sub.sync_enabled ? sub.sync_code : null,
      dashboard_url: sub.sync_enabled ? `https://update.frontstores.com/shop/${tenantId}` : null,
    });
    return;
  }

  // ── Cloud Database — full persistent storage in cloud ─────────────────────────
  // [all apps] [all tenants] — separate from Cloud Sync; cloud becomes the primary DB
  // Approval required. Once approved, the server stores a full snapshot of all tenant data.

  // POST /cloud-db/request — { tenant_id } — request Cloud Database access
  if (req.method === 'POST' && pathname === '/cloud-db/request') {
    if (rateLimit(req, res, 'cloud-db-request', 5, 60 * 60 * 1000)) return;
    const body = await readBody(req);
    try {
      const { tenant_id } = JSON.parse(body);
      if (!tenant_id) { json(res, { ok: false, error: 'Missing tenant_id' }, 400); return; }
      const subs = loadSubs();
      const sub = subs[tenant_id];
      if (!sub) { json(res, { ok: false, error: 'Shop not found' }, 404); return; }
      if (sub.cloud_db_request_status !== 'pending') {
        sub.cloud_db_request_status = 'pending';
        sub.cloud_db_requested_at = new Date().toISOString();
        saveSubs(subs);
        logActivity(tenant_id, sub.shop_name, 'cloud_db_requested', 'Requested Cloud Database access');
        console.log(`🗄️  ${sub.shop_name} requested Cloud Database`);
      }
      json(res, { ok: true, status: 'pending' }); return;
    } catch { json(res, { ok: false, error: 'Bad request' }, 400); return; }
  }

  // GET /cloud-db/status/:tenant_id — poll approval status
  const cloudDbStatusMatch = pathname.match(/^\/cloud-db\/status\/([a-f0-9-]{36})$/);
  if (req.method === 'GET' && cloudDbStatusMatch) {
    if (rateLimit(req, res, 'cloud-db-status', 120, 60 * 60 * 1000)) return;
    const tenantId = cloudDbStatusMatch[1];
    const sub = loadSubs()[tenantId];
    if (!sub) { json(res, { ok: false, error: 'Shop not found' }, 404); return; }
    json(res, {
      ok: true,
      enabled: !!sub.cloud_db_enabled,
      request_status: sub.cloud_db_request_status || null,
      cloud_db_code: sub.cloud_db_enabled ? sub.cloud_db_code : null,
      last_snapshot_at: sub.cloud_db_last_snapshot_at || null,
    }); return;
  }

  // POST /cloud-db/push — { tenant_id, cloud_db_code, tables... } — store full DB snapshot
  if (req.method === 'POST' && pathname === '/cloud-db/push') {
    const body = await readBody(req);
    try {
      const data = JSON.parse(body);
      const { tenant_id, cloud_db_code } = data;
      if (!tenant_id || !cloud_db_code) { json(res, { ok: false, error: 'Missing fields' }, 400); return; }
      const subs = loadSubs();
      const sub = subs[tenant_id];
      if (!sub || !sub.cloud_db_enabled || sub.cloud_db_code !== cloud_db_code) {
        json(res, { ok: false, error: 'Not authorized' }, 403); return;
      }
      const snapshot_at = new Date().toISOString();
      saveCloudDb(tenant_id, { ...data, snapshot_at });
      sub.cloud_db_last_snapshot_at = snapshot_at;
      saveSubs(subs);
      json(res, { ok: true, snapshot_at }); return;
    } catch { json(res, { ok: false, error: 'Bad request' }, 400); return; }
  }

  // GET /cloud-db/pull/:tenant_id?code=xxx — retrieve latest full DB snapshot
  const cloudDbPullMatch = pathname.match(/^\/cloud-db\/pull\/([a-f0-9-]{36})$/);
  if (req.method === 'GET' && cloudDbPullMatch) {
    const tenantId = cloudDbPullMatch[1];
    const url2 = new URL(req.url, `http://localhost:${PUBLIC_PORT}`);
    const code = url2.searchParams.get('code');
    const subs = loadSubs();
    const sub = subs[tenantId];
    if (!sub || !sub.cloud_db_enabled || sub.cloud_db_code !== code) {
      json(res, { ok: false, error: 'Not authorized' }, 403); return;
    }
    const snapshot = loadCloudDb(tenantId);
    if (!snapshot) { json(res, { ok: true, has_data: false }); return; }
    json(res, { ok: true, has_data: true, ...snapshot }); return;
  }

  // ── Staff users v2 — auto-approved, no admin needed, server tracks for billing ────

  // POST /staff-user-create — { tenant_id, shop_code, staff_id, display_name, username, role, tab_access, created_at }
  if (req.method === 'POST' && pathname === '/staff-user-create') {
    if (rateLimit(req, res, 'staff-user-create', 30, 60 * 60 * 1000)) return;
    const body = await readBody(req);
    try {
      const { tenant_id, shop_code, staff_id, display_name, username, role, tab_access, created_at } = JSON.parse(body);
      if (!tenant_id || !staff_id || !username) { json(res, { ok: false, error: 'Missing fields' }, 400); return; }
      const subs = loadSubs();
      const sub = subs[tenant_id];
      if (!sub) { json(res, { ok: false, error: 'Shop not found' }, 404); return; }
      if (!sub.staff_users) sub.staff_users = {};
      if (!sub.staff_users[staff_id]) {
        sub.staff_users[staff_id] = {
          display_name: sanitize(display_name || username, 80),
          username: sanitize(username, 60),
          role: sanitize(role || '', 60),
          tab_access: Array.isArray(tab_access) ? tab_access : [],
          status: 'active',
          created_at: created_at || new Date().toISOString(),
        };
        // Register shop code if provided (used for multi-device join flow)
        if (shop_code && !sub.shop_code) sub.shop_code = sanitize(shop_code, 20);
        saveSubs(subs);
        logActivity(tenant_id, sub.shop_name, 'staff_user_created', `Created staff login "${sanitize(username, 60)}" (${sanitize(role || 'No role', 40)})`);
        console.log(`👥 ${sub.shop_name || tenant_id.substring(0, 8)}: staff "${sanitize(display_name || username, 40)}" created`);
      }
      json(res, { ok: true });
    } catch { json(res, { ok: false, error: 'Invalid request' }, 400); }
    return;
  }

  // POST /staff-user-deactivate — { tenant_id, staff_id, display_name, username, deactivated_at }
  if (req.method === 'POST' && pathname === '/staff-user-deactivate') {
    if (rateLimit(req, res, 'staff-user-deactivate', 30, 60 * 60 * 1000)) return;
    const body = await readBody(req);
    try {
      const { tenant_id, staff_id, display_name, username, deactivated_at } = JSON.parse(body);
      if (!tenant_id || !staff_id) { json(res, { ok: false, error: 'Missing fields' }, 400); return; }
      const subs = loadSubs();
      const sub = subs[tenant_id];
      if (!sub) { json(res, { ok: false, error: 'Shop not found' }, 404); return; }
      if (sub.staff_users?.[staff_id]) {
        sub.staff_users[staff_id].status = 'deactivated';
        sub.staff_users[staff_id].deactivated_at = deactivated_at || new Date().toISOString();
        saveSubs(subs);
        logActivity(tenant_id, sub.shop_name, 'staff_user_deactivated', `Deactivated staff login "${sanitize(username || '', 60)}"`);
        console.log(`👥 ${sub.shop_name || tenant_id.substring(0, 8)}: staff "${sanitize(display_name || username || '', 40)}" deactivated`);
      }
      json(res, { ok: true });
    } catch { json(res, { ok: false, error: 'Invalid request' }, 400); }
    return;
  }

  // GET /shop-code/:code — lookup tenant_id by shop code (for multi-device join)
  const shopCodeMatch = pathname.match(/^\/shop-code\/([A-Z0-9\-]{4,12})$/i);
  if (req.method === 'GET' && shopCodeMatch) {
    if (rateLimit(req, res, 'shop-code-lookup', 20, 60 * 60 * 1000)) return;
    const code = shopCodeMatch[1].toUpperCase();
    const subs = loadSubs();
    const entry = Object.entries(subs).find(([, s]) => s.shop_code === code);
    if (!entry) { json(res, { ok: false, error: 'Shop code not found' }, 404); return; }
    const [tenantId, sub] = entry;
    if (!sub.cloud_db_enabled) { json(res, { ok: false, error: 'Cloud Sync not enabled for this shop' }, 403); return; }
    json(res, { ok: true, tenant_id: tenantId, shop_name: sub.shop_name, shop_type: sub.shop_type });
    return;
  }

  // POST /join/verify-pin — { shop_code, pin } — verifies one-time join PIN, returns cloud snapshot
  if (req.method === 'POST' && pathname === '/join/verify-pin') {
    if (rateLimit(req, res, 'join-verify-pin', 10, 60 * 60 * 1000)) return;
    const body = await readBody(req);
    try {
      const { shop_code, pin } = JSON.parse(body);
      if (!shop_code || !pin) { json(res, { ok: false, error: 'Missing fields' }, 400); return; }
      const subs = loadSubs();
      const entry = Object.entries(subs).find(([, s]) => s.shop_code === shop_code.toUpperCase());
      if (!entry) { json(res, { ok: false, error: 'Invalid shop code' }, 404); return; }
      const [tenantId, sub] = entry;
      if (!sub.cloud_db_enabled) { json(res, { ok: false, error: 'Cloud Sync not enabled for this shop' }, 403); return; }
      const snapshot = loadCloudDb(tenantId);
      if (!snapshot) { json(res, { ok: false, error: 'No data on server — ask owner to open the app first' }, 404); return; }

      // Find matching staff user with valid, unused, unexpired PIN
      const staffRows = snapshot.staff_users || [];
      const pinClean = pin.replace(/-/g, '').trim();
      let matched = null;
      for (const row of staffRows) {
        if (!row.join_pin_hash || !row.pin_salt || row.pin_used_at || row.deactivated_at) continue;
        if (row.pin_expires_at && new Date(row.pin_expires_at) < new Date()) continue;
        const hash = require('crypto').createHash('sha256').update(row.pin_salt + pinClean).digest('hex');
        if (hash === row.join_pin_hash) { matched = row; break; }
      }
      if (!matched) { json(res, { ok: false, error: 'Invalid or expired PIN' }, 401); return; }

      // Mark PIN as used in snapshot
      for (const row of staffRows) {
        if (row.id === matched.id) { row.pin_used_at = new Date().toISOString(); break; }
      }
      saveCloudDb(tenantId, snapshot);
      logActivity(tenantId, sub.shop_name, 'staff_joined_new_device', `Staff "${matched.username}" joined on a new device`);
      console.log(`📱 ${sub.shop_name}: staff "${matched.username}" joined on new device via PIN`);
      json(res, { ok: true, tenant_id: tenantId, staff_id: matched.id, username: matched.username, ...snapshot });
    } catch (e) { json(res, { ok: false, error: 'Server error' }, 500); return; }
    return;
  }

  // Legacy stubs — kept for older app versions that still send these (no-op now)
  if (req.method === 'POST' && pathname === '/staff-user-request') {
    json(res, { ok: true }); return;
  }
  const staffUserStatusMatch = pathname.match(/^\/staff-user-status\/([a-f0-9-]{36})$/);
  if (req.method === 'GET' && staffUserStatusMatch) {
    json(res, { ok: true, requests: {} }); return;
  }

  // POST /sync/activate — validate sync code, enable cloud sync for tenant
  if (req.method === 'POST' && pathname === '/sync/activate') {
    if (rateLimit(req, res, 'sync-activate', 5, 60 * 60 * 1000)) return;
    const body = JSON.parse(await readBody(req));
    const { tenant_id, sync_code } = body;
    if (!tenant_id || !sync_code) { json(res, { ok: false, error: 'Missing fields' }, 400); return; }
    const subs = loadSubs();
    const sub = subs[tenant_id];
    if (!sub) { json(res, { ok: false, error: 'Shop not found' }, 404); return; }
    if (!sub.sync_code || sub.sync_code !== sync_code.trim().toUpperCase()) {
      json(res, { ok: false, error: 'Invalid sync code' }, 401); return;
    }
    sub.sync_enabled = true;
    sub.sync_activated_at = new Date().toISOString();
    saveSubs(subs);
    logActivity(tenant_id, sub.shop_name, 'sync_activated', 'Cloud sync activated');
    console.log(`☁️  Cloud sync activated for ${sub.shop_name}`);
    json(res, { ok: true, shop_name: sub.shop_name, dashboard_url: `https://update.frontstores.com/shop/${tenant_id}` });
    return;
  }

  // GET /sync/events/:tenant_id?sync_code=CODE — SSE stream for real-time change notifications
  // [all apps] [all tenants] — desktop app connects here; server pushes "data-changed" when any peer pushes
  const sseMatch = pathname.match(/^\/sync\/events\/([a-f0-9-]{36})$/);
  if (req.method === 'GET' && sseMatch) {
    const tenantId = sseMatch[1];
    const syncCode = url.searchParams.get('sync_code') ?? '';
    const subs = loadSubs();
    const sub = subs[tenantId];
    if (!sub || !sub.sync_enabled || sub.sync_code !== syncCode.trim().toUpperCase()) {
      res.writeHead(401); res.end(); return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write('event: connected\ndata: {}\n\n');
    sseAdd(tenantId, res);
    // Heartbeat every 25s to keep the tunnel alive
    const hb = setInterval(() => { try { res.write(': ping\n\n'); } catch { clearInterval(hb); sseRemove(tenantId, res); } }, 25000);
    req.on('close', () => { clearInterval(hb); sseRemove(tenantId, res); });
    return;
  }

  // GET /announce/events — lightweight SSE for announcements, no auth required, works for ALL tenants
  // [all apps] [all tenants] — every desktop app connects here so announcements reach everyone instantly
  if (req.method === 'GET' && pathname === '/announce/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write('event: connected\ndata: {}\n\n');
    announceSseAdd(res);
    const hb = setInterval(() => { try { res.write(': ping\n\n'); } catch { clearInterval(hb); announceSseRemove(res); } }, 25000);
    req.on('close', () => { clearInterval(hb); announceSseRemove(res); });
    return;
  }

  // GET /announcements — polled by every desktop app (no auth, public)
  // [all apps] [all tenants] — MUST be on public server so Cloudflare Tunnel can reach it
  if (req.method === 'GET' && pathname === '/announcements') {
    const list = loadAnnouncements().map(a => ({ id: a.id, title: a.title, message: a.message, created_at: a.created_at, active: a.active }));
    res.setHeader('Access-Control-Allow-Origin', '*');
    json(res, list); return;
  }

  // POST /announcement-seen — tenant app reports that a user has acknowledged an announcement
  // [all apps] [all tenants]
  if (req.method === 'POST' && pathname === '/announcement-seen') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { announcement_id, tenant_id, shop_name, seen_at } = JSON.parse(body);
        if (!announcement_id || !tenant_id) { res.writeHead(400); res.end('bad request'); return; }
        const list = loadAnnouncements();
        const idx = list.findIndex(a => a.id === announcement_id);
        if (idx !== -1) {
          if (!Array.isArray(list[idx].seen_by)) list[idx].seen_by = [];
          const already = list[idx].seen_by.find(s => s.tenant_id === tenant_id);
          if (!already) list[idx].seen_by.push({ tenant_id, shop_name: shop_name || tenant_id, seen_at: seen_at || new Date().toISOString() });
          saveAnnouncements(list);
        }
        res.setHeader('Access-Control-Allow-Origin', '*');
        json(res, { ok: true });
      } catch { res.writeHead(400); res.end('bad request'); }
    });
    return;
  }

  // POST /sync/push — receive shop data from tenant app
  if (req.method === 'POST' && pathname === '/sync/push') {
    if (rateLimit(req, res, 'sync-push', 60, 60 * 60 * 1000)) return;
    let body;
    try { body = JSON.parse(await readBody(req)); } catch { json(res, { ok: false, error: 'Invalid JSON' }, 400); return; }
    const { tenant_id, sync_code } = body;
    if (!tenant_id || !sync_code) { json(res, { ok: false, error: 'Missing auth' }, 400); return; }
    const subs = loadSubs();
    const sub = subs[tenant_id];
    if (!sub || !sub.sync_enabled || sub.sync_code !== sync_code.trim().toUpperCase()) {
      json(res, { ok: false, error: 'Unauthorized' }, 401); return;
    }
    const existing = loadSync(tenant_id) || {};
    const isDelta = !!body.is_delta; // delta push = only changed records
    const merged = {
      ...existing,
      tenant_id,
      shop_name: sub.shop_name,
      shop_type: sub.shop_type,
      synced_at: new Date().toISOString(),
      ...mergeSyncData(existing, body),
    };
    saveSync(tenant_id, merged);
    sub.last_synced_at = new Date().toISOString();
    saveSubs(subs);
    const counts = {jobs: body.jobs?.length||0, customers: body.customers?.length||0, attendance: body.attendance?.length||0};
    if (!isDelta || Object.values(counts).some(c => c > 0))
      console.log(`☁️  ${isDelta?'Delta':'Full'} sync from ${sub.shop_name} — ${JSON.stringify(counts)}`);
    // [all apps] [all tenants] — notify all other connected devices of this tenant to pull immediately
    sseBroadcast(tenant_id, 'data-changed', { synced_at: merged.synced_at });
    json(res, { ok: true, synced_at: merged.synced_at });
    return;
  }

  // GET /shop/:tenant_id — mobile dashboard (PIN protected)
  const shopMatch = pathname.match(/^\/shop\/([a-f0-9-]{36})$/);
  if (req.method === 'GET' && shopMatch) {
    const tenant_id = shopMatch[1];
    const data = loadSync(tenant_id);
    if (!data) { res.writeHead(404); res.end('Shop not found or not synced yet'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(buildMobileDashboard(data));
    return;
  }

  // GET /shop/:tenant_id/api/* — mobile API (JSON)
  const shopApiMatch = pathname.match(/^\/shop\/([a-f0-9-]{36})\/api\/(.+)$/);
  if (req.method === 'GET' && shopApiMatch) {
    const tenant_id = shopApiMatch[1];
    const endpoint  = shopApiMatch[2];
    const data = loadSync(tenant_id);
    if (!data) { json(res, { error: 'Not found' }, 404); return; }
    const today = new Date().toISOString().slice(0, 10);
    if (endpoint === 'stats') {
      const jobs = (data.jobs || []).filter(j => !j.deleted_at);
      const todayJobs = jobs.filter(j => j.created_at?.startsWith(today));
      json(res, {
        today_jobs: todayJobs.length,
        today_revenue: todayJobs.filter(j => j.status === 'delivered').reduce((s, j) => s + (j.total || 0), 0),
        active_jobs: jobs.filter(j => j.status !== 'delivered' && j.created_at?.startsWith(today)).length,
        synced_at: data.synced_at,
        shop_name: data.shop_name,
      });
      return;
    }
    if (endpoint === 'jobs') {
      const jobs = (data.jobs || []).filter(j => !j.deleted_at).slice(0, 100);
      json(res, { jobs }); return;
    }
    if (endpoint === 'customers') {
      const customers = (data.customers || []).filter(c => !c.deleted_at).slice(0, 200);
      json(res, { customers }); return;
    }
    if (endpoint === 'attendance') {
      const month = url.searchParams.get('month') || today.slice(0, 7);
      const att = (data.attendance || []).filter(a => a.date?.startsWith(month) && !a.deleted_at);
      json(res, { attendance: att, staff: data.staff || [] }); return;
    }
    json(res, { error: 'Unknown endpoint' }, 404); return;
  }

  // [crm] [all tenants] — WhatsApp webhook (Meta verification + incoming messages)
  if (req.method === 'GET' && pathname === '/webhook/whatsapp') {
    const mode      = url.searchParams.get('hub.mode');
    const token     = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    // Accept if verify_token matches any registered tenant_id or the env WA_VERIFY_TOKEN
    const expectedToken = process.env.WA_VERIFY_TOKEN || 'frontstores-wa-verify';
    const creds = loadWaCreds();
    const validTenant = Object.entries(creds).find(([, c]) => c.verify_token === token);
    if (mode === 'subscribe' && (token === expectedToken || validTenant)) {
      res.writeHead(200); res.end(challenge); return;
    }
    res.writeHead(403); res.end('Forbidden'); return;
  }

  if (req.method === 'POST' && pathname === '/webhook/whatsapp') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const entry = payload.entry?.[0];
        const change = entry?.changes?.[0];
        const messages = change?.value?.messages;
        if (!messages || messages.length === 0) { res.writeHead(200); res.end('ok'); return; }

        const msg = messages[0];
        const from = msg.from; // sender phone
        const text = msg.text?.body || '';
        if (!text) { res.writeHead(200); res.end('ok'); return; }

        // Match tenant by the business phone number ID that received the message
        const businessPhoneId = change?.value?.metadata?.phone_number_id || '';
        const creds = loadWaCreds();
        const tenantEntry = Object.entries(creds).find(([, c]) => c.phone_id === businessPhoneId);
        const tenantId = tenantEntry ? tenantEntry[0] : 'default';

        await handleWaBotStep(from, text, tenantId);
      } catch (e) {
        console.error('WA webhook error:', e.message);
      }
      res.writeHead(200); res.end('ok');
    });
    return;
  }

  // [crm] [all tenants] — Register WA credentials from the app
  if (req.method === 'POST' && pathname.startsWith('/api/wa-credentials/')) {
    const tenantId = pathname.split('/')[3];
    if (!tenantId) { res.writeHead(400); res.end('bad request'); return; }
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { phone_id, token, verify_token } = JSON.parse(body);
        if (!phone_id || !token) { json(res, { error: 'phone_id and token required' }, 400); return; }
        const creds = loadWaCreds();
        creds[tenantId] = { phone_id, token, verify_token: verify_token || 'frontstores-wa-verify', updated_at: new Date().toISOString() };
        saveWaCreds(creds);
        json(res, { ok: true }); return;
      } catch (e) { json(res, { error: 'invalid json' }, 400); }
    });
    return;
  }

  // [crm] [all tenants] — Get pending WA leads for the app to sync
  if (req.method === 'GET' && pathname.startsWith('/api/wa-leads/')) {
    const tenantId = pathname.split('/')[3];
    if (!tenantId) { res.writeHead(400); res.end('bad request'); return; }
    const leads = loadWaLeads().filter(l => l.tenant_id === tenantId);
    json(res, { leads }); return;
  }

  // [crm] [all tenants] — Mark a WA lead as imported (called by app after inserting into SQLite)
  if (req.method === 'POST' && pathname.startsWith('/api/wa-leads/') && pathname.endsWith('/mark-imported')) {
    const parts = pathname.split('/');
    const tenantId = parts[3];
    const leadId   = parts[4];
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const leads = loadWaLeads();
      const idx = leads.findIndex(l => l.id === leadId && l.tenant_id === tenantId);
      if (idx >= 0) { leads[idx].imported = true; saveWaLeads(leads); }
      json(res, { ok: true }); return;
    });
    return;
  }

  res.writeHead(404); res.end('Not found');
});

// ── ADMIN SERVER — port 3002 — 127.0.0.1 ONLY, never internet-accessible ───
const ADMIN_HTML = path.join(__dirname, '..', 'admin-app', 'index.html');

const adminServer = http.createServer(async (req, res) => {
  try {
    await handleAdminRequest(req, res);
  } catch (e) {
    console.error('Admin server error:', e);
    if (!res.headersSent) { res.writeHead(500, {'Content-Type':'application/json'}); res.end(JSON.stringify({ ok: false, error: 'Internal server error' })); }
    else res.end();
  }
});

async function handleAdminRequest(req, res) {
  const url      = new URL(req.url, `http://localhost:${ADMIN_PORT}`);
  const pathname = url.pathname;

  // Serve the admin panel HTML
  if (req.method === 'GET' && (pathname === '/' || pathname === '/admin' || pathname === '/index.html')) {
    if (fs.existsSync(ADMIN_HTML)) {
      const html = fs.readFileSync(ADMIN_HTML, 'utf8')
        ;
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
    res.writeHead(401);
    res.end('Unauthorized'); return;
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
      let months = 1;
      try {
        const b = JSON.parse(await readBody(req));
        months = parseInt(b.months) || 1;
        // Admin picks tester vs client right at approval time — defaults to tester if not sent
        if (typeof b.is_client === 'boolean') subs[tenantId].is_client = b.is_client;
      } catch {}
      subs[tenantId].prev_expires_at = subs[tenantId].expires_at || null;
      subs[tenantId].account_status = 'active';
      subs[tenantId].expires_at = addMonths(new Date().toISOString(), months);
      subs[tenantId].approved_at = new Date().toISOString();
      // [all apps] [all tenants] — auto-enable cloud sync on approval so no manual step needed
      if (!subs[tenantId].sync_code) subs[tenantId].sync_code = generateSyncCode();
      subs[tenantId].sync_enabled = true;
      console.log(`✅ Approved: ${subs[tenantId].shop_name} → ${months}-month trial starts now (sync: ${subs[tenantId].sync_code})`);
    }
    saveSubs(subs);
    const actionLabels = { extend: '+30 days', freeze: 'Frozen', unfreeze: 'Unfrozen', revoke: 'Revoked', approve: 'Approved — trial started' };
    logActivity(tenantId, subs[tenantId].shop_name, action, actionLabels[action] || action);
    json(res, { ok: true, expires_at: subs[tenantId].expires_at }); return;
  }

  // POST /admin/api/customers/:id/tag — mark a tenant as a client (real) or leave as tester
  // [core] [all tenants] — every signup defaults to "tester"; admin explicitly promotes to "client"
  // so the main Customers list only ever shows confirmed real customers
  const tagAction = pathname.match(/^\/admin\/api\/customers\/([^/]+)\/tag$/);
  if (req.method === 'POST' && tagAction) {
    if (!checkAuth(req)) { res.writeHead(401); res.end(); return; }
    const tenantId = tagAction[1];
    const body = await readBody(req);
    try {
      const { is_client } = JSON.parse(body);
      const subs = loadSubs();
      if (!subs[tenantId]) { json(res, { ok: false, error: 'Not found' }, 404); return; }
      subs[tenantId].is_client = !!is_client;
      saveSubs(subs);
      logActivity(tenantId, subs[tenantId].shop_name, 'tag', is_client ? 'Marked as Client' : 'Marked as Tester');
      json(res, { ok: true }); return;
    } catch { res.writeHead(400); res.end('Bad request'); return; }
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

  // GET /admin/api/devices — all devices
  if (req.method === 'GET' && pathname === '/admin/api/devices') {
    if (!checkAuth(req)) { res.writeHead(401); res.end(); return; }
    const devices = loadDevices();
    const list = Object.entries(devices).map(([id, d]) => ({ device_id: id, ...d }));
    list.sort((a, b) => new Date(b.registered_at||0) - new Date(a.registered_at||0));
    json(res, list); return;
  }

  // POST /admin/api/devices/:device_id/approve
  const deviceApprove = pathname.match(/^\/admin\/api\/devices\/([^/]+)\/(approve|revoke)$/);
  if (req.method === 'POST' && deviceApprove) {
    if (!checkAuth(req)) { res.writeHead(401); res.end(); return; }
    const [, deviceId, action] = deviceApprove;
    const devices = loadDevices();
    if (!devices[deviceId]) { json(res, { ok: false, error: 'Device not found' }, 404); return; }
    devices[deviceId].status = action === 'approve' ? 'approved' : 'revoked';
    if (action === 'approve') devices[deviceId].approved_at = new Date().toISOString();
    saveDevices(devices);
    const d = devices[deviceId];
    logActivity(d.tenant_id, d.shop_name, `device_${action}d`, `${d.device_name} (${d.platform})`);
    console.log(`📱 Device ${action}d: ${d.device_name} for ${d.shop_name}`);
    json(res, { ok: true }); return;
  }

  // POST /admin/api/customers/:id/set-sync-code
  const syncCodeAction = pathname.match(/^\/admin\/api\/customers\/([^/]+)\/set-sync-code$/);
  if (req.method === 'POST' && syncCodeAction) {
    if (!checkAuth(req)) { res.writeHead(401); res.end(); return; }
    const tenantId = syncCodeAction[1];
    const body = JSON.parse(await readBody(req));
    const subs = loadSubs();
    if (!subs[tenantId]) { json(res, { ok: false, error: 'Not found' }, 404); return; }
    if (body.disable) {
      subs[tenantId].sync_enabled = false;
      subs[tenantId].sync_code = null;
      logActivity(tenantId, subs[tenantId].shop_name, 'sync_disabled', 'Cloud sync disabled by admin');
      console.log(`☁️  Cloud sync disabled for ${subs[tenantId].shop_name}`);
    } else {
      subs[tenantId].sync_code = body.sync_code || null;
      subs[tenantId].sync_enabled = false; // customer must activate via app
      logActivity(tenantId, subs[tenantId].shop_name, 'sync_code_generated', `Sync code issued`);
      console.log(`☁️  Sync code generated for ${subs[tenantId].shop_name}: ${body.sync_code}`);
    }
    saveSubs(subs);
    json(res, { ok: true }); return;
  }

  // GET /admin/api/sync-requests — pending Cloud Sync requests awaiting approval
  if (req.method === 'GET' && pathname === '/admin/api/sync-requests') {
    if (!checkAuth(req)) { res.writeHead(401); res.end(); return; }
    const subs = loadSubs();
    const requests = Object.entries(subs)
      .filter(([, s]) => s.sync_request_status === 'pending')
      .map(([tenant_id, s]) => ({ tenant_id, shop_name: s.shop_name, shop_type: s.shop_type, requested_at: s.sync_requested_at }));
    json(res, requests); return;
  }

  // GET /admin/api/staff-user-requests — all staff users across all tenants (v2: active + deactivated)
  if (req.method === 'GET' && pathname === '/admin/api/staff-user-requests') {
    if (!checkAuth(req)) { res.writeHead(401); res.end(); return; }
    const subs = loadSubs();
    const active = [], deactivated = [];
    for (const [tenant_id, s] of Object.entries(subs)) {
      for (const [staff_id, r] of Object.entries(s.staff_users || {})) {
        const entry = {
          tenant_id, staff_id, shop_name: s.shop_name, shop_type: s.shop_type,
          display_name: r.display_name || r.username, username: r.username, role: r.role || '',
          tab_access: r.tab_access || [], created_at: r.created_at,
          deactivated_at: r.deactivated_at || null,
        };
        if (r.status === 'deactivated') deactivated.push(entry);
        else active.push(entry);
      }
    }
    json(res, { active, deactivated }); return;
  }

  // Legacy stub — no-op now (old app versions may still call this)
  const deleteStaffUserMatch = pathname.match(/^\/admin\/api\/customers\/([^/]+)\/delete-staff-user$/);
  if (req.method === 'POST' && deleteStaffUserMatch) {
    if (!checkAuth(req)) { res.writeHead(401); res.end(); return; }
    json(res, { ok: true }); return;
  }

  // POST /admin/api/customers/:id/approve-sync — approve a pending request, auto-issue code, enable immediately
  const approveSyncMatch = pathname.match(/^\/admin\/api\/customers\/([^/]+)\/approve-sync$/);
  if (req.method === 'POST' && approveSyncMatch) {
    if (!checkAuth(req)) { res.writeHead(401); res.end(); return; }
    const tenantId = approveSyncMatch[1];
    const subs = loadSubs();
    const sub = subs[tenantId];
    if (!sub) { json(res, { ok: false, error: 'Not found' }, 404); return; }
    sub.sync_code = crypto.randomBytes(4).toString('hex').toUpperCase();
    sub.sync_enabled = true;
    sub.sync_request_status = 'approved';
    sub.sync_activated_at = new Date().toISOString();
    saveSubs(subs);
    logActivity(tenantId, sub.shop_name, 'sync_approved', 'Cloud Sync request approved by admin');
    console.log(`☁️  Cloud Sync approved for ${sub.shop_name}`);
    json(res, { ok: true }); return;
  }

  // POST /admin/api/customers/:id/reject-sync — reject a pending Cloud Sync request
  const rejectSyncMatch = pathname.match(/^\/admin\/api\/customers\/([^/]+)\/reject-sync$/);
  if (req.method === 'POST' && rejectSyncMatch) {
    if (!checkAuth(req)) { res.writeHead(401); res.end(); return; }
    const tenantId = rejectSyncMatch[1];
    const subs = loadSubs();
    const sub = subs[tenantId];
    if (!sub) { json(res, { ok: false, error: 'Not found' }, 404); return; }
    sub.sync_request_status = 'rejected';
    saveSubs(subs);
    logActivity(tenantId, sub.shop_name, 'sync_rejected', 'Cloud Sync request rejected by admin');
    json(res, { ok: true }); return;
  }

  // GET /admin/api/cloud-db-requests — [admin] [all tenants] — pending Cloud Database requests
  if (req.method === 'GET' && pathname === '/admin/api/cloud-db-requests') {
    const list = Object.entries(loadSubs())
      .filter(([, s]) => s.cloud_db_request_status === 'pending')
      .map(([tenant_id, s]) => ({ tenant_id, shop_name: s.shop_name, shop_type: s.shop_type, requested_at: s.cloud_db_requested_at }));
    json(res, list); return;
  }

  // POST /admin/api/customers/:id/approve-cloud-db — approve Cloud Database request
  const approveCloudDbMatch = pathname.match(/^\/admin\/api\/customers\/([^/]+)\/approve-cloud-db$/);
  if (req.method === 'POST' && approveCloudDbMatch) {
    const tenantId = approveCloudDbMatch[1];
    const subs = loadSubs();
    const sub = subs[tenantId];
    if (!sub) { json(res, { ok: false, error: 'Not found' }, 404); return; }
    sub.cloud_db_code = crypto.randomBytes(6).toString('hex').toUpperCase();
    sub.cloud_db_enabled = true;
    sub.cloud_db_request_status = 'approved';
    sub.cloud_db_activated_at = new Date().toISOString();
    saveSubs(subs);
    // Notify tenant via SSE if connected
    sseBroadcast(tenantId, 'cloud-db-approved', { code: sub.cloud_db_code });
    logActivity(tenantId, sub.shop_name, 'cloud_db_approved', 'Cloud Database approved by admin');
    console.log(`🗄️  Cloud Database approved for ${sub.shop_name}`);
    json(res, { ok: true }); return;
  }

  // POST /admin/api/customers/:id/reject-cloud-db — reject Cloud Database request
  const rejectCloudDbMatch = pathname.match(/^\/admin\/api\/customers\/([^/]+)\/reject-cloud-db$/);
  if (req.method === 'POST' && rejectCloudDbMatch) {
    const tenantId = rejectCloudDbMatch[1];
    const subs = loadSubs();
    const sub = subs[tenantId];
    if (!sub) { json(res, { ok: false, error: 'Not found' }, 404); return; }
    sub.cloud_db_request_status = 'rejected';
    saveSubs(subs);
    logActivity(tenantId, sub.shop_name, 'cloud_db_rejected', 'Cloud Database request rejected by admin');
    json(res, { ok: true }); return;
  }

  // Legacy stubs — approve/reject no longer used (staff auto-approved from v2)
  const approveStaffUserMatch = pathname.match(/^\/admin\/api\/customers\/([^/]+)\/approve-staff-user$/);
  if (req.method === 'POST' && approveStaffUserMatch) {
    if (!checkAuth(req)) { res.writeHead(401); res.end(); return; }
    json(res, { ok: true }); return;
  }
  const rejectStaffUserMatch = pathname.match(/^\/admin\/api\/customers\/([^/]+)\/reject-staff-user$/);
  if (req.method === 'POST' && rejectStaffUserMatch) {
    if (!checkAuth(req)) { res.writeHead(401); res.end(); return; }
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

  // POST /admin/api/errors/clear-all — wipes the whole error log
  if (req.method === 'POST' && pathname === '/admin/api/errors/clear-all') {
    saveErrors([]);
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

  // POST /admin/api/customers/:id/extend-custom
  const extendCustomAction = pathname.match(/^\/admin\/api\/customers\/([^/]+)\/extend-custom$/);
  if (req.method === 'POST' && extendCustomAction) {
    const tenantId = extendCustomAction[1];
    const body = await readBody(req);
    try {
      const { days, months, expiry_date, from_today } = JSON.parse(body);
      const subs = loadSubs();
      if (!subs[tenantId]) { json(res, { ok: false, error: 'Not found' }, 404); return; }
      let newExpiry;
      const now = new Date().toISOString();
      const base = from_today ? now : (new Date(subs[tenantId].expires_at) > new Date() ? subs[tenantId].expires_at : now);
      if (expiry_date) {
        newExpiry = new Date(expiry_date).toISOString().replace('T',' ').substring(0,19);
        logActivity(tenantId, subs[tenantId].shop_name, 'extend-custom', `Set expiry to ${expiry_date}`);
      } else if (months) {
        newExpiry = addMonths(base, parseInt(months));
        logActivity(tenantId, subs[tenantId].shop_name, 'extend-custom', from_today ? `Set ${months}m from today` : `Extended +${months}m`);
      } else if (days) {
        newExpiry = addDays(base, parseInt(days));
        logActivity(tenantId, subs[tenantId].shop_name, 'extend-custom', `Extended +${days}d`);
      } else { json(res, { ok: false, error: 'Provide months, days, or expiry_date' }, 400); return; }
      subs[tenantId].prev_expires_at = subs[tenantId].expires_at || null;
      subs[tenantId].expires_at = newExpiry;
      subs[tenantId].account_status = 'active';
      subs[tenantId].extended_at = new Date().toISOString();
      saveSubs(subs);
      json(res, { ok: true, expires_at: newExpiry, prev_expires_at: subs[tenantId].prev_expires_at });
    } catch { res.writeHead(400); res.end('Bad request'); }
    return;
  }

  // POST /admin/api/customers/:id/revert
  const revertAction = pathname.match(/^\/admin\/api\/customers\/([^/]+)\/revert$/);
  if (req.method === 'POST' && revertAction) {
    const tenantId = revertAction[1];
    const subs = loadSubs();
    if (!subs[tenantId]) { json(res, { ok: false, error: 'Not found' }, 404); return; }
    const prev = subs[tenantId].prev_expires_at;
    if (!prev) { json(res, { ok: false, error: 'No previous state to revert to' }, 400); return; }
    subs[tenantId].expires_at = prev;
    subs[tenantId].prev_expires_at = null;
    subs[tenantId].extended_at = new Date().toISOString();
    saveSubs(subs);
    logActivity(tenantId, subs[tenantId].shop_name, 'revert', `Reverted expiry to ${prev}`);
    json(res, { ok: true, expires_at: prev }); return;
  }

  // POST /admin/api/customers/:id/set-plan-type
  const planTypeAction = pathname.match(/^\/admin\/api\/customers\/([^/]+)\/set-plan-type$/);
  if (req.method === 'POST' && planTypeAction) {
    const tenantId = planTypeAction[1];
    const body = await readBody(req);
    try {
      const { plan_type } = JSON.parse(body);
      if (!['trial','monthly','yearly'].includes(plan_type)) { res.writeHead(400); res.end('Invalid plan_type'); return; }
      const subs = loadSubs();
      if (!subs[tenantId]) { json(res, { ok: false, error: 'Not found' }, 404); return; }
      subs[tenantId].plan_type = plan_type;
      saveSubs(subs);
      logActivity(tenantId, subs[tenantId].shop_name, 'set-plan-type', plan_type);
      json(res, { ok: true });
    } catch { res.writeHead(400); res.end('Bad request'); }
    return;
  }

  // GET /admin/api/customers/:id/notes
  const notesGetAction = pathname.match(/^\/admin\/api\/customers\/([^/]+)\/notes$/);
  if (req.method === 'GET' && notesGetAction) {
    const tenantId = notesGetAction[1];
    const notes = loadNotes();
    json(res, { notes: notes[tenantId] || '' }); return;
  }

  // POST /admin/api/customers/:id/notes
  const notesPostAction = pathname.match(/^\/admin\/api\/customers\/([^/]+)\/notes$/);
  if (req.method === 'POST' && notesPostAction) {
    const tenantId = notesPostAction[1];
    const body = await readBody(req);
    try {
      const { notes } = JSON.parse(body);
      const allNotes = loadNotes();
      allNotes[tenantId] = String(notes || '').substring(0, 5000);
      saveNotes(allNotes);
      json(res, { ok: true });
    } catch { res.writeHead(400); res.end('Bad request'); }
    return;
  }

  // POST /admin/api/customers/:id/comm-log
  const commLogAction = pathname.match(/^\/admin\/api\/customers\/([^/]+)\/comm-log$/);
  if (req.method === 'POST' && commLogAction) {
    const tenantId = commLogAction[1];
    const body = await readBody(req);
    try {
      const { channel, message } = JSON.parse(body);
      if (!['phone','whatsapp','email','other'].includes(channel)) { res.writeHead(400); res.end('Invalid channel'); return; }
      const subs = loadSubs();
      if (!subs[tenantId]) { json(res, { ok: false, error: 'Not found' }, 404); return; }
      if (!Array.isArray(subs[tenantId].comm_log)) subs[tenantId].comm_log = [];
      subs[tenantId].comm_log.push({ channel, message: sanitize(message, 1000), at: new Date().toISOString() });
      saveSubs(subs);
      logActivity(tenantId, subs[tenantId].shop_name, 'comm-log', `${channel}: ${sanitize(message, 60)}`);
      json(res, { ok: true });
    } catch { res.writeHead(400); res.end('Bad request'); }
    return;
  }

  // POST /admin/api/bulk
  if (req.method === 'POST' && pathname === '/admin/api/bulk') {
    const body = await readBody(req);
    try {
      const { action, days = 30 } = JSON.parse(body);
      const subs = loadSubs();
      const now = new Date();
      let count = 0;
      if (action === 'approve-pending') {
        for (const [id, s] of Object.entries(subs)) {
          if (s.account_status === 'pending') {
            subs[id].account_status = 'active';
            subs[id].expires_at = addDays(now.toISOString(), 30);
            subs[id].approved_at = now.toISOString();
            logActivity(id, s.shop_name, 'bulk-approve', 'Bulk approved');
            count++;
          }
        }
      } else if (action === 'extend-expiring') {
        for (const [id, s] of Object.entries(subs)) {
          if (s.account_status === 'active' && s.expires_at) {
            const d = Math.ceil((new Date(s.expires_at) - now) / 864e5);
            if (d >= 0 && d <= 7) {
              subs[id].expires_at = addDays(s.expires_at, parseInt(days));
              logActivity(id, s.shop_name, 'bulk-extend', `+${days}d (was expiring in ${d}d)`);
              count++;
            }
          }
        }
      } else if (action === 'extend-expired') {
        for (const [id, s] of Object.entries(subs)) {
          if (s.account_status !== 'frozen' && s.account_status !== 'revoked' && s.expires_at && new Date(s.expires_at) < now) {
            subs[id].expires_at = addDays(now.toISOString(), parseInt(days));
            subs[id].account_status = 'active';
            logActivity(id, s.shop_name, 'bulk-extend-expired', `+${days}d`);
            count++;
          }
        }
      } else { res.writeHead(400); res.end('Invalid action'); return; }
      saveSubs(subs);
      json(res, { ok: true, count });
    } catch { res.writeHead(400); res.end('Bad request'); }
    return;
  }

  // GET /admin/api/customers/export.csv
  if (req.method === 'GET' && pathname === '/admin/api/customers/export.csv') {
    const subs = loadSubs();
    const rows = [['shop_name','owner_name','shop_type','phone','email','city','account_status','plan_type','expires_at','registered_at']];
    for (const s of Object.values(subs)) {
      rows.push([
        s.shop_name||'', s.owner_name||'', s.shop_type||'', s.phone||'', s.email||'',
        s.city||'', s.account_status||'', s.plan_type||'', s.expires_at||'', s.registered_at||''
      ].map(v => `"${String(v).replace(/"/g,'""')}"`));
    }
    const csv = rows.map(r=>r.join(',')).join('\r\n');
    res.writeHead(200, { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="customers.csv"' });
    res.end(csv); return;
  }

  // GET /admin/api/analytics
  if (req.method === 'GET' && pathname === '/admin/api/analytics') {
    const subs = loadSubs();
    const now = new Date();
    const list = Object.values(subs);
    let total=0, active=0, trial=0, paid=0, expiring7=0, expiring30=0, churnThisMonth=0;
    let mrr=0, totalPaid=0;
    const byType = {};
    const signupByMonth = {};

    for (const s of list) {
      total++;
      const dLeft = s.expires_at ? Math.ceil((new Date(s.expires_at)-now)/864e5) : 0;
      const isActive = s.account_status==='active' && dLeft>0;
      if (isActive) active++;
      const pt = s.plan_type || (isActive ? 'monthly' : 'trial');
      if (pt==='trial') trial++;
      else if (isActive) { paid++; }
      if (isActive && dLeft<=7) expiring7++;
      if (isActive && dLeft<=30) expiring30++;

      // Revenue estimate
      if (isActive) {
        if (pt==='yearly')  { mrr += 999/12; totalPaid += 999; }
        else                { mrr += 999;    totalPaid += 999; }
      }

      // Churn: expired this calendar month
      if (s.expires_at) {
        const exp = new Date(s.expires_at);
        if (exp < now && exp.getFullYear()===now.getFullYear() && exp.getMonth()===now.getMonth()) churnThisMonth++;
      }

      // By app type
      const st = s.shop_type || 'unknown';
      byType[st] = (byType[st]||0)+1;

      // Signups by month (last 12)
      if (s.registered_at) {
        const d = new Date(s.registered_at);
        const m = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        signupByMonth[m] = (signupByMonth[m]||0)+1;
      }
    }

    // Build last 12 months array
    const months = [];
    for (let i=11; i>=0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
      const m = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      months.push({ month: m, count: signupByMonth[m]||0 });
    }

    json(res, {
      revenue: { mrr: Math.round(mrr), arr: Math.round(mrr*12), total_paid: Math.round(totalPaid) },
      by_app_type: byType,
      signups_by_month: months,
      expiring_7d: expiring7, expiring_30d: expiring30,
      churn_this_month: churnThisMonth,
      total, active, trial, paid,
    }); return;
  }

  // GET /admin/api/health
  if (req.method === 'GET' && pathname === '/admin/api/health') {
    const { execSync } = require('child_process');
    const results = { ollama: { ok: false, models: [] }, cloudflare: { ok: false }, tts: { ok: false }, server_uptime_seconds: Math.floor(process.uptime()) };

    // Ollama
    try {
      const r = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(2000) });
      if (r.ok) {
        const d = await r.json();
        results.ollama = { ok: true, models: (d.models||[]).map(m=>m.name) };
      }
    } catch {}

    // Cloudflare tunnel
    try {
      execSync('pgrep -x cloudflared', { stdio: 'pipe' });
      results.cloudflare = { ok: true };
    } catch {}

    // TTS
    try {
      const r = await fetch('http://127.0.0.1:8880/health', { signal: AbortSignal.timeout(2000) });
      results.tts = { ok: r.ok };
    } catch {}

    json(res, results); return;
  }

  // POST /admin/api/service-control — [admin] [all tenants] — start or stop Cloudflare/Ollama/TTS from Health page
  if (req.method === 'POST' && pathname === '/admin/api/service-control') {
    const { execSync, spawn } = require('child_process');
    const { service, action } = JSON.parse(await readBody(req));
    const SCRIPT_DIR = __dirname;
    const OLLAMA_MODELS = path.join(SCRIPT_DIR, 'ollama', 'models');
    const PYTHON = '/opt/homebrew/bin/python3.11';
    try {
      if (action === 'start') {
        if (service === 'cloudflare') {
          try { execSync('launchctl start com.frontstores.tunnel', { stdio: 'pipe' }); } catch {}
          // also try direct spawn in case launchd service isn't installed
          try { execSync('pgrep -x cloudflared', { stdio: 'pipe' }); } catch {
            spawn('cloudflared', ['tunnel', 'run', 'frontstores'], { detached: true, stdio: 'ignore' }).unref();
          }
        } else if (service === 'ollama') {
          try { execSync('pgrep -x ollama', { stdio: 'pipe' }); } catch {
            spawn('ollama', ['serve'], { detached: true, stdio: 'ignore', env: { ...process.env, OLLAMA_MODELS } }).unref();
          }
        } else if (service === 'tts') {
          try { execSync('pgrep -f kokoro-server', { stdio: 'pipe' }); } catch {
            spawn(PYTHON, [path.join(SCRIPT_DIR, 'kokoro-server.py')], { detached: true, stdio: 'ignore' }).unref();
          }
        } else { json(res, { ok: false, error: 'Unknown service' }, 400); return; }
      } else if (action === 'stop') {
        if (service === 'cloudflare') {
          try { execSync('launchctl stop com.frontstores.tunnel', { stdio: 'pipe' }); } catch {}
          try { execSync('pkill -x cloudflared', { stdio: 'pipe' }); } catch {}
        } else if (service === 'ollama') {
          try { execSync('pkill -x ollama', { stdio: 'pipe' }); } catch {}
        } else if (service === 'tts') {
          try { execSync('pkill -f kokoro-server', { stdio: 'pipe' }); } catch {}
        } else { json(res, { ok: false, error: 'Unknown service' }, 400); return; }
      } else { json(res, { ok: false, error: 'Unknown action' }, 400); return; }
      json(res, { ok: true }); return;
    } catch(e) {
      json(res, { ok: false, error: e.message }, 500); return;
    }
  }

  // GET /admin/api/customers/:id/activity
  const tenantActivityRoute = pathname.match(/^\/admin\/api\/customers\/([^/]+)\/activity$/);
  if (req.method === 'GET' && tenantActivityRoute) {
    const log = loadActivity().filter(e => e.tenant_id === tenantActivityRoute[1]);
    json(res, log); return;
  }

  // GET /admin/api/activity
  if (req.method === 'GET' && pathname === '/admin/api/activity') {
    const url2 = new URL(req.url, `http://localhost:${ADMIN_PORT}`);
    const filterTenant = url2.searchParams.get('tenant_id');
    let log = loadActivity();
    if (filterTenant) log = log.filter(e => e.tenant_id === filterTenant);
    json(res, log.slice(0, 200)); return;
  }

  // GET /admin/api/announcements — includes seen_by for admin display
  if (req.method === 'GET' && pathname === '/admin/api/announcements') {
    if (!checkAuth(req)) { res.writeHead(401); res.end(); return; }
    json(res, loadAnnouncements()); return;
  }

  // POST /admin/api/announcements — create + push to all tenants immediately
  if (req.method === 'POST' && pathname === '/admin/api/announcements') {
    if (!checkAuth(req)) { res.writeHead(401); res.end(); return; }
    const body = await readBody(req);
    try {
      const { title, message } = JSON.parse(body);
      if (!title || !message) { res.writeHead(400); res.end('Missing title or message'); return; }
      const list = loadAnnouncements();
      const entry = { id: crypto.randomUUID(), title: sanitize(title, 200), message: sanitize(message, 2000), created_at: new Date().toISOString(), active: true };
      list.unshift(entry);
      saveAnnouncements(list);
      // [admin] [all tenants] — push to Cloud Sync SSE clients + dedicated announce SSE (covers all tenants)
      for (const [tenantId] of sseClients) {
        sseBroadcast(tenantId, 'announcement-new', { id: entry.id, title: entry.title, created_at: entry.created_at });
      }
      announceBroadcast({ id: entry.id, title: entry.title, created_at: entry.created_at });
      json(res, { ok: true, announcement: entry });
    } catch { res.writeHead(400); res.end('Bad request'); }
    return;
  }

  // POST /admin/api/announcements/:id/deactivate
  const announcementDeact = pathname.match(/^\/admin\/api\/announcements\/([^/]+)\/deactivate$/);
  if (req.method === 'POST' && announcementDeact) {
    if (!checkAuth(req)) { res.writeHead(401); res.end(); return; }
    const list = loadAnnouncements();
    const idx = list.findIndex(a => a.id === announcementDeact[1]);
    if (idx !== -1) list[idx].active = false;
    saveAnnouncements(list);
    json(res, { ok: true }); return;
  }

  // ── Auto-Fix & Deploy ─────────────────────────────────────────────────────

  const AUTOFIX_STATUS_FILE = path.join(DATA_DIR, 'autofix-status.json');
  const PROJECT_DIR = path.join(__dirname, '..');

  function loadAutofixStatus() {
    try { return JSON.parse(fs.readFileSync(AUTOFIX_STATUS_FILE, 'utf8')); }
    catch { return { status: 'idle', log: [], result: null, started_at: null }; }
  }
  function saveAutofixStatus(d) { fs.writeFileSync(AUTOFIX_STATUS_FILE, JSON.stringify(d, null, 2)); }

  function findClaudeBin() {
    const pattern = path.join(process.env.HOME, '.vscode', 'extensions', 'anthropic.claude-code-*', 'resources', 'native-binary', 'claude');
    try {
      const result = execSync(`ls ${pattern} 2>/dev/null | sort -V | tail -1`, { encoding: 'utf8' }).trim();
      if (result && fs.existsSync(result)) return result;
    } catch {}
    return null;
  }

  // GET /admin/api/autofix/status
  if (req.method === 'GET' && pathname === '/admin/api/autofix/status') {
    json(res, loadAutofixStatus()); return;
  }

  // POST /admin/api/autofix/cancel
  if (req.method === 'POST' && pathname === '/admin/api/autofix/cancel') {
    const st = loadAutofixStatus();
    if (st.pid) {
      try { process.kill(st.pid, 'SIGTERM'); } catch {}
    }
    saveAutofixStatus({ status: 'idle', log: [], result: null, started_at: null });
    json(res, { ok: true }); return;
  }

  // POST /admin/api/autofix/start
  if (req.method === 'POST' && pathname === '/admin/api/autofix/start') {
    const st = loadAutofixStatus();
    if (st.status === 'running') { json(res, { ok: false, error: 'Already running' }); return; }

    const claudeBin = findClaudeBin();
    if (!claudeBin) { json(res, { ok: false, error: 'Claude CLI not found. Install Claude Code extension first.' }); return; }

    // Gather all unresolved errors
    const subs = loadSubs();
    const allErrors = loadErrors().filter(e => !e.resolved);
    if (allErrors.length === 0) { json(res, { ok: false, error: 'No unresolved errors to fix.' }); return; }

    // Deduplicate by error message
    const seen = new Set();
    const uniqueErrors = allErrors.filter(e => {
      const key = (e.message || e.error || '').substring(0, 200);
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });

    // Build error summary for Claude
    const errorList = uniqueErrors.slice(0, 30).map((e, i) => {
      const shop = subs[e.tenant_id]?.shop_name || 'Unknown';
      const shopType = subs[e.tenant_id]?.shop_type || '';
      return `Error ${i+1}: [${shopType}] ${shop}
Message: ${e.message || e.error || 'No message'}
${e.stack ? `Stack: ${String(e.stack).substring(0, 500)}` : ''}
${e.context ? `Context: ${JSON.stringify(e.context).substring(0, 300)}` : ''}
---`;
    }).join('\n');

    // latestTag is read only for logging — Claude recomputes dynamically at runtime
    let latestTag = 'v1.0.0';
    try { latestTag = execSync('git -C "' + PROJECT_DIR + '" tag --sort=-v:refname | head -1', { encoding: 'utf8' }).trim() || 'v1.0.0'; } catch {}
    const nextTagHint = (() => { const p = latestTag.replace('v','').split('.').map(Number); return `v${p[0]}.${p[1]}.${(p[2]||0)+1}`; })();

    const prompt = `You are fixing production bugs reported by real customers of the FrontStores app (a Tauri + React desktop app for Indian shop owners).

Working directory: ${PROJECT_DIR}

Here are ${uniqueErrors.length} unique error reports from customer devices (deduplicated from ${allErrors.length} total):

${errorList}

Your tasks — do them IN ORDER, no skipping:
1. Analyze each error and identify the root cause in the codebase using grep/read tools
2. Fix each bug. Tag every code change with // [apptype] [all tenants]
3. Run: cd "${PROJECT_DIR}" && npx tsc --noEmit
4. If TypeScript check passes, commit: git add -A && git commit -m "fix: auto-fix production errors [all apps] [all tenants] - Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
5. IMPORTANT — compute the deploy version at THIS EXACT MOMENT to avoid conflicts:
   Run: LATEST_TAG=$(git -C "${PROJECT_DIR}" tag --sort=-v:refname | head -1)
   Increment the patch by 1 (e.g. v1.0.70→v1.0.71, v1.0.71→v1.0.72, v1.0.72→v1.0.73)
   Then: git tag $NEXT_TAG && git push origin main && git push origin $NEXT_TAG
   Only deploy if there are actual code changes (git diff HEAD~1 is non-empty)
6. Output this EXACT line at the very end (use the ACTUAL tag you pushed):
AUTOFIX_RESULT:{"fixed":["description of fix 1","fix 2"],"version":"REPLACE_WITH_ACTUAL_TAG","count":N}

Rules:
- Fix real bugs only — no refactoring or cleanup beyond what's needed
- If a bug is a data/user issue (not code), note it but skip the fix
- Run tsc check and fix TypeScript errors before committing
- If nothing to fix: output AUTOFIX_RESULT:{"fixed":[],"version":"${latestTag}","count":0,"note":"All errors are user/data issues"}`;

    // Init status
    const status = {
      status: 'running',
      started_at: new Date().toISOString(),
      log: [`🚀 Starting auto-fix for ${uniqueErrors.length} unique errors...`, `📦 Current latest tag: ${latestTag} → next will be ${nextTagHint} (computed dynamically at deploy time)`],
      result: null,
      pid: null,
    };
    saveAutofixStatus(status);

    // Spawn Claude non-interactively
    const claudeProc = spawn(claudeBin, ['-p', prompt], {
      cwd: PROJECT_DIR,
      env: { ...process.env, HOME: process.env.HOME, PATH: process.env.PATH },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    status.pid = claudeProc.pid;
    saveAutofixStatus(status);

    const appendLog = (line) => {
      const st = loadAutofixStatus();
      st.log.push(line);
      if (st.log.length > 200) st.log = st.log.slice(-200);
      saveAutofixStatus(st);
    };

    let fullOutput = '';

    claudeProc.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      fullOutput += text;
      // Extract meaningful lines for display
      const lines = text.split('\n').filter(l => l.trim());
      lines.forEach(line => {
        // Skip JSON noise, keep human-readable lines
        if (!line.startsWith('{') && !line.startsWith('[') && line.length > 2) {
          appendLog(line.substring(0, 200));
        }
        // Capture result JSON
        if (line.startsWith('AUTOFIX_RESULT:')) {
          try {
            const result = JSON.parse(line.replace('AUTOFIX_RESULT:', ''));
            const st = loadAutofixStatus();
            st.result = result;
            saveAutofixStatus(st);
          } catch {}
        }
      });
    });

    claudeProc.stderr.on('data', (chunk) => {
      const text = chunk.toString().trim();
      if (text && !text.startsWith('{') && text.length > 2) appendLog(`⚠ ${text.substring(0, 150)}`);
    });

    claudeProc.on('close', (code) => {
      const st = loadAutofixStatus();

      // Try to extract result from full output if not already captured
      if (!st.result) {
        const match = fullOutput.match(/AUTOFIX_RESULT:({.*})/);
        if (match) {
          try { st.result = JSON.parse(match[1]); } catch {}
        }
      }

      if (!st.result) {
        st.result = {
          fixed: [],
          version: latestTag,
          count: 0,
          note: code === 0 ? 'Completed but no result summary found' : `Process exited with code ${code}`,
        };
      }

      st.status = code === 0 ? 'done' : 'error';
      st.log.push(code === 0 ? `✅ Auto-fix complete! Deployed as ${st.result.version}` : `❌ Process exited with code ${code}`);
      st.pid = null;
      saveAutofixStatus(st);

      // Mark fixed errors as resolved if deploy succeeded
      if (code === 0 && st.result.version !== latestTag) {
        const errors = loadErrors();
        const resolved = errors.filter(e => !e.resolved).map(e => ({ ...e, resolved: true, resolved_by: 'autofix', resolved_at: new Date().toISOString() }));
        saveErrors([...resolved, ...errors.filter(e => e.resolved)]);
        logActivity('system', 'Auto-Fix', 'autofix', `Fixed ${st.result.fixed.length} issues, deployed ${st.result.version}`);
      }
    });

    json(res, { ok: true, started: true, target_version: nextTagHint + ' (computed dynamically at deploy time)' }); return;
  }

  res.writeHead(404); res.end('Not found');
}

// Public server — listen on all interfaces (tunneled via Cloudflare)
publicServer.listen(PUBLIC_PORT, '0.0.0.0', () => {
  console.log(`🌐 Public  server: http://localhost:${PUBLIC_PORT}  (tunneled → update.frontstores.com)`);
});

// Admin server — 127.0.0.1 ONLY — physically impossible to reach from internet
adminServer.listen(ADMIN_PORT, '127.0.0.1', () => {
  console.log(`🔒 Admin   server: http://localhost:${ADMIN_PORT}   (localhost only — never internet-accessible)`);
  console.log(`   Open admin panel: http://localhost:${ADMIN_PORT}`);
});

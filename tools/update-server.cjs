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
const BROADCAST_FILE = path.join(DATA_DIR, 'broadcast.json');
const NOTES_FILE     = path.join(DATA_DIR, 'notes.json');

// Ensure data dir exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ── Data helpers ────────────────────────────────────────────────────────────
function loadSubs()         { try { return JSON.parse(fs.readFileSync(SUBS_FILE,      'utf8')); } catch { return {}; } }
function saveSubs(d)        { fs.writeFileSync(SUBS_FILE,      JSON.stringify(d, null, 2)); }
function loadErrors()       { try { return JSON.parse(fs.readFileSync(ERRORS_FILE,    'utf8')); } catch { return []; } }
function loadContacts()     { try { return JSON.parse(fs.readFileSync(CONTACTS_FILE,  'utf8')); } catch { return []; } }
function saveContacts(d)    { fs.writeFileSync(CONTACTS_FILE,  JSON.stringify(d, null, 2)); }
function saveErrors(d)      { fs.writeFileSync(ERRORS_FILE, JSON.stringify(d, null, 2)); }
function loadActivity()     { try { return JSON.parse(fs.readFileSync(ACTIVITY_FILE,  'utf8')); } catch { return []; } }
function saveActivity(d)    { fs.writeFileSync(ACTIVITY_FILE,  JSON.stringify(d, null, 2)); }
function loadBroadcast()    { try { return JSON.parse(fs.readFileSync(BROADCAST_FILE, 'utf8')); } catch { return []; } }
function saveBroadcast(d)   { fs.writeFileSync(BROADCAST_FILE, JSON.stringify(d, null, 2)); }
function loadNotes()        { try { return JSON.parse(fs.readFileSync(NOTES_FILE,     'utf8')); } catch { return {}; } }
function saveNotes(d)       { fs.writeFileSync(NOTES_FILE,     JSON.stringify(d, null, 2)); }

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
    res.writeHead(401);
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
      let months = 1;
      try { const b = await readBody(req); months = parseInt(JSON.parse(b).months) || 1; } catch {}
      subs[tenantId].prev_expires_at = subs[tenantId].expires_at || null;
      subs[tenantId].account_status = 'active';
      subs[tenantId].expires_at = addMonths(new Date().toISOString(), months);
      subs[tenantId].approved_at = new Date().toISOString();
      console.log(`✅ Approved: ${subs[tenantId].shop_name} → ${months}-month trial starts now`);
    }
    saveSubs(subs);
    const actionLabels = { extend: '+30 days', freeze: 'Frozen', unfreeze: 'Unfrozen', revoke: 'Revoked', approve: 'Approved — trial started' };
    logActivity(tenantId, subs[tenantId].shop_name, action, actionLabels[action] || action);
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
      if (!['whatsapp','email','call','other'].includes(channel)) { res.writeHead(400); res.end('Invalid channel'); return; }
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

  // GET /admin/api/broadcast
  if (req.method === 'GET' && pathname === '/admin/api/broadcast') {
    json(res, loadBroadcast()); return;
  }

  // POST /admin/api/broadcast
  if (req.method === 'POST' && pathname === '/admin/api/broadcast') {
    const body = await readBody(req);
    try {
      const { title, message } = JSON.parse(body);
      if (!title || !message) { res.writeHead(400); res.end('Missing title or message'); return; }
      const broadcasts = loadBroadcast();
      broadcasts.unshift({ id: crypto.randomUUID(), title: sanitize(title, 200), message: sanitize(message, 2000), created_at: new Date().toISOString(), active: true });
      saveBroadcast(broadcasts);
      json(res, { ok: true });
    } catch { res.writeHead(400); res.end('Bad request'); }
    return;
  }

  // POST /admin/api/broadcast/:id/deactivate
  const broadcastDeact = pathname.match(/^\/admin\/api\/broadcast\/([^/]+)\/deactivate$/);
  if (req.method === 'POST' && broadcastDeact) {
    const broadcasts = loadBroadcast();
    const idx = broadcasts.findIndex(b => b.id === broadcastDeact[1]);
    if (idx !== -1) broadcasts[idx].active = false;
    saveBroadcast(broadcasts);
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

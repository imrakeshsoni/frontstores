/**
 * FrontStores Update Server
 * Runs on your Mac, exposed via Cloudflare Tunnel as api.frontstores.com
 * Handles: tenant config, update checks, optional data sync endpoints
 *
 * Start: node tools/update-server.js
 * Auto-start: add to launchd or run via pm2
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 4000;

// Tenant feature flags — edit to control what each installation sees
// tenant_id → feature config
const TENANT_CONFIGS = {};

// Latest version info — update this when you release a new version
const LATEST_VERSION = {
  version: '1.0.0',
  notes: 'Initial release',
  pub_date: new Date().toISOString(),
  platforms: {
    'darwin-aarch64': { url: '', signature: '' },
    'darwin-x86_64':  { url: '', signature: '' },
    'windows-x86_64': { url: '', signature: '' },
    'linux-x86_64':   { url: '', signature: '' },
  }
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS for Tauri
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  // Update check: GET /updates/:target/:arch/:current_version
  if (req.method === 'GET' && url.pathname.startsWith('/updates/')) {
    const parts = url.pathname.split('/').filter(Boolean);
    const [, target, arch, currentVersion] = parts;
    const platform = `${target}-${arch}`;
    const platformInfo = LATEST_VERSION.platforms[platform];

    if (!platformInfo?.url) {
      res.writeHead(204); res.end(); return;
    }

    // Simple semver check — return update only if server version > client version
    if (LATEST_VERSION.version <= currentVersion) {
      res.writeHead(204); res.end(); return;
    }

    res.writeHead(200);
    res.end(JSON.stringify({
      version: LATEST_VERSION.version,
      notes: LATEST_VERSION.notes,
      pub_date: LATEST_VERSION.pub_date,
      url: platformInfo.url,
      signature: platformInfo.signature,
    }));
    return;
  }

  // Tenant config: GET /config/:tenant_id
  if (req.method === 'GET' && url.pathname.startsWith('/config/')) {
    const tenantId = url.pathname.split('/')[2];
    const config = TENANT_CONFIGS[tenantId] ?? { features: {}, channel: 'stable' };
    res.writeHead(200);
    res.end(JSON.stringify(config));
    return;
  }

  // Health check
  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', version: LATEST_VERSION.version }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, () => {
  console.log(`FrontStores update server running on http://localhost:${PORT}`);
  console.log(`Exposed via Cloudflare Tunnel as https://api.frontstores.com`);
});

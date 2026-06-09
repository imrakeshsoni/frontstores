// [all apps] [all tenants] — Auto-sync: push on events, SSE real-time pull, 3-min fallback
import { pushDelta, pullDelta, refreshCloudSyncStatus, pushToCloudDb, refreshCloudDbStatus } from './db/cloudSync';
import { pollAnnouncements } from './db/announcements';
import { getAppConfig } from './db/config';

// Callback registered by AppLayout to refresh announcement UI on SSE push
let _onAnnouncementNew: (() => void) | null = null;
export function setAnnouncementNewHandler(cb: () => void) { _onAnnouncementNew = cb; }

const SERVER = 'https://update.frontstores.com';

let _tenantId = '';
let _pushTimer: ReturnType<typeof setTimeout> | null = null;
let _pullInterval: ReturnType<typeof setInterval> | null = null;
let _lastPushAt = 0;
let _sse: EventSource | null = null;
let _sseReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let _sseReconnectDelay = 5000;
// [all apps] [all tenants] — dedicated announcement SSE, no Cloud Sync required
let _announceSSE: EventSource | null = null;
let _announceReconnectTimer: ReturnType<typeof setTimeout> | null = null;

const PUSH_DEBOUNCE_MS = 5_000;   // 5s after last change — faster for real-time feel
const PULL_INTERVAL_MS = 3 * 60 * 1000; // 3-min fallback poll when SSE is healthy

// Callback registered by SyncPage to refresh Cloud DB status after SSE approval
let _onCloudDbApproved: (() => void) | null = null;
export function setCloudDbApprovedHandler(cb: () => void) { _onCloudDbApproved = cb; }

export function initAutoSync(tenantId: string) {
  _tenantId = tenantId;
  // Refresh both sync and cloud-db status on startup
  Promise.allSettled([
    refreshCloudSyncStatus(tenantId),
    refreshCloudDbStatus(tenantId),
  ]).then(() => {
    connectSSE();
    connectAnnounceSSE(); // [all apps] [all tenants] — works without Cloud Sync
    silentPull();
    silentCloudDbPush(); // push to cloud DB if enabled
  }).catch(() => {
    connectSSE();
    connectAnnounceSSE();
    silentPull();
  });
  // Fallback poll in case SSE drops
  if (_pullInterval) clearInterval(_pullInterval);
  _pullInterval = setInterval(() => silentPull(), PULL_INTERVAL_MS);
}

export function stopAutoSync() {
  if (_pullInterval) { clearInterval(_pullInterval); _pullInterval = null; }
  if (_pushTimer) { clearTimeout(_pushTimer); _pushTimer = null; }
  disconnectSSE();
  if (_announceReconnectTimer) { clearTimeout(_announceReconnectTimer); _announceReconnectTimer = null; }
  if (_announceSSE) { _announceSSE.close(); _announceSSE = null; }
}

// Call this after any significant data change — debounces and pushes to Cloud Sync + Cloud DB
export function triggerAutoSync(immediate = false) {
  if (!_tenantId) return;
  if (_pushTimer) clearTimeout(_pushTimer);
  const delay = immediate ? 500 : PUSH_DEBOUNCE_MS;
  _pushTimer = setTimeout(async () => {
    const config = await getAppConfig();
    const s = config?.settings as any ?? {};
    const now = Date.now();
    if (now - _lastPushAt < 2000) return;
    _lastPushAt = now;
    if (s.cloud_sync_enabled) {
      try { await pushDelta(_tenantId); } catch { /* non-critical */ }
    }
    // [all apps] [all tenants] — also push to Cloud Database if enabled
    if (s.cloud_db_enabled) {
      try { await pushToCloudDb(_tenantId); } catch { /* non-critical */ }
    }
  }, delay);
}

async function silentPull() {
  if (!_tenantId) return;
  const config = await getAppConfig();
  const s = config?.settings as any ?? {};
  if (!s.cloud_sync_enabled) return;
  try { await pullDelta(_tenantId); } catch { /* non-critical */ }
}

async function silentCloudDbPush() {
  if (!_tenantId) return;
  const config = await getAppConfig();
  const s = config?.settings as any ?? {};
  if (!s.cloud_db_enabled || !s.cloud_db_code) return;
  try { await pushToCloudDb(_tenantId); } catch { /* non-critical */ }
}

// [all apps] [all tenants] — connect to announcement SSE regardless of Cloud Sync status
function connectAnnounceSSE() {
  if (!_tenantId) return;
  if (_announceReconnectTimer) { clearTimeout(_announceReconnectTimer); _announceReconnectTimer = null; }
  if (_announceSSE) { _announceSSE.close(); _announceSSE = null; }
  try {
    const es = new EventSource(`${SERVER}/announce/events`);
    _announceSSE = es;
    es.addEventListener('announcement-new', () => {
      pollAnnouncements(_tenantId).then(() => _onAnnouncementNew?.());
    });
    es.onerror = () => {
      es.close();
      _announceSSE = null;
      _announceReconnectTimer = setTimeout(() => connectAnnounceSSE(), 15000);
    };
  } catch { /* EventSource unavailable */ }
}

function disconnectSSE() {
  if (_sseReconnectTimer) { clearTimeout(_sseReconnectTimer); _sseReconnectTimer = null; }
  if (_sse) { _sse.close(); _sse = null; }
}

async function connectSSE() {
  if (!_tenantId) return;
  disconnectSSE();

  const config = await getAppConfig().catch(() => null);
  const s = config?.settings as any ?? {};
  if (!s.cloud_sync_enabled || !s.cloud_sync_code) return; // not activated yet

  const url = `${SERVER}/sync/events/${_tenantId}?sync_code=${encodeURIComponent(s.cloud_sync_code)}`;
  try {
    const es = new EventSource(url);
    _sse = es;

    es.addEventListener('connected', () => {
      _sseReconnectDelay = 5000; // reset backoff on successful connect
    });

    es.addEventListener('data-changed', () => {
      silentPull();
    });

    // [all apps] [all tenants] — instantly fetch new announcements when admin pushes one
    es.addEventListener('announcement-new', () => {
      pollAnnouncements(_tenantId).then(() => _onAnnouncementNew?.());
    });

    // [all apps] [all tenants] — instantly enable Cloud DB when admin approves (no polling delay)
    es.addEventListener('cloud-db-approved', () => {
      refreshCloudDbStatus(_tenantId).then(() => {
        silentCloudDbPush(); // push immediately after approval
        _onCloudDbApproved?.();
      });
    });

    es.onerror = () => {
      es.close();
      _sse = null;
      // Reconnect with exponential backoff, cap at 2 minutes
      _sseReconnectTimer = setTimeout(() => {
        _sseReconnectDelay = Math.min(_sseReconnectDelay * 2, 120_000);
        connectSSE();
      }, _sseReconnectDelay);
    };
  } catch {
    // EventSource not available (e.g. test env) — fallback polling covers it
  }
}

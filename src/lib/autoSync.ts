// [all apps] [all tenants] — Auto-sync: push on events, periodic polling pull (Cloudflare Worker has no SSE/Durable Objects)
import { pushDelta, pullDelta, refreshCloudSyncStatus, pushToCloudDb, refreshCloudDbStatus, activateCloudSync } from './db/cloudSync';
import { pollAnnouncements } from './db/announcements';
import { getAppConfig } from './db/config';

// Callback registered by AppLayout to refresh announcement UI on SSE push
let _onAnnouncementNew: (() => void) | null = null;
export function setAnnouncementNewHandler(cb: () => void) { _onAnnouncementNew = cb; }

// [core] [all tenants] — sync status indicator (sidebar): tracks whether we're
// online, syncing, up to date, or hit an error, so the user knows their data
// is reaching the cloud (and can trust local-only data while offline).
export type SyncStatus = 'disabled' | 'offline' | 'syncing' | 'synced' | 'error';
export interface SyncState { status: SyncStatus; lastSyncedAt: string | null }
let _syncState: SyncState = { status: 'disabled', lastSyncedAt: null };
const _syncStateListeners = new Set<(s: SyncState) => void>();
export function setSyncStateHandler(cb: ((s: SyncState) => void) | null) {
  if (cb) { _syncStateListeners.add(cb); cb(_syncState); }
}
export function removeSyncStateHandler(cb: (s: SyncState) => void) {
  _syncStateListeners.delete(cb);
}
export function getSyncState(): SyncState { return _syncState; }
function setSyncState(partial: Partial<SyncState>) {
  _syncState = { ..._syncState, ...partial };
  _syncStateListeners.forEach(cb => cb(_syncState));
}
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (_syncState.status === 'offline') setSyncState({ status: _tenantId ? 'syncing' : 'disabled' });
  });
  window.addEventListener('offline', () => setSyncState({ status: 'offline' }));
}

const SERVER = 'https://update.frontstores.com';

let _tenantId = '';
let _pushTimer: ReturnType<typeof setTimeout> | null = null;
let _pullInterval: ReturnType<typeof setInterval> | null = null;
let _announceInterval: ReturnType<typeof setInterval> | null = null;
let _lastCloudDbRequestStatus: string | null = null;

const PUSH_DEBOUNCE_MS = 300;       // ~instant push — just enough to batch a single multi-row write (e.g. order + line items) into one request
const PULL_INTERVAL_MS = 30 * 1000; // poll for sync deltas + cloud-db approval
const ANNOUNCE_INTERVAL_MS = 60 * 1000; // poll for new announcements

// Callback registered by SyncPage to refresh Cloud DB status after SSE approval
let _onCloudDbApproved: (() => void) | null = null;
export function setCloudDbApprovedHandler(cb: () => void) { _onCloudDbApproved = cb; }

export function initAutoSync(tenantId: string) {
  _tenantId = tenantId;
  setSyncState({ status: navigator.onLine ? 'syncing' : 'offline' });
  // [all apps] [all tenants] — Cloud-by-default: unless the owner has chosen "Local only",
  // ensure Cloud Sync is active. This flips existing tenants ON the first time they launch
  // an updated build and provisions their sync/cloud-db codes via self-activate. Owners who
  // turned on Local only are never auto-activated. Failures are non-fatal (retried next launch).
  ensureCloudByDefault(tenantId);
  // Refresh both sync and cloud-db status on startup
  Promise.allSettled([
    refreshCloudSyncStatus(tenantId),
    refreshCloudDbStatus(tenantId),
  ]).then(async () => {
    const config = await getAppConfig().catch(() => null);
    if (!(config?.settings as any)?.cloud_sync_enabled) setSyncState({ status: 'disabled' });
    silentPull();
    silentCloudDbPush(); // push to cloud DB if enabled
  }).catch(() => {
    setSyncState({ status: navigator.onLine ? 'error' : 'offline' });
    silentPull();
  });
  // Periodic polling — Cloudflare Worker has no SSE/Durable Objects, so this
  // is the only mechanism for picking up remote changes (sync deltas,
  // cloud-db approval, new announcements).
  if (_pullInterval) clearInterval(_pullInterval);
  _pullInterval = setInterval(() => { silentPull(); pollCloudDbApproval(); }, PULL_INTERVAL_MS);
  if (_announceInterval) clearInterval(_announceInterval);
  pollAnnouncements(_tenantId).then(() => _onAnnouncementNew?.());
  _announceInterval = setInterval(() => {
    pollAnnouncements(_tenantId).then(() => _onAnnouncementNew?.());
  }, ANNOUNCE_INTERVAL_MS);
}

export function stopAutoSync() {
  if (_pullInterval) { clearInterval(_pullInterval); _pullInterval = null; }
  if (_announceInterval) { clearInterval(_announceInterval); _announceInterval = null; }
  if (_pushTimer) { clearTimeout(_pushTimer); _pushTimer = null; }
}

// [all apps] [all tenants] — Cloud-by-default activator. No-op if the owner chose Local only,
// or if Cloud Sync is already active. Otherwise self-activates so data starts backing up.
async function ensureCloudByDefault(tenantId: string) {
  try {
    const config = await getAppConfig().catch(() => null);
    const s = (config?.settings as any) ?? {};
    if (s.local_only) return;            // owner opted out — never auto-enable
    if (s.cloud_sync_enabled) return;    // already on
    await activateCloudSync(tenantId);   // provisions codes + sets cloud_sync_enabled/cloud_db_enabled locally
  } catch { /* non-fatal — retried next launch */ }
}

// Call this after any significant data change — debounces and pushes to Cloud Sync + Cloud DB
export function triggerAutoSync(immediate = false) {
  if (!_tenantId) return;
  if (_pushTimer) clearTimeout(_pushTimer);
  const delay = immediate ? 500 : PUSH_DEBOUNCE_MS;
  _pushTimer = setTimeout(async () => {
    const config = await getAppConfig();
    const s = config?.settings as any ?? {};
    if (s.local_only) return;            // Local-only: data never leaves this machine
    if (s.cloud_sync_enabled) {
      setSyncState({ status: 'syncing' });
      try {
        await pushDelta(_tenantId);
        setSyncState({ status: 'synced', lastSyncedAt: new Date().toISOString() });
      } catch {
        setSyncState({ status: navigator.onLine ? 'error' : 'offline' });
      }
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
  if (s.local_only) return;            // Local-only: never pull from cloud
  if (!s.cloud_sync_enabled) return;
  setSyncState({ status: 'syncing' });
  try {
    await pullDelta(_tenantId);
    setSyncState({ status: 'synced', lastSyncedAt: new Date().toISOString() });
  } catch {
    setSyncState({ status: navigator.onLine ? 'error' : 'offline' });
  }
}

async function silentCloudDbPush() {
  if (!_tenantId) return;
  const config = await getAppConfig();
  const s = config?.settings as any ?? {};
  if (s.local_only) return;            // Local-only: never push full DB snapshot
  if (!s.cloud_db_enabled || !s.cloud_db_code) return;
  try { await pushToCloudDb(_tenantId); } catch { /* non-critical */ }
}

// [all apps] [all tenants] — poll for Cloud DB approval (replaces 'cloud-db-approved' SSE event)
async function pollCloudDbApproval() {
  if (!_tenantId) return;
  const config = await getAppConfig().catch(() => null);
  const s = config?.settings as any ?? {};
  if (s.cloud_db_request_status !== 'pending') { _lastCloudDbRequestStatus = s.cloud_db_request_status ?? null; return; }
  try {
    const status = await refreshCloudDbStatus(_tenantId);
    if (_lastCloudDbRequestStatus === 'pending' && status.requestStatus === 'approved') {
      silentCloudDbPush(); // push immediately after approval
      _onCloudDbApproved?.();
    }
    _lastCloudDbRequestStatus = status.requestStatus ?? null;
  } catch { /* non-critical */ }
}

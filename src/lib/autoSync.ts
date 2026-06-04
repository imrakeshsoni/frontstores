// [all apps] [all tenants] — Auto-sync: push on events, pull every 3 minutes
import { pushDelta, pullDelta } from './db/cloudSync';
import { getAppConfig } from './db/config';

let _tenantId = '';
let _pushTimer: ReturnType<typeof setTimeout> | null = null;
let _pullInterval: ReturnType<typeof setInterval> | null = null;
let _lastPushAt = 0;

const PUSH_DEBOUNCE_MS = 15_000;  // 15s after last change before pushing
const PULL_INTERVAL_MS = 3 * 60 * 1000; // pull every 3 minutes

export function initAutoSync(tenantId: string) {
  _tenantId = tenantId;
  // Start background pull interval
  if (_pullInterval) clearInterval(_pullInterval);
  _pullInterval = setInterval(() => silentPull(), PULL_INTERVAL_MS);
  // Do an immediate pull on startup to catch anything missed while offline
  setTimeout(() => silentPull(), 5000);
}

export function stopAutoSync() {
  if (_pullInterval) { clearInterval(_pullInterval); _pullInterval = null; }
  if (_pushTimer) { clearTimeout(_pushTimer); _pushTimer = null; }
}

// Call this after any significant data change — it debounces and pushes
export function triggerAutoSync(immediate = false) {
  if (!_tenantId) return;
  if (_pushTimer) clearTimeout(_pushTimer);
  const delay = immediate ? 500 : PUSH_DEBOUNCE_MS;
  _pushTimer = setTimeout(async () => {
    const config = await getAppConfig();
    const s = config?.settings as any ?? {};
    if (!s.cloud_sync_enabled) return;
    const now = Date.now();
    if (now - _lastPushAt < 2000) return; // guard against double-fire
    _lastPushAt = now;
    try { await pushDelta(_tenantId); } catch { /* non-critical */ }
  }, delay);
}

async function silentPull() {
  if (!_tenantId) return;
  const config = await getAppConfig();
  const s = config?.settings as any ?? {};
  if (!s.cloud_sync_enabled) return;
  try { await pullDelta(_tenantId); } catch { /* non-critical */ }
}

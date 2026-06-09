// [all apps] [all tenants] — Cloud Sync: push/pull local SQLite data to/from the FrontStores server
import { getDb, now } from './index';
import { getAppConfig, updateAppConfig } from './config';

const SERVER = 'https://update.frontstores.com';

export interface CloudSyncStatus {
  enabled: boolean;
  requestStatus: 'pending' | 'approved' | 'rejected' | null;
  lastSyncedAt: string | null;
  syncCode: string | null;
  dashboardUrl: string | null;
  mobilePinSet: boolean;
}

export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode('frontstores-mobile-' + pin);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function getDeviceId(): string {
  let id = localStorage.getItem('fs_device_id');
  if (!id) {
    id = 'dev-' + Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2,'0')).join('');
    localStorage.setItem('fs_device_id', id);
  }
  return id;
}

// ── Generic table discovery ───────────────────────────────────────────────────
// Per CLAUDE.md DB rules every tenant table has id/tenant_id/updated_at/deleted_at,
// so we can discover what to sync by introspecting the schema — no per-app config.
const SYNC_EXCLUDE_TABLES = new Set([
  'app_config', 'app_auth', 'sync_queue', 'reset_requests', 'unlock_requests',
]);

async function getSyncableTables(db: Awaited<ReturnType<typeof getDb>>): Promise<string[]> {
  const tables = await db.select<{ name: string }[]>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`
  );
  const result: string[] = [];
  for (const { name } of tables) {
    if (SYNC_EXCLUDE_TABLES.has(name)) continue;
    const cols = await db.select<{ name: string }[]>(`PRAGMA table_info(${name})`);
    const colNames = new Set(cols.map(c => c.name));
    if (colNames.has('tenant_id') && colNames.has('updated_at') && colNames.has('id')) result.push(name);
  }
  return result;
}

// ── Status ────────────────────────────────────────────────────────────────────

export async function getCloudSyncStatus(): Promise<CloudSyncStatus> {
  const config = await getAppConfig();
  const s = config?.settings as any ?? {};
  return {
    enabled: !!s.cloud_sync_enabled,
    requestStatus: s.cloud_sync_request_status ?? null,
    lastSyncedAt: s.cloud_sync_last_at ?? null,
    syncCode: s.cloud_sync_code ?? null,
    dashboardUrl: s.cloud_sync_dashboard_url ?? null,
    mobilePinSet: !!s.cloud_sync_pin_set,
  };
}

// Ask the server (Mac) for the latest request/approval status and cache it locally
export async function refreshCloudSyncStatus(tenantId: string): Promise<CloudSyncStatus> {
  const config = await getAppConfig();
  const s = config?.settings as any ?? {};
  try {
    const res = await fetch(`${SERVER}/sync/status/${tenantId}`, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    if (data.ok) {
      await updateAppConfig({
        settings: {
          ...s,
          cloud_sync_enabled: !!data.enabled,
          cloud_sync_request_status: data.request_status ?? null,
          cloud_sync_code: data.sync_code ?? s.cloud_sync_code ?? null,
          cloud_sync_dashboard_url: data.dashboard_url ?? s.cloud_sync_dashboard_url ?? null,
        },
      });
    }
  } catch { /* offline — fall back to cached local status */ }
  return getCloudSyncStatus();
}

// [all apps] [all tenants] — Fetch all pricing fees for this tenant at once (always live, no cache)
export async function getPricing(tenantId: string): Promise<{ plan_fee: number; staff_user_fee: number; cloud_sync_fee: number }> {
  try {
    const res = await fetch(`${SERVER}/pricing/${tenantId}`, { signal: AbortSignal.timeout(6000) });
    const data = await res.json() as { plan_fee?: number; staff_user_fee?: number; cloud_sync_fee?: number };
    return {
      plan_fee:       data.plan_fee       ?? 999,
      staff_user_fee: data.staff_user_fee ?? 200,
      cloud_sync_fee: data.cloud_sync_fee ?? 299,
    };
  } catch {
    return { plan_fee: 999, staff_user_fee: 200, cloud_sync_fee: 299 };
  }
}

// [all apps] [all tenants] — Fetch cloud sync fee from server before showing confirmation
export async function getCloudSyncFee(tenantId: string): Promise<{ fee: number; currency: string }> {
  try {
    const res = await fetch(`${SERVER}/cloud-sync/fee/${tenantId}`, { signal: AbortSignal.timeout(6000) });
    const data = await res.json() as { fee?: number; currency?: string };
    return { fee: data.fee ?? 299, currency: data.currency ?? 'INR' };
  } catch {
    return { fee: 299, currency: 'INR' };
  }
}

// [all apps] [all tenants] — Auto-activate cloud sync (no admin approval needed)
export async function activateCloudSync(tenantId: string): Promise<{ ok: boolean; error?: string }> {
  const config = await getAppConfig();
  const s = config?.settings as any ?? {};
  try {
    const res = await fetch(`${SERVER}/cloud-sync/self-activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId, activated_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json() as { ok: boolean; sync_code?: string; cloud_db_code?: string; error?: string };
    if (!data.ok) return { ok: false, error: data.error ?? 'Activation failed' };
    await updateAppConfig({
      settings: {
        ...s,
        cloud_sync_enabled: true,
        cloud_sync_request_status: 'approved',
        cloud_sync_code: data.sync_code,
        cloud_db_enabled: true,
        cloud_db_code: data.cloud_db_code ?? s.cloud_db_code,
        cloud_sync_dashboard_url: `https://update.frontstores.com/shop/${tenantId}`,
        cloud_sync_activated_at: new Date().toISOString(),
      },
    });
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not reach server. Check your internet connection.' };
  }
}

// [all apps] [all tenants] — Deactivate cloud sync; charge for current cycle still applies
export async function deactivateCloudSync(tenantId: string): Promise<{ ok: boolean; error?: string }> {
  const config = await getAppConfig();
  const s = config?.settings as any ?? {};
  if (!s.cloud_sync_enabled || !s.cloud_sync_code) return { ok: false, error: 'Cloud Sync is not active' };
  try {
    await fetch(`${SERVER}/cloud-sync/self-deactivate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId, sync_code: s.cloud_sync_code, deactivated_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(10000),
    });
  } catch { /* fire-and-forget — local state is source of truth */ }
  await updateAppConfig({
    settings: {
      ...s,
      cloud_sync_enabled: false,
      cloud_sync_request_status: null,
      cloud_sync_code: null,
      cloud_sync_deactivated_at: new Date().toISOString(),
    },
  });
  return { ok: true };
}

// Legacy — kept for backward compat; replaced by activateCloudSync
export async function requestCloudSync(tenantId: string): Promise<{ ok: boolean; error?: string }> {
  return activateCloudSync(tenantId);
}

export async function setMobilePin(tenantId: string, pin: string): Promise<{ ok: boolean; error?: string }> {
  const config = await getAppConfig();
  const s = config?.settings as any ?? {};
  if (!s.cloud_sync_enabled || !s.cloud_sync_code) return { ok: false, error: 'Cloud Sync is not active yet' };
  if (pin.length < 4 || pin.length > 8 || !/^\d+$/.test(pin)) return { ok: false, error: 'PIN must be 4–8 digits' };
  const pin_hash = await hashPin(pin);
  const res = await fetch(`${SERVER}/sync/set-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenant_id: tenantId, sync_code: s.cloud_sync_code, pin_hash }),
  });
  const data = await res.json();
  if (!data.ok) return { ok: false, error: data.error ?? 'Failed to set PIN' };
  await updateAppConfig({ settings: { ...s, cloud_sync_pin_set: true } });
  return { ok: true };
}

// [all apps] [all tenants] — detect the current OS so the admin panel shows the correct device type
function detectPlatform(): string {
  const ua = navigator.userAgent.toLowerCase();
  const p  = navigator.platform.toLowerCase();
  if (ua.includes('android'))                               return 'android';
  if (ua.includes('iphone') || ua.includes('ipad'))        return 'ios';
  if (p.includes('win') || ua.includes('windows'))         return 'windows';
  if (p.includes('mac') || ua.includes('macintosh'))       return 'mac';
  if (p.includes('linux') || ua.includes('linux'))         return 'linux';
  return 'desktop';
}

// Used by mobile: register device + pull data after owner approval
export async function registerDevice(phone: string, pin: string, deviceName: string): Promise<{
  ok: boolean; status?: string; tenant_id?: string; shop_name?: string; shop_type?: string;
  session_token?: string; error?: string;
}> {
  const device_id = getDeviceId();
  const res = await fetch(`${SERVER}/device/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, pin, device_id, device_name: deviceName, platform: detectPlatform(), app_version: '1.0' }),
  });
  const data = await res.json();
  if (!data.ok) return { ok: false, error: data.error ?? 'Registration failed' };
  if (data.session_token) localStorage.setItem('fs_session_token', data.session_token);
  if (data.tenant_id) localStorage.setItem('fs_remote_tenant_id', data.tenant_id);
  return { ok: true, ...data };
}

export async function checkDeviceStatus(): Promise<{ status: string; tenant_id?: string; shop_name?: string; shop_type?: string; session_token?: string }> {
  const device_id = getDeviceId();
  const res = await fetch(`${SERVER}/device/status/${device_id}`);
  return res.json();
}

export async function pullDeviceSyncData(): Promise<{ ok: boolean; data?: any; error?: string }> {
  const device_id = getDeviceId();
  const session_token = localStorage.getItem('fs_session_token');
  if (!session_token) return { ok: false, error: 'No session token' };
  const res = await fetch(`${SERVER}/device/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id, session_token }),
  });
  return res.json();
}

// ── Push / pull — fully generic, works for any app's table set ───────────────

// Delta push — only sends records changed since last sync (fast, small payload)
export async function pushDelta(tenantId: string): Promise<{ ok: boolean; error?: string; synced_at?: string }> {
  const config = await getAppConfig();
  const s = config?.settings as any ?? {};
  if (!s.cloud_sync_enabled || !s.cloud_sync_code) return { ok: false, error: 'Not activated' };

  const db = await getDb();
  const since = s.cloud_sync_last_at ?? '2000-01-01T00:00:00Z';
  const tables = await getSyncableTables(db);

  const payload: Record<string, unknown> = { tenant_id: tenantId, sync_code: s.cloud_sync_code, is_delta: true };
  let totalChanged = 0;
  for (const table of tables) {
    const rows = await db.select<any[]>(
      `SELECT * FROM ${table} WHERE tenant_id = ? AND updated_at > ? ORDER BY updated_at DESC LIMIT 1000`,
      [tenantId, since]
    ).catch(() => []);
    if (rows.length) { payload[table] = rows; totalChanged += rows.length; }
  }
  if (totalChanged === 0) return { ok: true, synced_at: since };

  const res = await fetch(`${SERVER}/sync/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return { ok: false, error: `Server error ${res.status}` };
  const result = await res.json();
  await updateAppConfig({ settings: { ...s, cloud_sync_last_at: result.synced_at ?? now() } });
  return { ok: true, synced_at: result.synced_at };
}

// Full push — sends everything (used for first sync after approval)
export async function pushSyncData(tenantId: string): Promise<{ ok: boolean; error?: string; synced_at?: string; counts?: Record<string, number> }> {
  const config = await getAppConfig();
  const s = config?.settings as any ?? {};
  if (!s.cloud_sync_enabled || !s.cloud_sync_code) return { ok: false, error: 'Cloud Sync is not active yet' };

  const db = await getDb();
  const tables = await getSyncableTables(db);

  const payload: Record<string, unknown> = {
    tenant_id: tenantId,
    sync_code: s.cloud_sync_code,
    shop_name: config?.shop_name,
    shop_type: config?.shop_type,
  };
  const counts: Record<string, number> = {};
  for (const table of tables) {
    const rows = await db.select<any[]>(
      `SELECT * FROM ${table} WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 2000`,
      [tenantId]
    ).catch(() => []);
    payload[table] = rows;
    counts[table] = rows.length;
  }

  const res = await fetch(`${SERVER}/sync/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: err.error ?? `Server error ${res.status}` };
  }
  const result = await res.json();
  await updateAppConfig({ settings: { ...s, cloud_sync_last_at: result.synced_at ?? now() } });
  return { ok: true, synced_at: result.synced_at, counts };
}

// Pull delta from server — apply records changed on other devices since last pull
// ── Cloud Database — full persistent cloud storage ────────────────────────────
// [all apps] [all tenants] — separate feature from Cloud Sync; cloud is the primary DB

export interface CloudDbStatus {
  enabled: boolean;
  requestStatus: 'pending' | 'approved' | 'rejected' | null;
  cloudDbCode: string | null;
  lastSnapshotAt: string | null;
}

export async function getCloudDbStatus(): Promise<CloudDbStatus> {
  const config = await getAppConfig();
  const s = config?.settings as any ?? {};
  return {
    enabled: !!s.cloud_db_enabled,
    requestStatus: s.cloud_db_request_status ?? null,
    cloudDbCode: s.cloud_db_code ?? null,
    lastSnapshotAt: s.cloud_db_last_snapshot_at ?? null,
  };
}

export async function refreshCloudDbStatus(tenantId: string): Promise<CloudDbStatus> {
  const config = await getAppConfig();
  const s = config?.settings as any ?? {};
  try {
    const res = await fetch(`${SERVER}/cloud-db/status/${tenantId}`, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    if (data.ok) {
      await updateAppConfig({
        settings: {
          ...s,
          cloud_db_enabled: !!data.enabled,
          cloud_db_request_status: data.request_status ?? null,
          cloud_db_code: data.cloud_db_code ?? s.cloud_db_code ?? null,
          cloud_db_last_snapshot_at: data.last_snapshot_at ?? s.cloud_db_last_snapshot_at ?? null,
        },
      });
    }
  } catch { /* offline */ }
  return getCloudDbStatus();
}

export async function requestCloudDb(tenantId: string): Promise<{ ok: boolean; error?: string }> {
  const config = await getAppConfig();
  const s = config?.settings as any ?? {};
  try {
    const res = await fetch(`${SERVER}/cloud-db/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    if (!data.ok) return { ok: false, error: data.error ?? 'Request failed' };
    await updateAppConfig({ settings: { ...s, cloud_db_request_status: 'pending' } });
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not reach server. Check your internet connection.' };
  }
}

// Push full local DB snapshot to cloud (all tables, all rows for this tenant)
export async function pushToCloudDb(tenantId: string): Promise<{ ok: boolean; error?: string; snapshot_at?: string }> {
  const config = await getAppConfig();
  const s = config?.settings as any ?? {};
  if (!s.cloud_db_enabled || !s.cloud_db_code) return { ok: false, error: 'Cloud Database not active' };

  const db = await getDb();
  const tables = await getSyncableTables(db);

  const payload: Record<string, unknown> = {
    tenant_id: tenantId,
    cloud_db_code: s.cloud_db_code,
    shop_name: config?.shop_name,
    shop_type: config?.shop_type,
  };
  for (const table of tables) {
    const rows = await db.select<any[]>(
      `SELECT * FROM ${table} WHERE tenant_id = ? ORDER BY updated_at DESC LIMIT 5000`,
      [tenantId]
    ).catch(() => []);
    payload[table] = rows;
  }

  const res = await fetch(`${SERVER}/cloud-db/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return { ok: false, error: `Server error ${res.status}` };
  const result = await res.json();
  await updateAppConfig({ settings: { ...s, cloud_db_last_snapshot_at: result.snapshot_at ?? now() } });
  return { ok: true, snapshot_at: result.snapshot_at };
}

// Pull full DB snapshot from cloud and apply to local DB (used on fresh install / restore)
export async function pullFromCloudDb(tenantId: string): Promise<{ ok: boolean; tables: number; rows: number; error?: string }> {
  const config = await getAppConfig();
  const s = config?.settings as any ?? {};
  if (!s.cloud_db_enabled || !s.cloud_db_code) return { ok: false, tables: 0, rows: 0, error: 'Cloud Database not active' };

  const res = await fetch(`${SERVER}/cloud-db/pull/${tenantId}?code=${encodeURIComponent(s.cloud_db_code)}`, {
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) return { ok: false, tables: 0, rows: 0, error: `Server error ${res.status}` };
  const result = await res.json();
  if (!result.ok || !result.has_data) return { ok: true, tables: 0, rows: 0 };

  const db = await getDb();
  const SKIP = new Set(['tenant_id', 'cloud_db_code', 'shop_name', 'shop_type', 'snapshot_at', 'has_data', 'ok']);
  let totalTables = 0;
  let totalRows = 0;

  for (const [table, rows] of Object.entries(result)) {
    if (SKIP.has(table) || !Array.isArray(rows) || !rows.length) continue;
    totalTables++;
    for (const row of rows as any[]) {
      const cols = Object.keys(row);
      if (!cols.length) continue;
      const placeholders = cols.map(() => '?').join(', ');
      try {
        await db.execute(
          `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`,
          cols.map(c => row[c] ?? null)
        );
        totalRows++;
      } catch { /* table doesn't exist on this device yet — skip */ }
    }
  }
  await updateAppConfig({ settings: { ...s, cloud_db_last_snapshot_at: result.snapshot_at ?? now() } });
  return { ok: true, tables: totalTables, rows: totalRows };
}

export async function pullDelta(tenantId: string): Promise<{ ok: boolean; changes: number; error?: string }> {
  const config = await getAppConfig();
  const s = config?.settings as any ?? {};
  if (!s.cloud_sync_enabled || !s.cloud_sync_code) return { ok: false, changes: 0, error: 'Not activated' };

  const since = s.cloud_sync_last_pull_at ?? s.cloud_sync_last_at ?? '2000-01-01T00:00:00Z';
  const res = await fetch(`${SERVER}/sync/pull/${tenantId}?since=${encodeURIComponent(since)}&sync_code=${s.cloud_sync_code}`);
  if (!res.ok) return { ok: false, changes: 0, error: `Server error ${res.status}` };
  const result = await res.json();
  if (!result.ok) return { ok: false, changes: 0, error: result.error };
  if (!result.has_changes && !result.full) {
    await updateAppConfig({ settings: { ...s, cloud_sync_last_pull_at: result.server_time } });
    return { ok: true, changes: 0 };
  }

  const db = await getDb();
  const delta = result.delta as Record<string, any[]>;
  let changes = 0;

  for (const table of Object.keys(delta)) {
    const rows = delta[table] ?? [];
    for (const row of rows) {
      const cols = Object.keys(row);
      if (!cols.length) continue;
      const placeholders = cols.map(() => '?').join(', ')
      try {
        await db.execute(
          `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`,
          cols.map(c => row[c] ?? null)
        );
        changes++;
      } catch { /* table doesn't exist on this device's schema yet — skip */ }
    }
  }

  await updateAppConfig({ settings: { ...s, cloud_sync_last_pull_at: result.server_time } });
  return { ok: true, changes };
}

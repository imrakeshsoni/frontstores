// [all apps] [all tenants] — Cloud Sync: push local SQLite data to FrontStores server
import { getDb, now } from './index';
import { getAppConfig, updateAppConfig } from './config';

const SERVER = 'https://update.frontstores.com';

export interface CloudSyncStatus {
  enabled: boolean;
  last_synced_at: string | null;
  sync_code: string | null;
  dashboard_url: string | null;
  mobile_pin_set: boolean;
}

async function hashPin(pin: string): Promise<string> {
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

export async function getCloudSyncStatus(): Promise<CloudSyncStatus> {
  const config = await getAppConfig();
  const s = config?.settings as any ?? {};
  return {
    enabled: !!s.cloud_sync_enabled,
    last_synced_at: s.cloud_sync_last_at ?? null,
    sync_code: s.cloud_sync_code ?? null,
    dashboard_url: s.cloud_sync_dashboard_url ?? null,
    mobile_pin_set: !!s.cloud_sync_pin_set,
  };
}

export async function setMobilePin(tenantId: string, pin: string): Promise<{ ok: boolean; error?: string }> {
  const config = await getAppConfig();
  const s = config?.settings as any ?? {};
  if (!s.cloud_sync_enabled || !s.cloud_sync_code) return { ok: false, error: 'Enable Cloud Sync first' };
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

// Used by Android: register device + pull data after approval
export async function registerDevice(phone: string, pin: string, deviceName: string): Promise<{
  ok: boolean; status?: string; tenant_id?: string; shop_name?: string; shop_type?: string;
  session_token?: string; error?: string;
}> {
  const device_id = getDeviceId();
  const res = await fetch(`${SERVER}/device/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, pin, device_id, device_name: deviceName, platform: 'android', app_version: '1.0' }),
  });
  const data = await res.json();
  if (!data.ok) return { ok: false, error: data.error ?? 'Registration failed' };
  // Store session token locally if approved
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
  const result = await res.json();
  return result;
}

export async function activateCloudSync(tenantId: string, syncCode: string): Promise<{ ok: boolean; error?: string; dashboard_url?: string }> {
  const res = await fetch(`${SERVER}/sync/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenant_id: tenantId, sync_code: syncCode.trim().toUpperCase() }),
  });
  const data = await res.json();
  if (!data.ok) return { ok: false, error: data.error ?? 'Invalid code' };

  const config = await getAppConfig();
  await updateAppConfig({
    settings: {
      ...config?.settings ?? {},
      cloud_sync_enabled: true,
      cloud_sync_code: syncCode.trim().toUpperCase(),
      cloud_sync_dashboard_url: data.dashboard_url,
    },
  });
  return { ok: true, dashboard_url: data.dashboard_url };
}

export async function pushSyncData(tenantId: string): Promise<{ ok: boolean; error?: string; synced_at?: string; counts?: Record<string, number> }> {
  const config = await getAppConfig();
  const s = config?.settings as any ?? {};
  if (!s.cloud_sync_enabled || !s.cloud_sync_code) return { ok: false, error: 'Cloud sync not activated' };

  const db = await getDb();
  const shopType = config?.shop_type ?? '';

  // Collect all data
  const [jobs, jobItems, customers, vehicles, staff, attendance, services, memberships, inventory, appointments] = await Promise.all([
    db.select<any[]>(`SELECT * FROM carwash_jobs WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 2000`, [tenantId]).catch(() => []),
    db.select<any[]>(`SELECT * FROM carwash_job_items WHERE tenant_id = ?`, [tenantId]).catch(() => []),
    db.select<any[]>(`SELECT * FROM customers WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 2000`, [tenantId]).catch(() => []),
    db.select<any[]>(`SELECT * FROM carwash_vehicles WHERE tenant_id = ? AND deleted_at IS NULL`, [tenantId]).catch(() => []),
    db.select<any[]>(`SELECT id, tenant_id, name, phone, role, monthly_salary, joining_date, is_active, deduct_half_day, deduct_full_day_leave FROM carwash_staff WHERE tenant_id = ? AND deleted_at IS NULL`, [tenantId]).catch(() => []),
    db.select<any[]>(`SELECT * FROM carwash_attendance WHERE tenant_id = ? AND deleted_at IS NULL`, [tenantId]).catch(() => []),
    db.select<any[]>(`SELECT * FROM carwash_services WHERE tenant_id = ? AND deleted_at IS NULL`, [tenantId]).catch(() => []),
    db.select<any[]>(`SELECT * FROM carwash_memberships WHERE tenant_id = ? AND deleted_at IS NULL`, [tenantId]).catch(() => []),
    db.select<any[]>(`SELECT * FROM carwash_inventory WHERE tenant_id = ? AND deleted_at IS NULL`, [tenantId]).catch(() => []),
    db.select<any[]>(`SELECT * FROM carwash_appointments WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY appointment_date DESC LIMIT 500`, [tenantId]).catch(() => []),
  ]);

  const payload = {
    tenant_id: tenantId,
    sync_code: s.cloud_sync_code,
    shop_name: config?.shop_name,
    shop_type: shopType,
    jobs, job_items: jobItems, customers, vehicles, staff, attendance,
    services, memberships, inventory, appointments,
  };

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

  // Save last synced time
  await updateAppConfig({
    settings: {
      ...s,
      cloud_sync_last_at: result.synced_at ?? now(),
    },
  });

  return {
    ok: true,
    synced_at: result.synced_at,
    counts: {
      jobs: jobs.length, customers: customers.length, staff: staff.length,
      attendance: attendance.length, memberships: memberships.length,
    },
  };
}

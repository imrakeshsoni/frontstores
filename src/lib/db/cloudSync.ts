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

// Delta push — only sends records changed since last sync (fast, small payload)
export async function pushDelta(tenantId: string): Promise<{ ok: boolean; error?: string; synced_at?: string }> {
  const config = await getAppConfig();
  const s = config?.settings as any ?? {};
  if (!s.cloud_sync_enabled || !s.cloud_sync_code) return { ok: false, error: 'Not activated' };

  const db = await getDb();
  const since = s.cloud_sync_last_at ?? '2000-01-01T00:00:00Z';

  // Only fetch records changed after last sync
  const [jobs, jobItems, customers, vehicles, staff, attendance, services, memberships, inventory, appointments] = await Promise.all([
    db.select<any[]>(`SELECT * FROM carwash_jobs WHERE tenant_id = ? AND updated_at > ? ORDER BY updated_at DESC LIMIT 500`, [tenantId, since]).catch(() => []),
    db.select<any[]>(`SELECT * FROM carwash_job_items WHERE tenant_id = ? AND job_id IN (SELECT id FROM carwash_jobs WHERE tenant_id = ? AND updated_at > ?)`, [tenantId, tenantId, since]).catch(() => []),
    db.select<any[]>(`SELECT * FROM customers WHERE tenant_id = ? AND updated_at > ? LIMIT 500`, [tenantId, since]).catch(() => []),
    db.select<any[]>(`SELECT * FROM carwash_vehicles WHERE tenant_id = ? AND updated_at > ? LIMIT 200`, [tenantId, since]).catch(() => []),
    db.select<any[]>(`SELECT id,tenant_id,name,phone,role,monthly_salary,joining_date,is_active,deduct_half_day,deduct_full_day_leave FROM carwash_staff WHERE tenant_id = ? AND updated_at > ?`, [tenantId, since]).catch(() => []),
    db.select<any[]>(`SELECT * FROM carwash_attendance WHERE tenant_id = ? AND updated_at > ? LIMIT 500`, [tenantId, since]).catch(() => []),
    db.select<any[]>(`SELECT * FROM carwash_services WHERE tenant_id = ? AND updated_at > ?`, [tenantId, since]).catch(() => []),
    db.select<any[]>(`SELECT * FROM carwash_memberships WHERE tenant_id = ? AND updated_at > ?`, [tenantId, since]).catch(() => []),
    db.select<any[]>(`SELECT * FROM carwash_inventory WHERE tenant_id = ? AND updated_at > ?`, [tenantId, since]).catch(() => []),
    db.select<any[]>(`SELECT * FROM carwash_appointments WHERE tenant_id = ? AND updated_at > ? LIMIT 200`, [tenantId, since]).catch(() => []),
  ]);

  const totalChanged = jobs.length + customers.length + attendance.length + staff.length + services.length + memberships.length + inventory.length + appointments.length;
  if (totalChanged === 0 && jobItems.length === 0) return { ok: true, synced_at: since }; // nothing to push

  const payload = {
    tenant_id: tenantId, sync_code: s.cloud_sync_code, is_delta: true,
    jobs, job_items: jobItems, customers, vehicles, staff, attendance,
    services, memberships, inventory, appointments,
  };

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

// Pull delta from server — get records changed on other devices since last pull
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

  // Apply pulled records to local SQLite
  const db = await getDb();
  const delta = result.delta;
  let changes = 0;

  const tableMap: Array<[string, string[]]> = [
    ['carwash_jobs', ['id','tenant_id','job_number','vehicle_id','reg_number','vehicle_type','make','model','color','customer_name','customer_phone','customer_id','staff_id','staff_name','status','payment_method','payment_status','subtotal','discount','gst_amount','total','membership_id','notes','started_at','completed_at','delivered_at','created_at','updated_at','deleted_at']],
    ['carwash_job_items', ['id','tenant_id','job_id','service_id','service_name','price','gst_rate','created_at']],
    ['customers', ['id','tenant_id','name','phone','email','address','city','tags','credit_limit','notes','created_at','updated_at','deleted_at']],
    ['carwash_vehicles', ['id','tenant_id','customer_id','customer_name','customer_phone','reg_number','vehicle_type','make','model','color','notes','created_at','updated_at','deleted_at']],
    ['carwash_staff', ['id','tenant_id','name','phone','role','monthly_salary','joining_date','is_active','deduct_half_day','deduct_full_day_leave','created_at','updated_at','deleted_at']],
    ['carwash_attendance', ['id','tenant_id','staff_id','date','status','note','updated_at','deleted_at']],
    ['carwash_services', ['id','tenant_id','name','description','price_hatchback','price_sedan','price_suv','price_luxury','duration_minutes','gst_rate','is_active','sort_order','created_at','updated_at','deleted_at']],
    ['carwash_memberships', ['id','tenant_id','customer_name','customer_phone','customer_id','vehicle_id','reg_number','package_name','total_washes','used_washes','amount_paid','valid_until','is_active','created_at','updated_at','deleted_at']],
    ['carwash_inventory', ['id','tenant_id','name','category','unit','quantity','min_quantity','cost_per_unit','notes','created_at','updated_at','deleted_at']],
    ['carwash_appointments', ['id','tenant_id','appointment_date','appointment_time','duration_minutes','reg_number','vehicle_type','make','model','customer_name','customer_phone','staff_id','staff_name','services_note','status','notes','job_id','created_at','updated_at','deleted_at']],
  ];

  const tableKey: Record<string, string> = { carwash_jobs: 'jobs', carwash_job_items: 'job_items', customers: 'customers', carwash_vehicles: 'vehicles', carwash_staff: 'staff', carwash_attendance: 'attendance', carwash_services: 'services', carwash_memberships: 'memberships', carwash_inventory: 'inventory', carwash_appointments: 'appointments' };

  for (const [table, cols] of tableMap) {
    const rows: any[] = delta[tableKey[table]] ?? [];
    for (const row of rows) {
      const vals = cols.map(c => row[c] ?? null);
      try {
        await db.execute(`INSERT OR REPLACE INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, vals);
        changes++;
      } catch { /* incompatible schema — skip */ }
    }
  }

  await updateAppConfig({ settings: { ...s, cloud_sync_last_pull_at: result.server_time } });
  return { ok: true, changes };
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

// [all apps] [all tenants] — Cloud Sync: push local SQLite data to FrontStores server
import { getDb, now } from './index';
import { getAppConfig, updateAppConfig } from './config';

const SERVER = 'https://update.frontstores.com';

export interface CloudSyncStatus {
  enabled: boolean;
  last_synced_at: string | null;
  sync_code: string | null;
  dashboard_url: string | null;
}

export async function getCloudSyncStatus(): Promise<CloudSyncStatus> {
  const config = await getAppConfig();
  const s = config?.settings as any ?? {};
  return {
    enabled: !!s.cloud_sync_enabled,
    last_synced_at: s.cloud_sync_last_at ?? null,
    sync_code: s.cloud_sync_code ?? null,
    dashboard_url: s.cloud_sync_dashboard_url ?? null,
  };
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

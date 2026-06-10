// [core] [all tenants] — multi-app support
import { getDb, uuid, now } from './index';

const SERVER = 'https://update.frontstores.com';

export interface LinkedAccount {
  id: string;
  tenant_id: string;
  shop_type: string;
  shop_name: string;
  owner_name: string;
  status: 'pending' | 'active' | 'rejected';
  expires_at: string | null;
  registered_at: string | null;
  last_synced_at: string | null;
}

export async function getLinkedAccounts(): Promise<LinkedAccount[]> {
  const db = await getDb();
  return db.select<LinkedAccount[]>(
    `SELECT * FROM linked_accounts ORDER BY shop_type`
  );
}

export async function getLinkedAccount(shopType: string): Promise<LinkedAccount | null> {
  const db = await getDb();
  const rows = await db.select<LinkedAccount[]>(
    `SELECT * FROM linked_accounts WHERE shop_type = ?`, [shopType]
  );
  return rows[0] ?? null;
}

export async function upsertLinkedAccount(data: {
  tenant_id: string;
  shop_type: string;
  shop_name: string;
  owner_name: string;
  status: LinkedAccount['status'];
  expires_at?: string | null;
  registered_at?: string | null;
}): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO linked_accounts (id, tenant_id, shop_type, shop_name, owner_name, status, expires_at, registered_at, last_synced_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(shop_type) DO UPDATE SET
       tenant_id=excluded.tenant_id, shop_name=excluded.shop_name, owner_name=excluded.owner_name,
       status=excluded.status, expires_at=excluded.expires_at, registered_at=excluded.registered_at,
       last_synced_at=excluded.last_synced_at, updated_at=excluded.updated_at`,
    [uuid(), data.tenant_id, data.shop_type, data.shop_name, data.owner_name,
     data.status, data.expires_at ?? null, data.registered_at ?? null, now(), now(), now()]
  );
}

export async function updateLinkedAccountStatus(
  shopType: string,
  status: LinkedAccount['status'],
  expires_at?: string | null
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE linked_accounts SET status=?, expires_at=COALESCE(?,expires_at), last_synced_at=?, updated_at=? WHERE shop_type=?`,
    [status, expires_at ?? null, now(), now(), shopType]
  );
}

// Hydrate local SQLite from a join snapshot returned by /join/verify-pin
// Used when a staff member joins their manager's app on a new device via Cloud Sync
export async function hydrateFromJoinSnapshot(snapshot: any): Promise<void> {
  const db = await getDb();
  const { tenant_id, shop_name, shop_type } = snapshot;

  // Create app_config if not already present
  const existing = await db.select<{ id: string }[]>(
    `SELECT id FROM app_config WHERE tenant_id=? LIMIT 1`, [tenant_id]
  );
  if (existing.length === 0) {
    const cfgRow = (snapshot.app_config || []).find((r: any) => r.tenant_id === tenant_id);
    if (cfgRow) {
      const cols = Object.keys(cfgRow);
      await db.execute(
        `INSERT OR REPLACE INTO app_config (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
        cols.map((c: string) => cfgRow[c] ?? null)
      ).catch(() => {});
    } else {
      await db.execute(
        `INSERT OR IGNORE INTO app_config (id, tenant_id, shop_type, shop_name, is_setup_complete, updated_at)
         VALUES (?,?,?,?,1,?)`,
        [uuid(), tenant_id, shop_type ?? 'crm', shop_name ?? 'Shared App', now()]
      );
    }
    // Ensure bill_sequences row exists
    await db.execute(
      `INSERT OR IGNORE INTO bill_sequences (id, tenant_id, sequence_type, prefix, current_number)
       VALUES (?,?,'invoice','INV',0)`,
      [uuid(), tenant_id]
    ).catch(() => {});
  }

  // Activate this tenant
  await db.execute(`UPDATE app_config SET is_active=0`);
  await db.execute(`UPDATE app_config SET is_active=1 WHERE tenant_id=?`, [tenant_id]);

  // Import all table data from snapshot (same pattern as pullFromCloudDb)
  const SKIP = new Set(['tenant_id', 'cloud_db_code', 'shop_name', 'shop_type', 'snapshot_at', 'has_data', 'ok', 'staff_id', 'username']);
  for (const [table, rows] of Object.entries(snapshot)) {
    if (SKIP.has(table) || !Array.isArray(rows) || !rows.length) continue;
    for (const row of rows as any[]) {
      const cols = Object.keys(row);
      if (!cols.length) continue;
      try {
        await db.execute(
          `INSERT OR REPLACE INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
          cols.map((c: string) => row[c] ?? null)
        );
      } catch { /* table doesn't exist on this device yet — skip */ }
    }
  }

  // Register as linked account
  await upsertLinkedAccount({
    tenant_id,
    shop_type: shop_type ?? 'unknown',
    shop_name: shop_name ?? 'Shared App',
    owner_name: (snapshot.app_config || [])[0]?.owner_name ?? '',
    status: 'active',
  });

  // [core] [all tenants] — carry over real-time Cloud Sync credentials so this device
  // pushes/pulls live changes (SSE + delta sync), not just the one-time join snapshot.
  if (snapshot.sync_enabled && snapshot.sync_code) {
    const { updateAppConfig } = await import('./config');
    const { getAppConfig } = await import('./config');
    const config = await getAppConfig();
    const s = config?.settings as any ?? {};
    await updateAppConfig({
      settings: {
        ...s,
        cloud_sync_enabled: true,
        cloud_sync_code: snapshot.sync_code,
        cloud_sync_last_at: now(),
        cloud_sync_last_pull_at: now(),
        cloud_db_enabled: !!snapshot.cloud_db_code,
        cloud_db_code: snapshot.cloud_db_code ?? s.cloud_db_code ?? null,
      },
    });
    const { initAutoSync } = await import('../autoSync');
    initAutoSync(tenant_id);
  }
}

// [core] [all tenants] — single shared entry point for "join existing shop via shop code + PIN",
// used from both the Setup Wizard and Switch App modal so the two flows can't drift apart.
export type JoinShopResult =
  | { ok: true; tenantId: string; staffId: string; username: string; shopName: string }
  | { ok: false; error: string };

export async function joinShopWithPin(shopCode: string, pin: string): Promise<JoinShopResult> {
  try {
    const res = await fetch(`${SERVER}/join/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shop_code: shopCode, pin }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    if (!data.ok) return { ok: false, error: data.error || 'Invalid shop code or PIN' };
    await hydrateFromJoinSnapshot(data);
    return { ok: true, tenantId: data.tenant_id, staffId: data.staff_id, username: data.username ?? '', shopName: data.shop_name ?? 'Shop' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg.toLowerCase().includes('time') ? 'Could not reach the server — check your internet and try again' : 'Something went wrong. Please try again.' };
  }
}

// Switch the active app — updates app_config is_active flags
export async function switchActiveApp(tenantId: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE app_config SET is_active=0`);
  await db.execute(`UPDATE app_config SET is_active=1 WHERE tenant_id=?`, [tenantId]);
}

// Create a new app_config row for a new app registration
export async function createLinkedAppConfig(data: {
  tenant_id: string;
  shop_type: string;
  shop_name: string;
  owner_name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
}): Promise<void> {
  const db = await getDb();
  // Deactivate current
  await db.execute(`UPDATE app_config SET is_active=0`);
  const trialStart = now();
  await db.execute(
    `INSERT OR REPLACE INTO app_config
     (id, tenant_id, shop_type, shop_name, owner_name, phone, email, city,
      is_setup_complete, is_active, trial_started_at, subscription_status, tc_agreed_at)
     VALUES (?,?,?,?,?,?,?,?,1,1,?,'pending',?)`,
    [uuid(), data.tenant_id, data.shop_type, data.shop_name, data.owner_name,
     data.phone, data.email, data.city, trialStart, trialStart]
  );
  await db.execute(
    `INSERT OR IGNORE INTO bill_sequences (id, tenant_id, sequence_type, prefix, current_number)
     VALUES (?,?,'invoice','INV',0)`,
    [uuid(), data.tenant_id]
  );
}

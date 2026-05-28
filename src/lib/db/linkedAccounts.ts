// [core] [all tenants] — multi-app support
import { getDb, uuid, now } from './index';

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

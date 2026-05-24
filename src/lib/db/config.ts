import { getDb, uuid, now } from './index';

export interface AppConfig {
  tenant_id: string;
  shop_type: string;
  shop_name: string;
  owner_name: string;
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gstin: string | null;
  drug_license_no: string | null;
  settings: Record<string, unknown>;
  is_setup_complete: boolean;
  app_version: string;
  trial_started_at: string | null;
  subscription_expires_at: string | null;
  subscription_status: 'trial' | 'active' | 'expired' | 'grace';
  tc_agreed_at: string | null;
  last_server_time: string | null;
}

export async function getAppConfig(): Promise<AppConfig | null> {
  const db = await getDb();
  const rows = await db.select<any[]>('SELECT * FROM app_config LIMIT 1');
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    ...r,
    settings: JSON.parse(r.settings || '{}'),
    is_setup_complete: r.is_setup_complete === 1,
  };
}

export async function createAppConfig(data: {
  shop_type: string;
  shop_name: string;
  owner_name: string;
  phone?: string;
  email?: string;
  address_line1?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
  drug_license_no?: string;
}): Promise<AppConfig> {
  const db = await getDb();
  const tenant_id = uuid();
  const trialStart = now();
  const trialExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString().replace('T', ' ').substring(0, 19);
  await db.execute(
    `INSERT INTO app_config (id, tenant_id, shop_type, shop_name, owner_name, phone, email,
      address_line1, city, state, pincode, gstin, drug_license_no, is_setup_complete,
      trial_started_at, subscription_expires_at, subscription_status, tc_agreed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 'trial', ?)`,
    [uuid(), tenant_id, data.shop_type, data.shop_name, data.owner_name,
     data.phone ?? null, data.email ?? null, data.address_line1 ?? null,
     data.city ?? null, data.state ?? null, data.pincode ?? null,
     data.gstin ?? null, data.drug_license_no ?? null,
     trialStart, trialExpiry, trialStart]
  );
  await db.execute(
    `INSERT INTO bill_sequences (id, tenant_id, sequence_type, prefix, current_number)
     VALUES (?, ?, 'invoice', 'INV', 0)`,
    [uuid(), tenant_id]
  );
  return (await getAppConfig())!;
}

export async function updateAppConfig(data: Partial<Omit<AppConfig, 'tenant_id'>>): Promise<void> {
  const db = await getDb();
  const config = await getAppConfig();
  if (!config) return;
  const fields = Object.entries(data)
    .filter(([k]) => k !== 'tenant_id' && k !== 'settings')
    .map(([k]) => `${k} = ?`).join(', ');
  const values = Object.entries(data)
    .filter(([k]) => k !== 'tenant_id' && k !== 'settings')
    .map(([, v]) => v);
  if (data.settings !== undefined) {
    await db.execute(
      `UPDATE app_config SET settings = ?, updated_at = ? WHERE tenant_id = ?`,
      [JSON.stringify(data.settings), now(), config.tenant_id]
    );
  }
  if (fields) {
    await db.execute(
      `UPDATE app_config SET ${fields}, updated_at = ? WHERE tenant_id = ?`,
      [...values, now(), config.tenant_id]
    );
  }
}

export async function getNextBillNumber(tenantId: string): Promise<string> {
  const db = await getDb();
  await db.execute(
    `UPDATE bill_sequences SET current_number = current_number + 1, updated_at = ?
     WHERE tenant_id = ? AND sequence_type = 'invoice'`,
    [now(), tenantId]
  );
  const rows = await db.select<{ prefix: string; current_number: number }[]>(
    `SELECT prefix, current_number FROM bill_sequences WHERE tenant_id = ? AND sequence_type = 'invoice'`,
    [tenantId]
  );
  const seq = rows[0];
  return `${seq.prefix}${String(seq.current_number).padStart(6, '0')}`;
}

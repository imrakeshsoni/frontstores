import { getDb, uuid, now } from './index';

export interface KhataEntry {
  id: string;
  tenant_id: string;
  customer_id: string;
  customer_name?: string;
  order_id: string | null;
  type: 'debit' | 'credit';
  amount: number;
  notes: string | null;
  entry_date: string;
}

export interface KhataCustomerSummary {
  customer_id: string;
  customer_name: string;
  customer_phone: string | null;
  total_debit: number;
  total_credit: number;
  balance: number; // positive = customer owes you
  last_entry: string | null;
}

export async function listKhataCustomers(tenantId: string): Promise<KhataCustomerSummary[]> {
  const db = await getDb();
  return db.select<KhataCustomerSummary[]>(
    `SELECT
       c.id AS customer_id,
       c.name AS customer_name,
       c.phone AS customer_phone,
       COALESCE(SUM(CASE WHEN k.type='debit'  THEN k.amount ELSE 0 END), 0) AS total_debit,
       COALESCE(SUM(CASE WHEN k.type='credit' THEN k.amount ELSE 0 END), 0) AS total_credit,
       COALESCE(SUM(CASE WHEN k.type='debit'  THEN k.amount ELSE 0 END), 0)
         - COALESCE(SUM(CASE WHEN k.type='credit' THEN k.amount ELSE 0 END), 0) AS balance,
       MAX(k.entry_date) AS last_entry
     FROM customers c
     INNER JOIN khata_entries k ON k.customer_id = c.id AND k.deleted_at IS NULL
     WHERE c.tenant_id = ? AND c.deleted_at IS NULL
     GROUP BY c.id
     ORDER BY balance DESC`,
    [tenantId]
  );
}

export async function listKhataEntries(tenantId: string, customerId: string): Promise<KhataEntry[]> {
  const db = await getDb();
  return db.select<KhataEntry[]>(
    `SELECT k.*, c.name AS customer_name
     FROM khata_entries k
     JOIN customers c ON c.id = k.customer_id
     WHERE k.tenant_id = ? AND k.customer_id = ? AND k.deleted_at IS NULL
     ORDER BY k.entry_date DESC`,
    [tenantId, customerId]
  );
}

export async function addKhataEntry(tenantId: string, data: {
  customer_id: string;
  type: 'debit' | 'credit';
  amount: number;
  notes?: string;
  order_id?: string;
}) {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO khata_entries (id, tenant_id, customer_id, order_id, type, amount, notes, entry_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, tenantId, data.customer_id, data.order_id || null, data.type, data.amount, data.notes || null, now(), now(), now()]
  );
  return id;
}

export async function deleteKhataEntry(tenantId: string, id: string) {
  const db = await getDb();
  await db.execute(
    `UPDATE khata_entries SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`,
    [now(), now(), id, tenantId]
  );
}

export async function getCustomerBalance(tenantId: string, customerId: string): Promise<number> {
  const db = await getDb();
  const rows = await db.select<{ balance: number }[]>(
    `SELECT COALESCE(SUM(CASE WHEN type='debit' THEN amount ELSE -amount END), 0) AS balance
     FROM khata_entries WHERE tenant_id = ? AND customer_id = ? AND deleted_at IS NULL`,
    [tenantId, customerId]
  );
  return rows[0]?.balance ?? 0;
}

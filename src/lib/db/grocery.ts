// [grocery] [all tenants]
import { getDb, uuid, now } from './index';

export interface CashDrawerEntry {
  id: string;
  tenant_id: string;
  date: string;
  opening_balance: number;
  closing_balance: number | null;
  notes: string | null;
  created_at: string;
}

export async function getCashDrawerEntry(tenantId: string, date: string): Promise<CashDrawerEntry | null> {
  const db = await getDb();
  const rows = await db.select<any[]>(
    `SELECT * FROM cash_drawer WHERE tenant_id = ? AND date = ? AND deleted_at IS NULL LIMIT 1`,
    [tenantId, date]
  );
  return rows.length ? rows[0] : null;
}

export async function upsertCashDrawerEntry(tenantId: string, date: string, data: {
  opening_balance: number;
  closing_balance?: number | null;
  notes?: string | null;
}): Promise<void> {
  const db = await getDb();
  const existing = await getCashDrawerEntry(tenantId, date);
  if (existing) {
    await db.execute(
      `UPDATE cash_drawer SET opening_balance = ?, closing_balance = ?, notes = ?, updated_at = ? WHERE id = ?`,
      [data.opening_balance, data.closing_balance ?? null, data.notes ?? null, now(), existing.id]
    );
  } else {
    await db.execute(
      `INSERT INTO cash_drawer (id, tenant_id, date, opening_balance, closing_balance, notes)
       VALUES (?,?,?,?,?,?)`,
      [uuid(), tenantId, date, data.opening_balance, data.closing_balance ?? null, data.notes ?? null]
    );
  }
}

export async function getCashDrawerHistory(tenantId: string, limit = 30): Promise<CashDrawerEntry[]> {
  const db = await getDb();
  return db.select<any[]>(
    `SELECT * FROM cash_drawer WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY date DESC LIMIT ?`,
    [tenantId, limit]
  );
}

export async function getCashSalesForDate(tenantId: string, date: string): Promise<number> {
  const db = await getDb();
  const rows = await db.select<{ total: number }[]>(
    `SELECT COALESCE(SUM(total), 0) as total FROM orders
     WHERE tenant_id = ? AND order_date LIKE ? AND payment_method = 'cash' AND deleted_at IS NULL AND status != 'voided'`,
    [tenantId, `${date}%`]
  );
  return rows[0]?.total ?? 0;
}

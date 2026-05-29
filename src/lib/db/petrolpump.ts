// [petrolpump] [all tenants]
import { getDb, uuid, now } from './index';

export interface PPShift {
  id: string;
  tenant_id: string;
  shift_no: string;
  shift_date: string;
  shift_type: string;
  staff_name: string;
  opening_reading: number;
  closing_reading: number;
  petrol_sold: number;
  diesel_sold: number;
  cash_collected: number;
  card_collected: number;
  upi_collected: number;
  credit_sales: number;
  status: string;
  notes: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface PPFuelRate {
  id: string;
  tenant_id: string;
  fuel_type: string;
  rate: number;
  effective_from: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface PPCreditAccount {
  id: string;
  tenant_id: string;
  customer_name: string;
  vehicle_no: string;
  phone: string;
  balance: number;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface PPCreditTransaction {
  id: string;
  tenant_id: string;
  account_id: string;
  fuel_type: string;
  litres: number;
  amount: number;
  type: string;
  date: string;
  updated_at: string | null;
  deleted_at: string | null;
}

// ── Shifts ──────────────────────────────────────────────────────────────────

export async function listShifts(tenantId: string, limit = 30): Promise<PPShift[]> {
  const db = await getDb();
  return db.select<PPShift[]>(
    `SELECT * FROM pp_shifts WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY shift_date DESC, shift_no DESC LIMIT ?`,
    [tenantId, limit]
  );
}

export async function getOpenShift(tenantId: string): Promise<PPShift | null> {
  const db = await getDb();
  const rows = await db.select<PPShift[]>(
    `SELECT * FROM pp_shifts WHERE tenant_id = ? AND status = 'open' AND deleted_at IS NULL ORDER BY shift_date DESC LIMIT 1`,
    [tenantId]
  );
  return rows[0] ?? null;
}

export async function createShift(tenantId: string, data: Omit<PPShift, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<PPShift> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO pp_shifts (id, tenant_id, shift_no, shift_date, shift_type, staff_name, opening_reading, status, notes)
     VALUES (?,?,?,?,?,?,?,'open',?)`,
    [id, tenantId, data.shift_no, data.shift_date, data.shift_type, data.staff_name, data.opening_reading, data.notes ?? '']
  );
  const rows = await db.select<PPShift[]>(`SELECT * FROM pp_shifts WHERE id = ?`, [id]);
  return rows[0];
}

export async function closeShift(tenantId: string, id: string, data: {
  closing_reading: number;
  petrol_sold: number;
  diesel_sold: number;
  cash_collected: number;
  card_collected: number;
  upi_collected: number;
  credit_sales: number;
  notes?: string;
}): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE pp_shifts SET status='closed', closing_reading=?, petrol_sold=?, diesel_sold=?,
     cash_collected=?, card_collected=?, upi_collected=?, credit_sales=?, notes=?, updated_at=?
     WHERE id = ? AND tenant_id = ?`,
    [data.closing_reading, data.petrol_sold, data.diesel_sold,
     data.cash_collected, data.card_collected, data.upi_collected, data.credit_sales,
     data.notes ?? '', now(), id, tenantId]
  );
}

export async function deleteShift(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE pp_shifts SET deleted_at=?, updated_at=? WHERE id=? AND tenant_id=?`,
    [now(), now(), id, tenantId]
  );
}

// ── Fuel Rates ───────────────────────────────────────────────────────────────

export async function getCurrentFuelRates(tenantId: string): Promise<PPFuelRate[]> {
  const db = await getDb();
  return db.select<PPFuelRate[]>(
    `SELECT r1.* FROM pp_fuel_rates r1
     INNER JOIN (
       SELECT fuel_type, MAX(effective_from) AS maxDate
       FROM pp_fuel_rates WHERE tenant_id = ? AND deleted_at IS NULL GROUP BY fuel_type
     ) r2 ON r1.fuel_type = r2.fuel_type AND r1.effective_from = r2.maxDate
     WHERE r1.tenant_id = ? AND r1.deleted_at IS NULL`,
    [tenantId, tenantId]
  );
}

export async function listFuelRates(tenantId: string): Promise<PPFuelRate[]> {
  const db = await getDb();
  return db.select<PPFuelRate[]>(
    `SELECT * FROM pp_fuel_rates WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY effective_from DESC`,
    [tenantId]
  );
}

export async function setFuelRate(tenantId: string, fuel_type: string, rate: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO pp_fuel_rates (id, tenant_id, fuel_type, rate, effective_from) VALUES (?,?,?,?,?)`,
    [uuid(), tenantId, fuel_type, rate, now()]
  );
}

// ── Credit Accounts ──────────────────────────────────────────────────────────

export async function listCreditAccounts(tenantId: string, search = ''): Promise<PPCreditAccount[]> {
  const db = await getDb();
  if (search) {
    return db.select<PPCreditAccount[]>(
      `SELECT * FROM pp_credit_accounts WHERE tenant_id=? AND deleted_at IS NULL
       AND (customer_name LIKE ? OR vehicle_no LIKE ? OR phone LIKE ?) ORDER BY customer_name`,
      [tenantId, `%${search}%`, `%${search}%`, `%${search}%`]
    );
  }
  return db.select<PPCreditAccount[]>(
    `SELECT * FROM pp_credit_accounts WHERE tenant_id=? AND deleted_at IS NULL ORDER BY customer_name`,
    [tenantId]
  );
}

export async function createCreditAccount(tenantId: string, data: Pick<PPCreditAccount, 'customer_name' | 'vehicle_no' | 'phone'>): Promise<PPCreditAccount> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO pp_credit_accounts (id, tenant_id, customer_name, vehicle_no, phone, balance) VALUES (?,?,?,?,?,0)`,
    [id, tenantId, data.customer_name, data.vehicle_no ?? '', data.phone ?? '']
  );
  const rows = await db.select<PPCreditAccount[]>(`SELECT * FROM pp_credit_accounts WHERE id=?`, [id]);
  return rows[0];
}

export async function updateCreditAccount(tenantId: string, id: string, data: Partial<PPCreditAccount>): Promise<void> {
  const db = await getDb();
  const fields = Object.keys(data).filter(k => ['customer_name','vehicle_no','phone'].includes(k));
  if (!fields.length) return;
  const setClause = [...fields.map(f => `${f}=?`), 'updated_at=?'].join(', ');
  await db.execute(
    `UPDATE pp_credit_accounts SET ${setClause} WHERE id=? AND tenant_id=?`,
    [...fields.map(f => (data as any)[f]), now(), id, tenantId]
  );
}

export async function deleteCreditAccount(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE pp_credit_accounts SET deleted_at=?, updated_at=? WHERE id=? AND tenant_id=?`,
    [now(), now(), id, tenantId]
  );
}

// ── Credit Transactions ──────────────────────────────────────────────────────

export async function listCreditTransactions(tenantId: string, accountId: string): Promise<PPCreditTransaction[]> {
  const db = await getDb();
  return db.select<PPCreditTransaction[]>(
    `SELECT * FROM pp_credit_transactions WHERE tenant_id=? AND account_id=? AND deleted_at IS NULL ORDER BY date DESC`,
    [tenantId, accountId]
  );
}

export async function addCreditTransaction(tenantId: string, data: Omit<PPCreditTransaction, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO pp_credit_transactions (id, tenant_id, account_id, fuel_type, litres, amount, type, date)
     VALUES (?,?,?,?,?,?,?,?)`,
    [uuid(), tenantId, data.account_id, data.fuel_type, data.litres, data.amount, data.type, data.date]
  );
  // update account balance
  const delta = data.type === 'debit' ? data.amount : -data.amount;
  await db.execute(
    `UPDATE pp_credit_accounts SET balance = balance + ?, updated_at=? WHERE id=? AND tenant_id=?`,
    [delta, now(), data.account_id, tenantId]
  );
}

// ── Stats ────────────────────────────────────────────────────────────────────

export interface PPDashStats {
  todayLitresPetrol: number;
  todayLitresDiesel: number;
  todayRevenue: number;
  openShiftId: string | null;
  totalCreditOutstanding: number;
}

export async function getPPStats(tenantId: string): Promise<PPDashStats> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const [todayShifts] = await Promise.all([
    db.select<{ petrol_sold: number; diesel_sold: number; cash_collected: number; card_collected: number; upi_collected: number; credit_sales: number }[]>(
      `SELECT petrol_sold, diesel_sold, cash_collected, card_collected, upi_collected, credit_sales
       FROM pp_shifts WHERE tenant_id=? AND shift_date=? AND deleted_at IS NULL`,
      [tenantId, today]
    ),
  ]);
  const todayLitresPetrol = todayShifts.reduce((s, r) => s + r.petrol_sold, 0);
  const todayLitresDiesel = todayShifts.reduce((s, r) => s + r.diesel_sold, 0);
  const todayRevenue = todayShifts.reduce((s, r) => s + r.cash_collected + r.card_collected + r.upi_collected + r.credit_sales, 0);

  const openShiftRow = await db.select<{ id: string }[]>(
    `SELECT id FROM pp_shifts WHERE tenant_id=? AND status='open' AND deleted_at IS NULL LIMIT 1`,
    [tenantId]
  );
  const [creditRow] = await db.select<{ total: number }[]>(
    `SELECT COALESCE(SUM(balance),0) AS total FROM pp_credit_accounts WHERE tenant_id=? AND deleted_at IS NULL`,
    [tenantId]
  );
  return {
    todayLitresPetrol,
    todayLitresDiesel,
    todayRevenue,
    openShiftId: openShiftRow[0]?.id ?? null,
    totalCreditOutstanding: creditRow?.total ?? 0,
  };
}

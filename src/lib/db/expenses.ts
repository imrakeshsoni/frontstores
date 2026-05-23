import { getDb, uuid, now } from './index';

export interface Expense {
  id: string;
  tenant_id: string;
  category: string;
  description: string | null;
  amount: number;
  expense_date: string;
  payment_method: 'cash' | 'upi' | 'card';
  notes: string | null;
}

export const EXPENSE_CATEGORIES = [
  'Rent', 'Electricity', 'Salaries', 'Purchase / Stock', 'Transport',
  'Maintenance', 'Marketing', 'Packaging', 'Miscellaneous',
];

export async function listExpenses(tenantId: string, from: string, to: string): Promise<Expense[]> {
  const db = await getDb();
  return db.select<Expense[]>(
    `SELECT * FROM expenses
     WHERE tenant_id = ? AND deleted_at IS NULL
       AND expense_date BETWEEN ? AND ?
     ORDER BY expense_date DESC`,
    [tenantId, from, to + ' 23:59:59']
  );
}

export async function addExpense(tenantId: string, data: Omit<Expense, 'id' | 'tenant_id'>) {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO expenses (id, tenant_id, category, description, amount, expense_date, payment_method, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, tenantId, data.category, data.description || null, data.amount, data.expense_date, data.payment_method, data.notes || null, now(), now()]
  );
  return id;
}

export async function deleteExpense(tenantId: string, id: string) {
  const db = await getDb();
  await db.execute(
    `UPDATE expenses SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`,
    [now(), now(), id, tenantId]
  );
}

export async function getExpenseSummary(tenantId: string, from: string, to: string) {
  const db = await getDb();
  const rows = await db.select<{ category: string; total: number }[]>(
    `SELECT category, SUM(amount) AS total FROM expenses
     WHERE tenant_id = ? AND deleted_at IS NULL AND expense_date BETWEEN ? AND ?
     GROUP BY category ORDER BY total DESC`,
    [tenantId, from, to + ' 23:59:59']
  );
  return rows;
}

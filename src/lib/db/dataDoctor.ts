// [core] [all apps] [all tenants] — Data Doctor.
// Runs on launch (best-effort, never blocks). Detects data-integrity violations, auto-heals the
// ones that are always safe to fix, and reports a summary so silent corruption becomes either
// self-corrected or visible. Add new invariants here as we find them — this is the single place
// that keeps already-shipped features working smoothly.
import { getDb, now } from './index';
import { reconcileBatchStock } from './inventory';

export interface DataDoctorReport {
  batchDriftFixed: number;     // products whose batch sum exceeded stock_qty (auto-healed)
  negativeStockFixed: number;  // products with impossible negative stock (clamped to 0)
  orphanOrderItems: number;    // line items whose parent bill is gone (flagged, not deleted)
}

const count = async (db: any, sql: string, params: unknown[]): Promise<number> => {
  const rows = await db.select(sql, params) as { c: number }[];
  return rows[0]?.c ?? 0;
};

export async function runDataDoctor(tenantId: string): Promise<DataDoctorReport> {
  const db = await getDb();

  // 1) Batch over-count (POS search sums batches; sales must have drawn them down). Auto-heal.
  const batchDriftFixed = await count(db,
    `SELECT COUNT(*) AS c FROM (
       SELECT p.id FROM products p
       JOIN inventory_batches b ON b.product_id = p.id AND b.deleted_at IS NULL AND b.quantity > 0
       WHERE p.tenant_id = ? AND p.deleted_at IS NULL
       GROUP BY p.id HAVING SUM(b.quantity) > p.stock_qty)`,
    [tenantId]);
  await reconcileBatchStock(tenantId);

  // 2) Negative on-hand stock is physically impossible and breaks reports. Clamp to 0.
  const negativeStockFixed = await count(db,
    `SELECT COUNT(*) AS c FROM products WHERE tenant_id = ? AND deleted_at IS NULL AND stock_qty < 0`,
    [tenantId]);
  if (negativeStockFixed > 0) {
    await db.execute(
      `UPDATE products SET stock_qty = 0, updated_at = ? WHERE tenant_id = ? AND deleted_at IS NULL AND stock_qty < 0`,
      [now(), tenantId]);
  }

  // 3) Orphan order_items (parent bill missing/deleted) inflate sales reports. FLAG ONLY — never
  //    hard-delete user data; just surface the count so we can investigate.
  const orphanOrderItems = await count(db,
    `SELECT COUNT(*) AS c FROM order_items oi
     WHERE oi.tenant_id = ?
       AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.id = oi.order_id AND o.deleted_at IS NULL)`,
    [tenantId]);

  return { batchDriftFixed, negativeStockFixed, orphanOrderItems };
}

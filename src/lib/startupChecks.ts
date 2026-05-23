import { getDb } from './db/index';
import { toast } from 'sonner';

export async function runStartupChecks(tenantId: string) {
  if (!tenantId) return;
  await checkLowStock(tenantId);
  await checkExpiringProducts(tenantId);
}

async function checkLowStock(tenantId: string) {
  const db = await getDb();
  const rows = await db.select<{ name: string; stock_quantity: number; min_stock_level: number }[]>(
    `SELECT name, stock_quantity, min_stock_level FROM products
     WHERE tenant_id = ? AND deleted_at IS NULL
       AND min_stock_level IS NOT NULL AND min_stock_level > 0
       AND stock_quantity <= min_stock_level
     ORDER BY stock_quantity ASC LIMIT 10`,
    [tenantId]
  );
  if (rows.length === 0) return;
  const names = rows.slice(0, 3).map(r => `${r.name} (${r.stock_quantity} left)`).join(', ');
  const more = rows.length > 3 ? ` +${rows.length - 3} more` : '';
  toast.warning(`⚠ Low stock: ${names}${more}`, {
    duration: 8000,
    description: 'Go to Inventory to restock',
  });
}

async function checkExpiringProducts(tenantId: string) {
  const db = await getDb();
  // Products expiring within 30 days (medical shops use expiry dates on batches)
  const rows = await db.select<{ product_name: string; expiry_date: string }[]>(
    `SELECT p.name AS product_name, b.expiry_date
     FROM inventory_batches b
     JOIN products p ON p.id = b.product_id
     WHERE b.tenant_id = ? AND b.deleted_at IS NULL
       AND b.expiry_date IS NOT NULL AND b.quantity_remaining > 0
       AND date(b.expiry_date) <= date('now', '+30 days')
       AND date(b.expiry_date) >= date('now')
     ORDER BY b.expiry_date ASC LIMIT 5`,
    [tenantId]
  );
  if (rows.length === 0) return;
  const names = rows.slice(0, 2).map(r => r.product_name).join(', ');
  const more = rows.length > 2 ? ` +${rows.length - 2} more` : '';
  toast.warning(`⚠ Expiring soon: ${names}${more}`, {
    duration: 8000,
    description: 'Check Inventory → Expiry tab',
  });
}

import { getDb } from './db/index';
import { toast } from 'sonner';
import { runAutoBackup } from './db/autoBackup';

export async function runStartupChecks(tenantId: string, shopType?: string) {
  if (!tenantId) return;
  await ensureRegistered(tenantId);
  // [core] [all apps] [all tenants] — Data Doctor: auto-heal integrity issues (batch/stock
  // drift, negative stock) + flag anything suspicious. Idempotent + best-effort; never blocks.
  try {
    const { runDataDoctor } = await import('./db/dataDoctor');
    const report = await runDataDoctor(tenantId);
    const healed = report.batchDriftFixed + report.negativeStockFixed;
    if (healed > 0) {
      toast.success(`✓ Auto-corrected stock for ${healed} item${healed > 1 ? 's' : ''}`, { duration: 6000 });
    }
    if (report.orphanOrderItems > 0) {
      console.warn(`[data-doctor] ${report.orphanOrderItems} orphan order_items flagged for tenant ${tenantId}`);
    }
  } catch { /* non-fatal */ }
  await checkLowStock(tenantId);
  await checkExpiringProducts(tenantId);
  if (shopType === 'carwash') {
    await checkExpiringMemberships(tenantId);
    await checkLowCarwashInventory(tenantId);
  }
  // Best-effort daily local backup safety net — never blocks or breaks launch.
  void runAutoBackup(tenantId);
}

// Re-queue registration on every launch if it was never successfully synced to server.
// Prevents lost registrations when server was down during setup or database was reset.
// [core] [all tenants]
async function ensureRegistered(tenantId: string) {
  try {
    const db = await getDb();
    const synced = await db.select<{ id: string }[]>(
      `SELECT id FROM sync_queue WHERE tenant_id = ? AND type = 'register' AND synced_at IS NOT NULL LIMIT 1`,
      [tenantId]
    );
    if (synced.length > 0) return; // already registered with server

    // Not synced yet — check if queued already
    const queued = await db.select<{ id: string }[]>(
      `SELECT id FROM sync_queue WHERE tenant_id = ? AND type = 'register' AND synced_at IS NULL LIMIT 1`,
      [tenantId]
    );
    if (queued.length > 0) return; // already in queue, will be flushed

    // Neither synced nor queued — re-enqueue from app_config
    const configs = await db.select<{
      tenant_id: string; shop_name: string; owner_name: string;
      shop_type: string; phone: string; email: string; city: string; gstin: string;
    }[]>(`SELECT tenant_id, shop_name, owner_name, shop_type, phone, email, city, gstin FROM app_config WHERE tenant_id = ? LIMIT 1`, [tenantId]);
    if (configs.length === 0) return;

    const { enqueue, flushQueue } = await import('./syncQueue');
    await enqueue('register', tenantId, {
      tenant_id: configs[0].tenant_id,
      shop_name: configs[0].shop_name ?? '',
      owner_name: configs[0].owner_name ?? '',
      shop_type: configs[0].shop_type ?? '',
      phone: configs[0].phone ?? '',
      email: configs[0].email ?? '',
      city: configs[0].city ?? '',
      gstin: configs[0].gstin ?? '',
    });
    await flushQueue().catch(() => {});
  } catch { /* non-fatal */ }
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

// [carwash] [all tenants]
async function checkExpiringMemberships(tenantId: string) {
  try {
    const { getExpiringMemberships } = await import('./db/carwash');
    const memberships = await getExpiringMemberships(tenantId, 7);
    if (memberships.length === 0) return;
    const names = memberships.slice(0, 2).map(m => `${m.customer_name} (${m.total_washes - m.used_washes} washes left)`).join(', ');
    const more = memberships.length > 2 ? ` +${memberships.length - 2} more` : '';
    toast.warning(`⚠ Memberships expiring soon: ${names}${more}`, {
      duration: 8000,
      description: 'Go to Memberships to notify customers',
    });
  } catch { /* non-fatal */ }
}

// [carwash] [all tenants]
async function checkLowCarwashInventory(tenantId: string) {
  try {
    const { getLowStockInventory } = await import('./db/carwash');
    const items = await getLowStockInventory(tenantId);
    if (items.length === 0) return;
    const names = items.slice(0, 3).map(i => `${i.name} (${i.quantity} ${i.unit})`).join(', ');
    const more = items.length > 3 ? ` +${items.length - 3} more` : '';
    toast.warning(`⚠ Low supply stock: ${names}${more}`, {
      duration: 8000,
      description: 'Go to Inventory to restock',
    });
  } catch { /* non-fatal */ }
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

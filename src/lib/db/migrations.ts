import migration0001 from '../../../src-tauri/migrations/0001_initial.sql?raw';
import migration0002 from '../../../src-tauri/migrations/0002_subscription.sql?raw';
import migration0003 from '../../../src-tauri/migrations/0003_sync_queue.sql?raw';
import migration0004 from '../../../src-tauri/migrations/0004_last_verified.sql?raw';
import migration0005 from '../../../src-tauri/migrations/0005_khata.sql?raw';
import migration0006 from '../../../src-tauri/migrations/0006_app_auth.sql?raw';
import migration0007 from '../../../src-tauri/migrations/0007_purchase_orders.sql?raw';
import migration0008 from '../../../src-tauri/migrations/0008_supplier_payments.sql?raw';
import migration0009 from '../../../src-tauri/migrations/0009_security.sql?raw';

export interface Migration {
  name: string;
  sql: string;
}

export async function readMigrations(): Promise<Migration[]> {
  return [
    { name: '0001_initial', sql: migration0001 },
    { name: '0002_subscription', sql: migration0002 },
    { name: '0003_sync_queue', sql: migration0003 },
    { name: '0004_last_verified', sql: migration0004 },
    { name: '0005_khata', sql: migration0005 },
    { name: '0006_app_auth', sql: migration0006 },
    { name: '0007_purchase_orders', sql: migration0007 },
    { name: '0008_supplier_payments', sql: migration0008 },
    { name: '0009_security', sql: migration0009 },
  ];
}

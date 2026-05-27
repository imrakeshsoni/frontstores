import migration0001 from '../../../src-tauri/migrations/0001_initial.sql?raw';
import migration0002 from '../../../src-tauri/migrations/0002_subscription.sql?raw';
import migration0003 from '../../../src-tauri/migrations/0003_sync_queue.sql?raw';
import migration0004 from '../../../src-tauri/migrations/0004_last_verified.sql?raw';
import migration0005 from '../../../src-tauri/migrations/0005_khata.sql?raw';
import migration0006 from '../../../src-tauri/migrations/0006_app_auth.sql?raw';
import migration0007 from '../../../src-tauri/migrations/0007_purchase_orders.sql?raw';
import migration0008 from '../../../src-tauri/migrations/0008_supplier_payments.sql?raw';
import migration0009 from '../../../src-tauri/migrations/0009_security.sql?raw';
import migration0010 from '../../../src-tauri/migrations/0010_server_time.sql?raw';
import migration0011 from '../../../src-tauri/migrations/0011_fix_app_auth_columns.sql?raw';
import migration0012 from '../../../src-tauri/migrations/0012_ai_memory.sql?raw';
import migration0013 from '../../../src-tauri/migrations/0013_restaurant.sql?raw';
import migration0014 from '../../../src-tauri/migrations/0014_challan_number.sql?raw';
import migration0015 from '../../../src-tauri/migrations/0015_restaurant_staff.sql?raw';
import migration0016 from '../../../src-tauri/migrations/0016_grocery_wholesale.sql?raw';

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
    { name: '0010_server_time', sql: migration0010 },
    { name: '0011_fix_app_auth_columns', sql: migration0011 },
    { name: '0012_ai_memory', sql: migration0012 },
    { name: '0013_restaurant', sql: migration0013 },
    { name: '0014_challan_number', sql: migration0014 },
    { name: '0015_restaurant_staff', sql: migration0015 },
    { name: '0016_grocery_wholesale', sql: migration0016 },
  ];
}

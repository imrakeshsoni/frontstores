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
import migration0017 from '../../../src-tauri/migrations/0017_carwash.sql?raw';
import migration0018 from '../../../src-tauri/migrations/0018_clinic.sql?raw';
import migration0019 from '../../../src-tauri/migrations/0019_beauty.sql?raw';
import migration0020 from '../../../src-tauri/migrations/0020_study.sql?raw';
import migration0021 from '../../../src-tauri/migrations/0021_study_resources.sql?raw';
import migration0022 from '../../../src-tauri/migrations/0022_study_ai_persona.sql?raw';
import migration0023 from '../../../src-tauri/migrations/0023_study_new_features.sql?raw';
import migration0024 from '../../../src-tauri/migrations/0024_study_round2.sql?raw';
import migration0025 from '../../../src-tauri/migrations/0025_study_round3.sql?raw';
import migration0026 from '../../../src-tauri/migrations/0026_linked_accounts.sql?raw';
import migration0027 from '../../../src-tauri/migrations/0027_coaching.sql?raw';
import migration0028 from '../../../src-tauri/migrations/0028_gym.sql?raw';
import migration0029 from '../../../src-tauri/migrations/0029_jewellery.sql?raw';
import migration0030 from '../../../src-tauri/migrations/0030_realestate.sql?raw';
import migration0031 from '../../../src-tauri/migrations/0031_hotel.sql?raw';
import migration0040 from '../../../src-tauri/migrations/0040_clothing.sql?raw'; // [clothing] [all tenants]
import migration0041 from '../../../src-tauri/migrations/0041_bakery.sql?raw'; // [bakery] [all tenants]
import migration0042 from '../../../src-tauri/migrations/0042_optician.sql?raw'; // [optician] [all tenants]

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
    { name: '0017_carwash', sql: migration0017 },
    { name: '0018_clinic', sql: migration0018 },
    { name: '0019_beauty', sql: migration0019 },
    { name: '0020_study', sql: migration0020 },
    { name: '0021_study_resources', sql: migration0021 },
    { name: '0022_study_ai_persona', sql: migration0022 },
    { name: '0023_study_new_features', sql: migration0023 },
    { name: '0024_study_round2', sql: migration0024 },
    { name: '0025_study_round3', sql: migration0025 },
    { name: '0026_linked_accounts', sql: migration0026 },
    { name: '0027_coaching', sql: migration0027 },
    { name: '0028_gym', sql: migration0028 },
    { name: '0029_jewellery', sql: migration0029 },
    { name: '0030_realestate', sql: migration0030 },
    { name: '0031_hotel', sql: migration0031 },
    { name: '0040_clothing', sql: migration0040 }, // [clothing] [all tenants]
    { name: '0041_bakery', sql: migration0041 }, // [bakery] [all tenants]
    { name: '0042_optician', sql: migration0042 }, // [optician] [all tenants]
  ];
}

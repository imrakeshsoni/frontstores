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
import migration0032 from '../../../src-tauri/migrations/0032_pharmacy.sql?raw';
import migration0033 from '../../../src-tauri/migrations/0033_tailor.sql?raw';
import migration0034 from '../../../src-tauri/migrations/0034_hardware.sql?raw';
import migration0035 from '../../../src-tauri/migrations/0035_repair.sql?raw';
import migration0036 from '../../../src-tauri/migrations/0036_drivingschool.sql?raw';
import migration0037 from '../../../src-tauri/migrations/0037_laundry.sql?raw';
import migration0038 from '../../../src-tauri/migrations/0038_catering.sql?raw';
import migration0039 from '../../../src-tauri/migrations/0039_pestcontrol.sql?raw';
import migration0040 from '../../../src-tauri/migrations/0040_clothing.sql?raw';
import migration0041 from '../../../src-tauri/migrations/0041_bakery.sql?raw';
import migration0042 from '../../../src-tauri/migrations/0042_optician.sql?raw';
import migration0043 from '../../../src-tauri/migrations/0043_petrolpump.sql?raw';
import migration0044 from '../../../src-tauri/migrations/0044_furniture.sql?raw';
import migration0045 from '../../../src-tauri/migrations/0045_printing.sql?raw';
import migration0046 from '../../../src-tauri/migrations/0046_ca.sql?raw';
import migration0047 from '../../../src-tauri/migrations/0047_events.sql?raw';
import migration0048 from '../../../src-tauri/migrations/0048_travel.sql?raw';
import migration0049 from '../../../src-tauri/migrations/0049_insurance.sql?raw';
import migration0050 from '../../../src-tauri/migrations/0050_homeservice.sql?raw';
import migration0051 from '../../../src-tauri/migrations/0051_carwash_improvements.sql?raw';
import migration0052 from '../../../src-tauri/migrations/0052_carwash_vehicle_types.sql?raw';
import migration0053 from '../../../src-tauri/migrations/0053_carwash_service_prices.sql?raw';
import migration0054 from '../../../src-tauri/migrations/0054_carwash_attendance.sql?raw';
import migration0055 from '../../../src-tauri/migrations/0055_carwash_advance_salary.sql?raw';
import migration0056 from '../../../src-tauri/migrations/0056_carwash_indexes.sql?raw';
import migration0057 from '../../../src-tauri/migrations/0057_tyrescrap.sql?raw';
import migration0058 from '../../../src-tauri/migrations/0058_carwash_advance_given_at.sql?raw';
import migration0059 from '../../../src-tauri/migrations/0059_carwash_inventory_v2.sql?raw';
import migration0060 from '../../../src-tauri/migrations/0060_carwash_inventory_log.sql?raw';
import migration0061 from '../../../src-tauri/migrations/0061_ca_staff.sql?raw';
import migration0062 from '../../../src-tauri/migrations/0062_carwash_salary_payments.sql?raw';
import migration0063 from '../../../src-tauri/migrations/0063_hardware_staff.sql?raw';
import migration0064 from '../../../src-tauri/migrations/0064_hardware_pro.sql?raw';
import migration0065 from '../../../src-tauri/migrations/0065_crm.sql?raw';
import migration0066 from '../../../src-tauri/migrations/0066_staff_users.sql?raw';
import migration0067 from '../../../src-tauri/migrations/0067_announcements.sql?raw';
import migration0068 from '../../../src-tauri/migrations/0068_crm_leads_accounts.sql?raw';
import migration0069 from '../../../src-tauri/migrations/0069_crm_ownership.sql?raw';
import migration0070 from '../../../src-tauri/migrations/0070_staff_users_v2.sql?raw';

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
    { name: '0032_pharmacy', sql: migration0032 },
    { name: '0033_tailor', sql: migration0033 },
    { name: '0034_hardware', sql: migration0034 },
    { name: '0035_repair', sql: migration0035 },
    { name: '0036_drivingschool', sql: migration0036 },
    { name: '0037_laundry', sql: migration0037 },
    { name: '0038_catering', sql: migration0038 },
    { name: '0039_pestcontrol', sql: migration0039 },
    { name: '0040_clothing', sql: migration0040 },
    { name: '0041_bakery', sql: migration0041 },
    { name: '0042_optician', sql: migration0042 },
    { name: '0043_petrolpump', sql: migration0043 },
    { name: '0044_furniture', sql: migration0044 },
    { name: '0045_printing', sql: migration0045 },
    { name: '0046_ca', sql: migration0046 },
    { name: '0047_events', sql: migration0047 },
    { name: '0048_travel', sql: migration0048 },
    { name: '0049_insurance', sql: migration0049 },
    { name: '0050_homeservice', sql: migration0050 },
    { name: '0051_carwash_improvements', sql: migration0051 },
    { name: '0052_carwash_vehicle_types', sql: migration0052 },
    { name: '0053_carwash_service_prices', sql: migration0053 },
    { name: '0054_carwash_attendance', sql: migration0054 },
    { name: '0055_carwash_advance_salary', sql: migration0055 },
    { name: '0056_carwash_indexes', sql: migration0056 },
    { name: '0057_tyrescrap', sql: migration0057 }, // [tyrescrap] [all tenants]
    { name: '0058_carwash_advance_given_at', sql: migration0058 }, // [carwash] [all tenants]
    { name: '0059_carwash_inventory_v2', sql: migration0059 }, // [carwash] [all tenants]
    { name: '0060_carwash_inventory_log', sql: migration0060 }, // [carwash] [all tenants]
    { name: '0061_ca_staff', sql: migration0061 }, // [ca] [all tenants]
    { name: '0062_carwash_salary_payments', sql: migration0062 }, // [carwash] [all tenants]
    { name: '0063_hardware_staff', sql: migration0063 }, // [hardware] [all tenants]
    { name: '0064_hardware_pro', sql: migration0064 }, // [hardware] [all tenants]
    { name: '0065_crm', sql: migration0065 }, // [crm] [all tenants]
    { name: '0066_staff_users', sql: migration0066 }, // [core] [all apps] [all tenants]
    { name: '0067_announcements', sql: migration0067 }, // [core] [all apps] [all tenants]
    { name: '0068_crm_leads_accounts', sql: migration0068 }, // [crm] [all tenants]
    { name: '0069_crm_ownership', sql: migration0069 }, // [crm] [all tenants]
    { name: '0070_staff_users_v2', sql: migration0070 }, // [core] [all apps] [all tenants]
  ];
}

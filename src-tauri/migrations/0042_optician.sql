-- [optician] [all tenants]
CREATE TABLE IF NOT EXISTS opt_patients (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  name TEXT NOT NULL, phone TEXT DEFAULT '',
  dob TEXT DEFAULT '', address TEXT DEFAULT '',
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS opt_prescriptions (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  patient_id TEXT NOT NULL, doctor_name TEXT DEFAULT '',
  exam_date TEXT NOT NULL,
  r_sph TEXT DEFAULT '', r_cyl TEXT DEFAULT '', r_axis TEXT DEFAULT '', r_add TEXT DEFAULT '', r_va TEXT DEFAULT '',
  l_sph TEXT DEFAULT '', l_cyl TEXT DEFAULT '', l_add TEXT DEFAULT '', l_axis TEXT DEFAULT '', l_va TEXT DEFAULT '',
  pd TEXT DEFAULT '', notes TEXT DEFAULT '',
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS opt_orders (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  order_no TEXT DEFAULT '', patient_id TEXT NOT NULL,
  prescription_id TEXT DEFAULT '', frame_desc TEXT DEFAULT '',
  lens_type TEXT DEFAULT '', lens_brand TEXT DEFAULT '',
  coating TEXT DEFAULT '', tint TEXT DEFAULT '',
  advance_paid REAL DEFAULT 0, total_amount REAL DEFAULT 0,
  status TEXT DEFAULT 'order_placed', promised_date TEXT,
  delivered_at TEXT, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS opt_inventory (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  name TEXT NOT NULL, category TEXT DEFAULT 'frame',
  brand TEXT DEFAULT '', stock INTEGER DEFAULT 0,
  purchase_price REAL DEFAULT 0, selling_price REAL DEFAULT 0,
  updated_at TEXT, deleted_at TEXT
);

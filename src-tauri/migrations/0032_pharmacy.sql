-- [medical] [all tenants] Pharmacy tables: batches, prescriptions, schedule register, patient history, supplier returns
CREATE TABLE IF NOT EXISTS rx_batches (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  product_id TEXT NOT NULL, batch_no TEXT NOT NULL,
  expiry_date TEXT NOT NULL, mfg_date TEXT,
  quantity INTEGER DEFAULT 0, purchase_price REAL DEFAULT 0,
  selling_price REAL DEFAULT 0, supplier_id TEXT DEFAULT '',
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS rx_prescriptions (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  customer_id TEXT DEFAULT '', doctor_name TEXT DEFAULT '',
  doctor_reg_no TEXT DEFAULT '', prescription_no TEXT DEFAULT '',
  prescription_date TEXT, notes TEXT DEFAULT '',
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS rx_schedule_register (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  medicine_name TEXT NOT NULL, schedule_type TEXT DEFAULT 'H',
  quantity REAL DEFAULT 0, patient_name TEXT DEFAULT '',
  patient_address TEXT DEFAULT '', doctor_name TEXT DEFAULT '',
  prescription_no TEXT DEFAULT '', sale_date TEXT NOT NULL,
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS rx_patient_history (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  customer_id TEXT NOT NULL, product_id TEXT NOT NULL,
  product_name TEXT NOT NULL, quantity REAL DEFAULT 0,
  prescription_id TEXT DEFAULT '', sale_date TEXT NOT NULL,
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS rx_supplier_returns (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  supplier_id TEXT DEFAULT '', batch_id TEXT DEFAULT '',
  product_name TEXT NOT NULL, batch_no TEXT DEFAULT '',
  quantity REAL DEFAULT 0, reason TEXT DEFAULT '',
  return_date TEXT NOT NULL, amount REAL DEFAULT 0,
  updated_at TEXT, deleted_at TEXT
);

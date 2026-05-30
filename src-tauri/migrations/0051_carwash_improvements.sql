-- [carwash] [all tenants] — appointments, inventory, loyalty points

CREATE TABLE IF NOT EXISTS carwash_appointments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  appointment_date TEXT NOT NULL,
  appointment_time TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  reg_number TEXT,
  vehicle_type TEXT NOT NULL DEFAULT 'sedan',
  make TEXT,
  model TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  staff_id TEXT,
  staff_name TEXT,
  services_note TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  job_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_carwash_appts_date ON carwash_appointments(tenant_id, appointment_date) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS carwash_inventory (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'chemical',
  unit TEXT NOT NULL DEFAULT 'litre',
  quantity REAL NOT NULL DEFAULT 0,
  min_quantity REAL NOT NULL DEFAULT 0,
  cost_per_unit REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS carwash_loyalty (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  reg_number TEXT,
  total_points INTEGER NOT NULL DEFAULT 0,
  redeemed_points INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_carwash_loyalty_phone ON carwash_loyalty(tenant_id, customer_phone) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS carwash_loyalty_transactions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  loyalty_id TEXT NOT NULL,
  job_id TEXT,
  points INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'earn',
  note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

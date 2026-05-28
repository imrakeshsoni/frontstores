-- [beauty] [all tenants] — full beauty parlor schema
CREATE TABLE IF NOT EXISTS beauty_services (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'hair',
  description TEXT,
  price REAL NOT NULL DEFAULT 0,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  gst_rate REAL NOT NULL DEFAULT 18,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS beauty_staff (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'stylist',
  specialization TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS beauty_appointments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  appointment_number TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  customer_id TEXT,
  staff_id TEXT,
  staff_name TEXT,
  appointment_date TEXT NOT NULL,
  time_slot TEXT,
  status TEXT NOT NULL DEFAULT 'walk_in',
  payment_method TEXT NOT NULL DEFAULT 'cash',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  subtotal REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  gst_amount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  membership_id TEXT,
  notes TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_beauty_appts_date ON beauty_appointments(tenant_id, appointment_date) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS beauty_appointment_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  appointment_id TEXT NOT NULL,
  service_id TEXT,
  service_name TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  gst_rate REAL NOT NULL DEFAULT 18,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS beauty_memberships (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_id TEXT,
  package_name TEXT NOT NULL,
  total_sessions INTEGER NOT NULL DEFAULT 10,
  used_sessions INTEGER NOT NULL DEFAULT 0,
  amount_paid REAL NOT NULL DEFAULT 0,
  valid_until TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

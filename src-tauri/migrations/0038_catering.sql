-- [catering] [all tenants]
CREATE TABLE IF NOT EXISTS catering_events (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  event_no TEXT DEFAULT '', customer_name TEXT NOT NULL,
  customer_phone TEXT DEFAULT '', event_type TEXT DEFAULT '',
  event_date TEXT NOT NULL, venue TEXT DEFAULT '',
  guest_count INTEGER DEFAULT 0, menu TEXT DEFAULT '[]',
  total_amount REAL DEFAULT 0, advance_paid REAL DEFAULT 0,
  status TEXT DEFAULT 'confirmed', notes TEXT DEFAULT '',
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS catering_menu_items (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  name TEXT NOT NULL, category TEXT DEFAULT 'main',
  price_per_plate REAL DEFAULT 0, min_order INTEGER DEFAULT 50,
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS catering_staff_assignments (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  event_id TEXT NOT NULL, staff_name TEXT NOT NULL,
  role TEXT DEFAULT 'server', updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS catering_expenses (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  event_id TEXT DEFAULT '', description TEXT NOT NULL,
  amount REAL DEFAULT 0, date TEXT NOT NULL,
  updated_at TEXT, deleted_at TEXT
);

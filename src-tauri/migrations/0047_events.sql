-- [events] [all tenants]
CREATE TABLE IF NOT EXISTS ev_events (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  event_no TEXT DEFAULT '', client_name TEXT NOT NULL,
  client_phone TEXT DEFAULT '', event_type TEXT DEFAULT '',
  event_date TEXT NOT NULL, venue TEXT DEFAULT '',
  guest_count INTEGER DEFAULT 0, quoted_amount REAL DEFAULT 0,
  advance_paid REAL DEFAULT 0, status TEXT DEFAULT 'inquiry',
  notes TEXT DEFAULT '', updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS ev_tasks (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  event_id TEXT NOT NULL, task_name TEXT NOT NULL,
  assigned_to TEXT DEFAULT '', due_date TEXT,
  status TEXT DEFAULT 'pending', updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS ev_vendors (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  name TEXT NOT NULL, category TEXT DEFAULT '',
  phone TEXT DEFAULT '', notes TEXT DEFAULT '',
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS ev_expenses (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  event_id TEXT NOT NULL, description TEXT NOT NULL,
  amount REAL DEFAULT 0, date TEXT NOT NULL,
  updated_at TEXT, deleted_at TEXT
);

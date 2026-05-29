-- [drivingschool] [all tenants]
CREATE TABLE IF NOT EXISTS ds_students (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  name TEXT NOT NULL, phone TEXT DEFAULT '',
  address TEXT DEFAULT '', dob TEXT DEFAULT '',
  id_proof_type TEXT DEFAULT '', id_proof_no TEXT DEFAULT '',
  license_type TEXT DEFAULT 'LMV',
  enrolled_at TEXT NOT NULL, ll_test_date TEXT,
  ll_passed INTEGER DEFAULT 0, dl_test_date TEXT,
  dl_passed INTEGER DEFAULT 0, dl_no TEXT DEFAULT '',
  fees_total REAL DEFAULT 0, fees_paid REAL DEFAULT 0,
  status TEXT DEFAULT 'active',
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS ds_sessions (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  student_id TEXT NOT NULL, vehicle_id TEXT DEFAULT '',
  instructor_id TEXT DEFAULT '', session_date TEXT NOT NULL,
  start_time TEXT DEFAULT '', duration_mins INTEGER DEFAULT 60,
  status TEXT DEFAULT 'scheduled', notes TEXT DEFAULT '',
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS ds_vehicles (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  reg_no TEXT NOT NULL, type TEXT DEFAULT 'car',
  brand TEXT DEFAULT '', model TEXT DEFAULT '',
  fitness_expiry TEXT, insurance_expiry TEXT,
  status TEXT DEFAULT 'active',
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS ds_instructors (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  name TEXT NOT NULL, phone TEXT DEFAULT '',
  license_no TEXT DEFAULT '', license_expiry TEXT,
  status TEXT DEFAULT 'active',
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS ds_payments (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  student_id TEXT NOT NULL, amount REAL DEFAULT 0,
  payment_mode TEXT DEFAULT 'cash', date TEXT NOT NULL,
  notes TEXT DEFAULT '', updated_at TEXT, deleted_at TEXT
);

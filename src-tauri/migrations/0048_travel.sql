-- [travel] [all tenants]
CREATE TABLE IF NOT EXISTS tr_bookings (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  booking_no TEXT DEFAULT '', customer_name TEXT NOT NULL,
  customer_phone TEXT DEFAULT '', pax INTEGER DEFAULT 1,
  trip_type TEXT DEFAULT 'domestic', destination TEXT NOT NULL,
  departure_date TEXT NOT NULL, return_date TEXT,
  total_amount REAL DEFAULT 0, advance_paid REAL DEFAULT 0,
  status TEXT DEFAULT 'confirmed', notes TEXT DEFAULT '',
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS tr_payments (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  booking_id TEXT NOT NULL, amount REAL DEFAULT 0,
  payment_mode TEXT DEFAULT 'cash', date TEXT NOT NULL,
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS tr_visa (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  booking_id TEXT NOT NULL, customer_name TEXT NOT NULL,
  passport_no TEXT DEFAULT '', visa_type TEXT DEFAULT '',
  applied_date TEXT, status TEXT DEFAULT 'applied',
  approved_date TEXT, expiry_date TEXT,
  updated_at TEXT, deleted_at TEXT
);

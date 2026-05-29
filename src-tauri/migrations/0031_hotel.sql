-- [hotel] [all tenants]
-- rooms
CREATE TABLE IF NOT EXISTS hotel_rooms (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  number TEXT NOT NULL,
  type TEXT NOT NULL,
  floor INTEGER DEFAULT 1,
  capacity INTEGER DEFAULT 2,
  rate_weekday REAL DEFAULT 0,
  rate_weekend REAL DEFAULT 0,
  status TEXT DEFAULT 'available',
  amenities TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  updated_at TEXT,
  deleted_at TEXT
);

-- guests
CREATE TABLE IF NOT EXISTS hotel_guests (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  id_proof_type TEXT DEFAULT '',
  id_proof_no TEXT DEFAULT '',
  address TEXT DEFAULT '',
  city TEXT DEFAULT '',
  nationality TEXT DEFAULT 'Indian',
  total_stays INTEGER DEFAULT 0,
  updated_at TEXT,
  deleted_at TEXT
);

-- bookings
CREATE TABLE IF NOT EXISTS hotel_bookings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  guest_id TEXT NOT NULL,
  check_in TEXT NOT NULL,
  check_out TEXT NOT NULL,
  actual_check_in TEXT,
  actual_check_out TEXT,
  adults INTEGER DEFAULT 1,
  children INTEGER DEFAULT 0,
  status TEXT DEFAULT 'confirmed',
  source TEXT DEFAULT 'direct',
  advance_paid REAL DEFAULT 0,
  special_requests TEXT DEFAULT '',
  booking_ref TEXT DEFAULT '',
  updated_at TEXT,
  deleted_at TEXT
);

-- folios (bill per booking)
CREATE TABLE IF NOT EXISTS hotel_folios (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  booking_id TEXT NOT NULL,
  total_amount REAL DEFAULT 0,
  paid_amount REAL DEFAULT 0,
  payment_mode TEXT DEFAULT 'cash',
  status TEXT DEFAULT 'open',
  notes TEXT DEFAULT '',
  updated_at TEXT,
  deleted_at TEXT
);

-- folio line items
CREATE TABLE IF NOT EXISTS hotel_folio_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  folio_id TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT DEFAULT 'room',
  quantity REAL DEFAULT 1,
  rate REAL DEFAULT 0,
  amount REAL DEFAULT 0,
  updated_at TEXT,
  deleted_at TEXT
);

-- housekeeping tasks
CREATE TABLE IF NOT EXISTS hotel_housekeeping (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  assigned_to TEXT DEFAULT '',
  status TEXT DEFAULT 'dirty',
  date TEXT NOT NULL,
  notes TEXT DEFAULT '',
  updated_at TEXT,
  deleted_at TEXT
);

-- maintenance log
CREATE TABLE IF NOT EXISTS hotel_maintenance (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  issue TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  priority TEXT DEFAULT 'normal',
  reported_by TEXT DEFAULT '',
  resolved_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);

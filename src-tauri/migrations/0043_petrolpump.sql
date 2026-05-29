-- [petrolpump] [all tenants]
CREATE TABLE IF NOT EXISTS pp_shifts (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  shift_no TEXT DEFAULT '', shift_date TEXT NOT NULL,
  shift_type TEXT DEFAULT 'day', staff_name TEXT DEFAULT '',
  opening_reading REAL DEFAULT 0, closing_reading REAL DEFAULT 0,
  petrol_sold REAL DEFAULT 0, diesel_sold REAL DEFAULT 0,
  cash_collected REAL DEFAULT 0, card_collected REAL DEFAULT 0,
  upi_collected REAL DEFAULT 0, credit_sales REAL DEFAULT 0,
  status TEXT DEFAULT 'open', notes TEXT DEFAULT '',
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS pp_fuel_rates (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  fuel_type TEXT NOT NULL, rate REAL DEFAULT 0,
  effective_from TEXT NOT NULL, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS pp_credit_accounts (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  customer_name TEXT NOT NULL, vehicle_no TEXT DEFAULT '',
  phone TEXT DEFAULT '', balance REAL DEFAULT 0,
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS pp_credit_transactions (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  account_id TEXT NOT NULL, fuel_type TEXT DEFAULT '',
  litres REAL DEFAULT 0, amount REAL DEFAULT 0,
  type TEXT DEFAULT 'debit', date TEXT NOT NULL,
  updated_at TEXT, deleted_at TEXT
);

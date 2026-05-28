-- [gym] [all tenants] — gym and fitness center schema

CREATE TABLE IF NOT EXISTS gym_plans (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  duration_days INTEGER NOT NULL DEFAULT 30,
  price REAL NOT NULL DEFAULT 0,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_gym_plans_tenant ON gym_plans(tenant_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS gym_members (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  dob TEXT,
  gender TEXT,
  goal TEXT,
  blood_group TEXT,
  emergency_contact TEXT,
  emergency_phone TEXT,
  plan_id TEXT,
  plan_name TEXT,
  membership_start TEXT,
  membership_end TEXT,
  amount_paid REAL NOT NULL DEFAULT 0,
  balance_due REAL NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_gym_members_tenant ON gym_members(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_gym_members_end ON gym_members(tenant_id, membership_end) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS gym_checkins (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  member_name TEXT NOT NULL,
  checked_in_at TEXT DEFAULT (datetime('now')),
  checked_out_at TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_gym_checkins_member ON gym_checkins(tenant_id, member_id);
CREATE INDEX IF NOT EXISTS idx_gym_checkins_date ON gym_checkins(tenant_id, checked_in_at);

CREATE TABLE IF NOT EXISTS gym_renewals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  member_name TEXT NOT NULL,
  plan_id TEXT,
  plan_name TEXT NOT NULL,
  duration_days INTEGER NOT NULL DEFAULT 30,
  amount REAL NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  renewed_at TEXT DEFAULT (datetime('now')),
  valid_from TEXT NOT NULL,
  valid_until TEXT NOT NULL,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_gym_renewals_member ON gym_renewals(tenant_id, member_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS gym_pt_packages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  member_name TEXT NOT NULL,
  trainer_id TEXT,
  trainer_name TEXT,
  sessions_total INTEGER NOT NULL DEFAULT 12,
  sessions_done INTEGER NOT NULL DEFAULT 0,
  price REAL NOT NULL DEFAULT 0,
  valid_until TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS gym_staff (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'trainer',
  salary REAL NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  joined_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_gym_staff_tenant ON gym_staff(tenant_id) WHERE deleted_at IS NULL;

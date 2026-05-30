-- [carwash] [all tenants] — custom vehicle types with emoji icons and pricing multiplier

CREATE TABLE IF NOT EXISTS carwash_vehicle_types (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🚗',
  -- price_multiplier relative to sedan (1.0 = same as sedan price)
  price_multiplier REAL NOT NULL DEFAULT 1.0,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_carwash_vtype_tenant ON carwash_vehicle_types(tenant_id) WHERE deleted_at IS NULL;

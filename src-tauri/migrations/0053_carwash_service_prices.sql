-- [carwash] [all tenants] — per-vehicle-type manual pricing for services
CREATE TABLE IF NOT EXISTS carwash_service_prices (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  vehicle_type_id TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  UNIQUE(tenant_id, service_id, vehicle_type_id)
);
CREATE INDEX IF NOT EXISTS idx_cw_svcprice ON carwash_service_prices(tenant_id, service_id) WHERE deleted_at IS NULL;

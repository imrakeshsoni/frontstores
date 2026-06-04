-- [carwash] [all tenants] — performance + data integrity indexes

-- Speed up membership lookup by reg number (called on every job card open)
CREATE INDEX IF NOT EXISTS idx_cw_membership_reg ON carwash_memberships(tenant_id, reg_number) WHERE deleted_at IS NULL;

-- Speed up loyalty lookup by phone
CREATE INDEX IF NOT EXISTS idx_cw_loyalty_phone ON carwash_loyalty(tenant_id, customer_phone) WHERE deleted_at IS NULL;

-- Speed up job lookup by customer phone (customer history)
CREATE INDEX IF NOT EXISTS idx_cw_jobs_phone ON carwash_jobs(tenant_id, customer_phone) WHERE deleted_at IS NULL;

-- Speed up job items per tenant
CREATE INDEX IF NOT EXISTS idx_cw_job_items_tenant ON carwash_job_items(tenant_id, job_id);

-- Speed up appointments by date
CREATE INDEX IF NOT EXISTS idx_cw_appts_date ON carwash_appointments(tenant_id, appointment_date) WHERE deleted_at IS NULL;

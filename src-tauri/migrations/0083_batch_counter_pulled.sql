-- [medical] [all tenants] — mark a near-expiry batch as pulled to the front counter to sell first
ALTER TABLE inventory_batches ADD COLUMN counter_pulled_at TEXT;

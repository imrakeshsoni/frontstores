-- [medical] [all tenants] — mark expired batches as "seen" (put in the return box)
ALTER TABLE inventory_batches ADD COLUMN return_seen_at TEXT;

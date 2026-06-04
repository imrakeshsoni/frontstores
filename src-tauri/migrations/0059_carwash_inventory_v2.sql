-- [carwash] [all tenants] — extend inventory with product catalog fields
ALTER TABLE carwash_inventory ADD COLUMN sku TEXT;
ALTER TABLE carwash_inventory ADD COLUMN brand TEXT;
ALTER TABLE carwash_inventory ADD COLUMN selling_price REAL DEFAULT 0;
ALTER TABLE carwash_inventory ADD COLUMN gst_rate REAL DEFAULT 18;

-- [medical] [all tenants]
-- sale_date = the immutable, system-recorded date/time the goods were actually sold.
-- It is set once at billing and is NEVER editable, so it stands as the tamper-evident
-- record for drug-control / GST audits. order_date stays as the (editable) invoice date
-- the shopkeeper can adjust for their own bookkeeping needs.
ALTER TABLE orders ADD COLUMN sale_date TEXT;

-- Backfill existing orders with their true insert time as the best available proxy.
UPDATE orders SET sale_date = created_at WHERE sale_date IS NULL;

-- HSN/SAC code per line so a compliant GST tax invoice can print it. Captured from the
-- product (products.hsn_code already exists) at the time of sale.
ALTER TABLE order_items ADD COLUMN hsn_code TEXT;

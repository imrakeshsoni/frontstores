-- [medical] [all tenants] — Add challan_number to inventory_adjustments
ALTER TABLE inventory_adjustments ADD COLUMN challan_number TEXT;

-- Track the billing period (YYYY-MM) so the counter resets each month.
-- Also changes the default prefix to 'OD' to match the new OD-YYYY-MM-NNNNN format.
ALTER TABLE bill_sequences
  ADD COLUMN IF NOT EXISTS current_period CHAR(7);

-- Seed the period for any existing rows so they don't reset on next order.
UPDATE bill_sequences
SET current_period = TO_CHAR(NOW(), 'YYYY-MM')
WHERE current_period IS NULL;

-- Update prefix for existing rows to the new shorter prefix.
UPDATE bill_sequences SET prefix = 'OD' WHERE prefix = 'ORD';

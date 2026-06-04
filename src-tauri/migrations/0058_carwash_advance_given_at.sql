-- [carwash] [all tenants] — add given_at to track exact date/time of advance payment
ALTER TABLE carwash_salary_advance ADD COLUMN given_at TEXT;

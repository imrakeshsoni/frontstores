-- [core] [all apps] [all tenants]
-- Staff users v2: add display name, role, tab access, join PIN, deactivation.
-- Admin approval removed — users are auto-approved. Server tracks for billing.

ALTER TABLE staff_users ADD COLUMN display_name TEXT NOT NULL DEFAULT '';
ALTER TABLE staff_users ADD COLUMN role TEXT NOT NULL DEFAULT '';
ALTER TABLE staff_users ADD COLUMN tab_access TEXT NOT NULL DEFAULT '[]';
ALTER TABLE staff_users ADD COLUMN join_pin_hash TEXT;
ALTER TABLE staff_users ADD COLUMN pin_salt TEXT;
ALTER TABLE staff_users ADD COLUMN pin_expires_at TEXT;
ALTER TABLE staff_users ADD COLUMN pin_used_at TEXT;
ALTER TABLE staff_users ADD COLUMN deactivated_at TEXT;

-- shop_code: short unique code the owner shares so staff can join on a new device
ALTER TABLE app_config ADD COLUMN shop_code TEXT;

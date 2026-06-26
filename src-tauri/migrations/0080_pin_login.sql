-- [core] [all apps] [all tenants] — optional 8-digit PIN login.
-- Stored on app_auth, which is in SYNC_EXCLUDE_TABLES, so the PIN NEVER leaves
-- this device (never goes to cloud sync). pin_enabled drives the login screen.
ALTER TABLE app_auth ADD COLUMN pin_hash TEXT;
ALTER TABLE app_auth ADD COLUMN pin_salt TEXT;
ALTER TABLE app_auth ADD COLUMN pin_enabled INTEGER NOT NULL DEFAULT 0;

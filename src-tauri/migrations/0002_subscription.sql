-- Migration 0002: subscription tracking
ALTER TABLE app_config ADD COLUMN trial_started_at TEXT;
ALTER TABLE app_config ADD COLUMN subscription_expires_at TEXT;
ALTER TABLE app_config ADD COLUMN subscription_status TEXT NOT NULL DEFAULT 'trial';
ALTER TABLE app_config ADD COLUMN tc_agreed_at TEXT;

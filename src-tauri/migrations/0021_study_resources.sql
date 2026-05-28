-- [study] [all tenants] — student local resources (stays on device, never sent to server)
CREATE TABLE IF NOT EXISTS study_resources (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text',
  subject TEXT,
  content TEXT,
  image_data TEXT,
  file_size INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_study_resources ON study_resources(tenant_id, subject) WHERE deleted_at IS NULL;

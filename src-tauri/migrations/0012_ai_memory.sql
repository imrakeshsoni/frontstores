-- AI voice assistant: per-tenant session conversations and persistent memory
-- [all apps] [all tenants]

CREATE TABLE IF NOT EXISTS ai_conversations (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL,
  session_id TEXT NOT NULL,
  role       TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_session ON ai_conversations(tenant_id, session_id, created_at);

CREATE TABLE IF NOT EXISTS ai_memory (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL,
  key        TEXT NOT NULL,
  value      TEXT NOT NULL,
  confidence INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_memory_tenant_key ON ai_memory(tenant_id, key) WHERE deleted_at IS NULL;

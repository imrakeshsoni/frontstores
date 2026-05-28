-- [study] [all tenants] — StudyMate round-2 features

-- Mindmaps (stored as JSON tree)
CREATE TABLE IF NOT EXISTS study_mindmaps (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  subject TEXT,
  tree_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_study_mindmaps ON study_mindmaps(tenant_id) WHERE deleted_at IS NULL;

-- Previous Year Papers
CREATE TABLE IF NOT EXISTS study_pyq (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  exam_board TEXT,
  year INTEGER NOT NULL,
  paper_name TEXT NOT NULL,
  resource_id TEXT,   -- links to study_resources if PDF uploaded
  total_questions INTEGER NOT NULL DEFAULT 0,
  done_questions INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_study_pyq ON study_pyq(tenant_id, subject) WHERE deleted_at IS NULL;

-- Chapter checklist
CREATE TABLE IF NOT EXISTS study_chapter_checklist (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  chapter_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started', -- not_started | in_progress | revised | done
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_study_checklist ON study_chapter_checklist(tenant_id, subject) WHERE deleted_at IS NULL;

-- XP log (for level system)
CREATE TABLE IF NOT EXISTS study_xp_log (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  action TEXT NOT NULL,   -- session_logged, test_completed, flashcard_reviewed, badge_earned, etc.
  xp INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_study_xp ON study_xp_log(tenant_id, created_at);

-- Streak freeze tokens
CREATE TABLE IF NOT EXISTS study_streak_freeze (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  tokens INTEGER NOT NULL DEFAULT 0,
  total_earned INTEGER NOT NULL DEFAULT 0,
  total_used INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(tenant_id)
);

-- Dashboard widget preferences (which widgets are visible + order)
CREATE TABLE IF NOT EXISTS study_dashboard_prefs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL UNIQUE,
  hidden_widgets TEXT NOT NULL DEFAULT '[]',  -- JSON array of widget keys to hide
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Revision plan (auto-generated schedule)
CREATE TABLE IF NOT EXISTS study_revision_plan (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  exam_id TEXT NOT NULL,
  plan_date TEXT NOT NULL,       -- YYYY-MM-DD
  subject TEXT NOT NULL,
  chapter_or_topic TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | done
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_study_revision ON study_revision_plan(tenant_id, plan_date) WHERE deleted_at IS NULL;

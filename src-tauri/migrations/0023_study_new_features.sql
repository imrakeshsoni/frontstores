-- [study] [all tenants] — StudyMate new features: timetable, exams, assignments, goals, achievements, formula bank, daily challenge, pyq, spaced repetition

-- Weekly timetable slots
CREATE TABLE IF NOT EXISTS study_timetable (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  day_of_week INTEGER NOT NULL, -- 0=Sun, 1=Mon, ..., 6=Sat
  start_time TEXT NOT NULL,     -- "HH:MM"
  end_time TEXT NOT NULL,       -- "HH:MM"
  subject TEXT NOT NULL,
  label TEXT,
  color TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_study_timetable ON study_timetable(tenant_id, day_of_week) WHERE deleted_at IS NULL;

-- Upcoming exams
CREATE TABLE IF NOT EXISTS study_exams (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  exam_name TEXT NOT NULL,
  exam_date TEXT NOT NULL, -- "YYYY-MM-DD"
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_study_exams ON study_exams(tenant_id, exam_date) WHERE deleted_at IS NULL;

-- Assignments / homework
CREATE TABLE IF NOT EXISTS study_assignments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  title TEXT NOT NULL,
  due_date TEXT,           -- "YYYY-MM-DD"
  status TEXT NOT NULL DEFAULT 'pending', -- pending | done
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_study_assignments ON study_assignments(tenant_id, status) WHERE deleted_at IS NULL;

-- Weekly/monthly study goals
CREATE TABLE IF NOT EXISTS study_goals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  subject TEXT,
  target_minutes INTEGER NOT NULL DEFAULT 0,
  period TEXT NOT NULL DEFAULT 'weekly', -- weekly | monthly
  week_start TEXT,  -- "YYYY-MM-DD" of Monday for weekly goals
  month TEXT,       -- "YYYY-MM" for monthly goals
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_study_goals ON study_goals(tenant_id, period) WHERE deleted_at IS NULL;

-- Achievements / badges
CREATE TABLE IF NOT EXISTS study_achievements (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  badge_key TEXT NOT NULL,   -- unique key like "streak_7", "first_test", etc.
  earned_at TEXT DEFAULT (datetime('now')),
  UNIQUE(tenant_id, badge_key)
);
CREATE INDEX IF NOT EXISTS idx_study_achievements ON study_achievements(tenant_id);

-- Formula / definition bank
CREATE TABLE IF NOT EXISTS study_formula_bank (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT,  -- comma-separated
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_study_formula ON study_formula_bank(tenant_id, subject) WHERE deleted_at IS NULL;

-- Daily challenge log
CREATE TABLE IF NOT EXISTS study_daily_challenge (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  challenge_date TEXT NOT NULL, -- "YYYY-MM-DD"
  question TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  user_answer TEXT,
  subject TEXT,
  answered_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(tenant_id, challenge_date)
);
CREATE INDEX IF NOT EXISTS idx_study_daily ON study_daily_challenge(tenant_id, challenge_date);

-- Resource bookmarks (highlight important lines in text notes)
CREATE TABLE IF NOT EXISTS study_bookmarks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  highlighted_text TEXT NOT NULL,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_study_bookmarks ON study_bookmarks(tenant_id, resource_id) WHERE deleted_at IS NULL;

-- Add spaced-repetition columns to study_flashcards
ALTER TABLE study_flashcards ADD COLUMN ease_factor REAL NOT NULL DEFAULT 2.5;
ALTER TABLE study_flashcards ADD COLUMN interval_days INTEGER NOT NULL DEFAULT 1;
ALTER TABLE study_flashcards ADD COLUMN next_review TEXT;

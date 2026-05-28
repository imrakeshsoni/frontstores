-- [study] [all tenants] — StudyMate round-3 features

-- Exam results / mark tracker
CREATE TABLE IF NOT EXISTS study_exam_results (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  test_name TEXT NOT NULL,
  marks_obtained REAL NOT NULL,
  max_marks REAL NOT NULL DEFAULT 100,
  test_date TEXT NOT NULL, -- YYYY-MM-DD
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_study_results ON study_exam_results(tenant_id, subject, test_date) WHERE deleted_at IS NULL;

-- Attendance
CREATE TABLE IF NOT EXISTS study_attendance (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  att_date TEXT NOT NULL, -- YYYY-MM-DD
  status TEXT NOT NULL DEFAULT 'present', -- present | absent | late
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(tenant_id, subject, att_date)
);
CREATE INDEX IF NOT EXISTS idx_study_att ON study_attendance(tenant_id, subject, att_date);

-- Doubt bank
CREATE TABLE IF NOT EXISTS study_doubt_bank (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  question TEXT NOT NULL,
  subject TEXT,
  source TEXT, -- "Page 42, NCERT" etc.
  status TEXT NOT NULL DEFAULT 'unsolved', -- unsolved | solved
  resolution TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_study_doubts ON study_doubt_bank(tenant_id, status) WHERE deleted_at IS NULL;

-- Vocabulary builder
CREATE TABLE IF NOT EXISTS study_vocabulary (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  word TEXT NOT NULL,
  meaning TEXT NOT NULL,
  example TEXT,
  subject TEXT, -- subject context (e.g. English, Science)
  mastered INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_study_vocab ON study_vocabulary(tenant_id) WHERE deleted_at IS NULL;

-- Timed writing practice
CREATE TABLE IF NOT EXISTS study_writing_practice (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  subject TEXT,
  time_taken_seconds INTEGER NOT NULL DEFAULT 0,
  word_count INTEGER NOT NULL DEFAULT 0,
  practice_date TEXT NOT NULL, -- YYYY-MM-DD
  created_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_study_writing ON study_writing_practice(tenant_id, practice_date) WHERE deleted_at IS NULL;

-- Video bookmarks
CREATE TABLE IF NOT EXISTS study_video_bookmarks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  subject TEXT,
  notes TEXT,
  watched INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_study_videos ON study_video_bookmarks(tenant_id, subject) WHERE deleted_at IS NULL;

-- Concept cards (richer flashcards with image support)
CREATE TABLE IF NOT EXISTS study_concept_cards (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  deck_name TEXT NOT NULL DEFAULT 'General',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_data TEXT,
  tags TEXT,
  times_reviewed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_study_concept ON study_concept_cards(tenant_id, subject) WHERE deleted_at IS NULL;

-- Today's focus (resets daily)
CREATE TABLE IF NOT EXISTS study_today_focus (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  focus_date TEXT NOT NULL, -- YYYY-MM-DD
  items TEXT NOT NULL DEFAULT '[]', -- JSON array of {id, text, done}
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(tenant_id, focus_date)
);

-- Exam registration deadlines
CREATE TABLE IF NOT EXISTS study_exam_registrations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  exam_name TEXT NOT NULL,
  registration_deadline TEXT NOT NULL, -- YYYY-MM-DD
  exam_date TEXT,
  fee TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | registered | missed
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_study_reg ON study_exam_registrations(tenant_id, registration_deadline) WHERE deleted_at IS NULL;

-- Sleep log
CREATE TABLE IF NOT EXISTS study_sleep_log (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  sleep_date TEXT NOT NULL, -- YYYY-MM-DD (date of waking up)
  hours_slept REAL NOT NULL,
  quality INTEGER NOT NULL DEFAULT 3, -- 1-5
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(tenant_id, sleep_date)
);
CREATE INDEX IF NOT EXISTS idx_study_sleep ON study_sleep_log(tenant_id, sleep_date);

-- Rich text notes (separate from plain study_resources notes)
CREATE TABLE IF NOT EXISTS study_rich_notes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  subject TEXT,
  content_html TEXT NOT NULL DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_study_rich ON study_rich_notes(tenant_id, subject) WHERE deleted_at IS NULL;

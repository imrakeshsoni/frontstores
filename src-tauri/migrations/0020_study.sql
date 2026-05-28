-- [study] [all tenants] — StudyMate app schema
CREATE TABLE IF NOT EXISTS study_config (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL UNIQUE,
  student_name TEXT,
  class_grade TEXT,
  school TEXT,
  subjects TEXT,
  parent_pin TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS study_conversations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  subject TEXT,
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_study_conv ON study_conversations(tenant_id, created_at) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS study_messages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_study_msgs ON study_messages(conversation_id);

CREATE TABLE IF NOT EXISTS study_mock_tests (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  chapter TEXT,
  total_questions INTEGER NOT NULL DEFAULT 10,
  score INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  completed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS study_mock_questions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  test_id TEXT NOT NULL,
  question_no INTEGER NOT NULL,
  question TEXT NOT NULL,
  option_a TEXT,
  option_b TEXT,
  option_c TEXT,
  option_d TEXT,
  correct_answer TEXT NOT NULL,
  user_answer TEXT,
  explanation TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_study_questions ON study_mock_questions(test_id);

CREATE TABLE IF NOT EXISTS study_flashcard_decks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  subject TEXT,
  card_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS study_flashcards (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  deck_id TEXT NOT NULL,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  times_reviewed INTEGER NOT NULL DEFAULT 0,
  times_correct INTEGER NOT NULL DEFAULT 0,
  last_reviewed TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_study_cards ON study_flashcards(deck_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS study_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  session_date TEXT NOT NULL,
  subject TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_study_sessions ON study_sessions(tenant_id, session_date) WHERE deleted_at IS NULL;

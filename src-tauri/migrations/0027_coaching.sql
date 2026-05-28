-- [coaching] [all tenants] — coaching institute schema

CREATE TABLE IF NOT EXISTS coaching_students (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  parent_phone TEXT,
  email TEXT,
  address TEXT,
  batch_id TEXT,
  course TEXT,
  class_grade TEXT,
  fee_amount REAL NOT NULL DEFAULT 0,
  fee_due_day INTEGER NOT NULL DEFAULT 1,
  balance_due REAL NOT NULL DEFAULT 0,
  joined_at TEXT DEFAULT (datetime('now')),
  is_active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_coaching_students_tenant ON coaching_students(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_coaching_students_batch ON coaching_students(batch_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS coaching_batches (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  subject TEXT,
  teacher_id TEXT,
  teacher_name TEXT,
  days TEXT,
  start_time TEXT,
  end_time TEXT,
  room TEXT,
  capacity INTEGER NOT NULL DEFAULT 30,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_coaching_batches_tenant ON coaching_batches(tenant_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS coaching_attendance (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'present',
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_coaching_att_unique ON coaching_attendance(tenant_id, batch_id, student_id, date);
CREATE INDEX IF NOT EXISTS idx_coaching_att_date ON coaching_attendance(tenant_id, date);

CREATE TABLE IF NOT EXISTS coaching_fees (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  batch_id TEXT,
  batch_name TEXT,
  amount REAL NOT NULL DEFAULT 0,
  month TEXT NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  notes TEXT,
  collected_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_coaching_fees_student ON coaching_fees(tenant_id, student_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_coaching_fees_month ON coaching_fees(tenant_id, month) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS coaching_exams (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  batch_id TEXT,
  batch_name TEXT,
  title TEXT NOT NULL,
  subject TEXT,
  exam_date TEXT,
  total_marks INTEGER NOT NULL DEFAULT 100,
  passing_marks INTEGER NOT NULL DEFAULT 35,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS coaching_exam_results (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  exam_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  marks_obtained REAL,
  grade TEXT,
  remarks TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_coaching_result_unique ON coaching_exam_results(exam_id, student_id);

CREATE TABLE IF NOT EXISTS coaching_teachers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  subjects TEXT,
  salary REAL NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  joined_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_coaching_teachers_tenant ON coaching_teachers(tenant_id) WHERE deleted_at IS NULL;

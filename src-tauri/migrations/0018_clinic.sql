-- [clinic] [all tenants] — hospital & doctor clinic management

CREATE TABLE IF NOT EXISTS clinic_doctors (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  specialization TEXT,
  qualification TEXT,
  registration_no TEXT,
  phone TEXT,
  consultation_fee REAL NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS clinic_patients (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  patient_no TEXT NOT NULL,
  name TEXT NOT NULL,
  age INTEGER,
  age_unit TEXT NOT NULL DEFAULT 'years',
  gender TEXT,
  blood_group TEXT,
  phone TEXT,
  address TEXT,
  allergies TEXT,
  medical_history TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_clinic_patients_phone ON clinic_patients(tenant_id, phone) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS clinic_appointments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  patient_name TEXT,
  patient_phone TEXT,
  doctor_id TEXT,
  doctor_name TEXT,
  appointment_date TEXT NOT NULL,
  appointment_time TEXT,
  type TEXT NOT NULL DEFAULT 'consultation',
  status TEXT NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS clinic_tokens (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  date TEXT NOT NULL,
  token_no INTEGER NOT NULL,
  patient_id TEXT,
  patient_name TEXT,
  doctor_id TEXT,
  doctor_name TEXT,
  status TEXT NOT NULL DEFAULT 'waiting',
  visit_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clinic_visits (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  patient_name TEXT,
  doctor_id TEXT,
  doctor_name TEXT,
  token_id TEXT,
  visit_date TEXT NOT NULL,
  chief_complaint TEXT,
  diagnosis TEXT,
  notes TEXT,
  follow_up_date TEXT,
  follow_up_notes TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS clinic_vitals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  visit_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  bp_systolic INTEGER,
  bp_diastolic INTEGER,
  pulse INTEGER,
  temperature REAL,
  spo2 INTEGER,
  weight REAL,
  height REAL,
  blood_sugar REAL,
  recorded_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clinic_prescriptions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  visit_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  doctor_id TEXT,
  notes TEXT,
  prescribed_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS clinic_prescription_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  prescription_id TEXT NOT NULL,
  medicine_name TEXT NOT NULL,
  dosage TEXT,
  frequency TEXT,
  duration TEXT,
  instructions TEXT,
  quantity INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS clinic_lab_orders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  visit_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  test_name TEXT NOT NULL,
  test_category TEXT,
  status TEXT NOT NULL DEFAULT 'ordered',
  result_value TEXT,
  result_unit TEXT,
  reference_range TEXT,
  is_abnormal INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  ordered_at TEXT DEFAULT (datetime('now')),
  resulted_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS clinic_medicines (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  generic_name TEXT,
  form TEXT,
  strength TEXT,
  unit TEXT NOT NULL DEFAULT 'tablet',
  stock_qty REAL NOT NULL DEFAULT 0,
  min_stock_qty REAL NOT NULL DEFAULT 10,
  selling_price REAL NOT NULL DEFAULT 0,
  cost_price REAL,
  gst_rate REAL NOT NULL DEFAULT 12,
  expiry_date TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS clinic_beds (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  ward TEXT NOT NULL,
  room_no TEXT,
  bed_no TEXT NOT NULL,
  bed_type TEXT NOT NULL DEFAULT 'general',
  charges_per_day REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'available',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS clinic_admissions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  patient_name TEXT,
  bed_id TEXT,
  bed_no TEXT,
  ward TEXT,
  doctor_id TEXT,
  doctor_name TEXT,
  admission_date TEXT NOT NULL,
  discharge_date TEXT,
  diagnosis TEXT,
  status TEXT NOT NULL DEFAULT 'admitted',
  room_charges REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS clinic_bills (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  bill_number TEXT NOT NULL,
  patient_id TEXT,
  patient_name TEXT,
  patient_phone TEXT,
  doctor_id TEXT,
  doctor_name TEXT,
  visit_id TEXT,
  admission_id TEXT,
  bill_type TEXT NOT NULL DEFAULT 'consultation',
  payment_method TEXT NOT NULL DEFAULT 'cash',
  payment_status TEXT NOT NULL DEFAULT 'paid',
  subtotal REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  gst_amount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS clinic_bill_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  bill_id TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  gst_rate REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

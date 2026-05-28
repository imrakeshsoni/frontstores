-- [realestate] [all tenants]

CREATE TABLE IF NOT EXISTS re_leads (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  lead_type TEXT DEFAULT 'buyer',
  property_type TEXT DEFAULT 'residential',
  budget_min REAL,
  budget_max REAL,
  bhk TEXT,
  preferred_area TEXT,
  source TEXT DEFAULT 'manual',
  stage TEXT DEFAULT 'new',
  lost_reason TEXT,
  assigned_to TEXT,
  co_broker TEXT,
  notes TEXT,
  follow_up_date TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS re_properties (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  property_type TEXT DEFAULT 'residential',
  transaction_type TEXT DEFAULT 'sale',
  bhk TEXT,
  area_sqft REAL,
  floor_no TEXT,
  total_floors TEXT,
  facing TEXT,
  price REAL,
  price_per_sqft REAL,
  rent_per_month REAL,
  deposit_amount REAL,
  locality TEXT,
  city TEXT,
  landmark TEXT,
  possession_date TEXT,
  age_years REAL,
  furnishing TEXT DEFAULT 'unfurnished',
  parking TEXT,
  amenities TEXT,
  status TEXT DEFAULT 'available',
  seller_name TEXT,
  seller_phone TEXT,
  seller_commission_pct REAL DEFAULT 2,
  buyer_commission_pct REAL DEFAULT 2,
  rera_no TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS re_builders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  rera_no TEXT,
  commission_pct REAL DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS re_projects (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  builder_id TEXT,
  name TEXT NOT NULL,
  location TEXT,
  project_type TEXT DEFAULT 'residential',
  bhk_options TEXT,
  price_range_min REAL,
  price_range_max REAL,
  commission_pct REAL DEFAULT 0,
  total_units INTEGER,
  available_units INTEGER,
  rera_no TEXT,
  possession_date TEXT,
  amenities TEXT,
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS re_deals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  lead_id TEXT,
  property_id TEXT,
  project_id TEXT,
  deal_type TEXT DEFAULT 'resale',
  status TEXT DEFAULT 'in_progress',
  deal_value REAL,
  commission_pct REAL DEFAULT 2,
  commission_amount REAL,
  co_broker TEXT,
  co_broker_split_pct REAL DEFAULT 0,
  token_amount REAL,
  token_date TEXT,
  agreement_date TEXT,
  registration_date TEXT,
  possession_date TEXT,
  notes TEXT,
  closed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS re_site_visits (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  property_id TEXT,
  project_id TEXT,
  scheduled_at TEXT NOT NULL,
  status TEXT DEFAULT 'scheduled',
  feedback TEXT,
  interest_level TEXT,
  next_action TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS re_commissions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  deal_id TEXT,
  description TEXT,
  amount REAL NOT NULL,
  gst_amount REAL DEFAULT 0,
  total_amount REAL NOT NULL,
  status TEXT DEFAULT 'pending',
  received_amount REAL DEFAULT 0,
  received_date TEXT,
  tds_amount REAL DEFAULT 0,
  payment_mode TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS re_documents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  deal_id TEXT NOT NULL,
  doc_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS re_follow_ups (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  lead_id TEXT,
  deal_id TEXT,
  due_date TEXT NOT NULL,
  mode TEXT DEFAULT 'call',
  notes TEXT,
  done INTEGER DEFAULT 0,
  done_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT,
  deleted_at TEXT
);

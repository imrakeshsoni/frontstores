// [realestate] [all tenants]
import { getDb, uuid, now } from './index';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RELead {
  id: string;
  tenant_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  lead_type: 'buyer' | 'seller' | 'tenant' | 'landlord';
  property_type: string;
  budget_min: number | null;
  budget_max: number | null;
  bhk: string | null;
  preferred_area: string | null;
  source: string;
  stage: 'new' | 'contacted' | 'site_visit' | 'negotiation' | 'closed' | 'lost';
  lost_reason: string | null;
  assigned_to: string | null;
  co_broker: string | null;
  notes: string | null;
  follow_up_date: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface REProperty {
  id: string;
  tenant_id: string;
  title: string;
  property_type: string;
  transaction_type: 'sale' | 'rent' | 'lease';
  bhk: string | null;
  area_sqft: number | null;
  floor_no: string | null;
  total_floors: string | null;
  facing: string | null;
  price: number | null;
  price_per_sqft: number | null;
  rent_per_month: number | null;
  deposit_amount: number | null;
  locality: string | null;
  city: string | null;
  landmark: string | null;
  possession_date: string | null;
  age_years: number | null;
  furnishing: 'unfurnished' | 'semi' | 'fully';
  parking: string | null;
  amenities: string | null;
  status: 'available' | 'under_offer' | 'sold' | 'rented';
  seller_name: string | null;
  seller_phone: string | null;
  seller_commission_pct: number;
  buyer_commission_pct: number;
  rera_no: string | null;
  notes: string | null;
  created_at: string;
}

export interface REBuilder {
  id: string;
  tenant_id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  rera_no: string | null;
  commission_pct: number;
  notes: string | null;
  created_at: string;
}

export interface REProject {
  id: string;
  tenant_id: string;
  builder_id: string | null;
  name: string;
  location: string | null;
  project_type: string;
  bhk_options: string | null;
  price_range_min: number | null;
  price_range_max: number | null;
  commission_pct: number;
  total_units: number | null;
  available_units: number | null;
  rera_no: string | null;
  possession_date: string | null;
  amenities: string | null;
  status: 'active' | 'completed' | 'on_hold';
  notes: string | null;
  created_at: string;
}

export interface REDeal {
  id: string;
  tenant_id: string;
  lead_id: string | null;
  property_id: string | null;
  project_id: string | null;
  deal_type: 'resale' | 'new' | 'rental' | 'commercial';
  status: 'in_progress' | 'closed' | 'lost' | 'cancelled';
  deal_value: number | null;
  commission_pct: number;
  commission_amount: number | null;
  co_broker: string | null;
  co_broker_split_pct: number;
  token_amount: number | null;
  token_date: string | null;
  agreement_date: string | null;
  registration_date: string | null;
  possession_date: string | null;
  notes: string | null;
  closed_at: string | null;
  created_at: string;
}

export interface RESiteVisit {
  id: string;
  tenant_id: string;
  lead_id: string;
  property_id: string | null;
  project_id: string | null;
  scheduled_at: string;
  status: 'scheduled' | 'completed' | 'no_show' | 'cancelled';
  feedback: string | null;
  interest_level: 'high' | 'medium' | 'low' | null;
  next_action: string | null;
  notes: string | null;
  created_at: string;
}

export interface RECommission {
  id: string;
  tenant_id: string;
  deal_id: string | null;
  description: string | null;
  amount: number;
  gst_amount: number;
  total_amount: number;
  status: 'pending' | 'partial' | 'received';
  received_amount: number;
  received_date: string | null;
  tds_amount: number;
  payment_mode: string | null;
  notes: string | null;
  created_at: string;
}

export interface REDocument {
  id: string;
  tenant_id: string;
  deal_id: string;
  doc_name: string;
  status: 'pending' | 'collected' | 'verified' | 'missing';
  notes: string | null;
  created_at: string;
}

export interface REFollowUp {
  id: string;
  tenant_id: string;
  lead_id: string | null;
  deal_id: string | null;
  due_date: string;
  mode: 'call' | 'whatsapp' | 'site_visit' | 'email' | 'meeting';
  notes: string | null;
  done: boolean;
  done_at: string | null;
  created_at: string;
}

export interface REStats {
  totalLeads: number;
  newLeads: number;
  activeDeals: number;
  closedDealsThisMonth: number;
  commissionThisMonth: number;
  commissionPending: number;
  siteVisitsToday: number;
  followUpsDueToday: number;
  pipelineValue: number;
}

// ── Leads ─────────────────────────────────────────────────────────────────────

export async function listLeads(tenantId: string): Promise<RELead[]> {
  const db = await getDb();
  return db.select<RELead[]>(
    `SELECT * FROM re_leads WHERE tenant_id=? AND deleted_at IS NULL ORDER BY created_at DESC`,
    [tenantId]
  );
}

export async function saveLead(tenantId: string, data: Partial<RELead> & { name: string }): Promise<void> {
  const db = await getDb();
  if (data.id) {
    await db.execute(
      `UPDATE re_leads SET name=?,phone=?,email=?,lead_type=?,property_type=?,budget_min=?,budget_max=?,bhk=?,preferred_area=?,source=?,stage=?,lost_reason=?,assigned_to=?,co_broker=?,notes=?,follow_up_date=?,updated_at=? WHERE id=? AND tenant_id=?`,
      [data.name,data.phone??null,data.email??null,data.lead_type??'buyer',data.property_type??'residential',data.budget_min??null,data.budget_max??null,data.bhk??null,data.preferred_area??null,data.source??'manual',data.stage??'new',data.lost_reason??null,data.assigned_to??null,data.co_broker??null,data.notes??null,data.follow_up_date??null,now(),data.id,tenantId]
    );
  } else {
    await db.execute(
      `INSERT INTO re_leads (id,tenant_id,name,phone,email,lead_type,property_type,budget_min,budget_max,bhk,preferred_area,source,stage,lost_reason,assigned_to,co_broker,notes,follow_up_date) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [uuid(),tenantId,data.name,data.phone??null,data.email??null,data.lead_type??'buyer',data.property_type??'residential',data.budget_min??null,data.budget_max??null,data.bhk??null,data.preferred_area??null,data.source??'manual',data.stage??'new',data.lost_reason??null,data.assigned_to??null,data.co_broker??null,data.notes??null,data.follow_up_date??null]
    );
  }
}

export async function deleteLead(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE re_leads SET deleted_at=?,updated_at=? WHERE id=? AND tenant_id=?`, [now(),now(),id,tenantId]);
}

// ── Properties ────────────────────────────────────────────────────────────────

export async function listProperties(tenantId: string): Promise<REProperty[]> {
  const db = await getDb();
  return db.select<REProperty[]>(
    `SELECT * FROM re_properties WHERE tenant_id=? AND deleted_at IS NULL ORDER BY created_at DESC`,
    [tenantId]
  );
}

export async function saveProperty(tenantId: string, data: Partial<REProperty> & { title: string }): Promise<void> {
  const db = await getDb();
  if (data.id) {
    await db.execute(
      `UPDATE re_properties SET title=?,property_type=?,transaction_type=?,bhk=?,area_sqft=?,floor_no=?,total_floors=?,facing=?,price=?,price_per_sqft=?,rent_per_month=?,deposit_amount=?,locality=?,city=?,landmark=?,possession_date=?,age_years=?,furnishing=?,parking=?,amenities=?,status=?,seller_name=?,seller_phone=?,seller_commission_pct=?,buyer_commission_pct=?,rera_no=?,notes=?,updated_at=? WHERE id=? AND tenant_id=?`,
      [data.title,data.property_type??'residential',data.transaction_type??'sale',data.bhk??null,data.area_sqft??null,data.floor_no??null,data.total_floors??null,data.facing??null,data.price??null,data.price_per_sqft??null,data.rent_per_month??null,data.deposit_amount??null,data.locality??null,data.city??null,data.landmark??null,data.possession_date??null,data.age_years??null,data.furnishing??'unfurnished',data.parking??null,data.amenities??null,data.status??'available',data.seller_name??null,data.seller_phone??null,data.seller_commission_pct??2,data.buyer_commission_pct??2,data.rera_no??null,data.notes??null,now(),data.id,tenantId]
    );
  } else {
    await db.execute(
      `INSERT INTO re_properties (id,tenant_id,title,property_type,transaction_type,bhk,area_sqft,floor_no,total_floors,facing,price,price_per_sqft,rent_per_month,deposit_amount,locality,city,landmark,possession_date,age_years,furnishing,parking,amenities,status,seller_name,seller_phone,seller_commission_pct,buyer_commission_pct,rera_no,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [uuid(),tenantId,data.title,data.property_type??'residential',data.transaction_type??'sale',data.bhk??null,data.area_sqft??null,data.floor_no??null,data.total_floors??null,data.facing??null,data.price??null,data.price_per_sqft??null,data.rent_per_month??null,data.deposit_amount??null,data.locality??null,data.city??null,data.landmark??null,data.possession_date??null,data.age_years??null,data.furnishing??'unfurnished',data.parking??null,data.amenities??null,data.status??'available',data.seller_name??null,data.seller_phone??null,data.seller_commission_pct??2,data.buyer_commission_pct??2,data.rera_no??null,data.notes??null]
    );
  }
}

export async function deleteProperty(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE re_properties SET deleted_at=?,updated_at=? WHERE id=? AND tenant_id=?`, [now(),now(),id,tenantId]);
}

// ── Builders ──────────────────────────────────────────────────────────────────

export async function listBuilders(tenantId: string): Promise<REBuilder[]> {
  const db = await getDb();
  return db.select<REBuilder[]>(
    `SELECT * FROM re_builders WHERE tenant_id=? AND deleted_at IS NULL ORDER BY name ASC`,
    [tenantId]
  );
}

export async function saveBuilder(tenantId: string, data: Partial<REBuilder> & { name: string }): Promise<void> {
  const db = await getDb();
  if (data.id) {
    await db.execute(
      `UPDATE re_builders SET name=?,contact_person=?,phone=?,email=?,address=?,rera_no=?,commission_pct=?,notes=?,updated_at=? WHERE id=? AND tenant_id=?`,
      [data.name,data.contact_person??null,data.phone??null,data.email??null,data.address??null,data.rera_no??null,data.commission_pct??0,data.notes??null,now(),data.id,tenantId]
    );
  } else {
    await db.execute(
      `INSERT INTO re_builders (id,tenant_id,name,contact_person,phone,email,address,rera_no,commission_pct,notes) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [uuid(),tenantId,data.name,data.contact_person??null,data.phone??null,data.email??null,data.address??null,data.rera_no??null,data.commission_pct??0,data.notes??null]
    );
  }
}

export async function deleteBuilder(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE re_builders SET deleted_at=?,updated_at=? WHERE id=? AND tenant_id=?`, [now(),now(),id,tenantId]);
}

// ── Projects ──────────────────────────────────────────────────────────────────

export async function listProjects(tenantId: string): Promise<REProject[]> {
  const db = await getDb();
  return db.select<REProject[]>(
    `SELECT * FROM re_projects WHERE tenant_id=? AND deleted_at IS NULL ORDER BY created_at DESC`,
    [tenantId]
  );
}

export async function saveProject(tenantId: string, data: Partial<REProject> & { name: string }): Promise<void> {
  const db = await getDb();
  if (data.id) {
    await db.execute(
      `UPDATE re_projects SET builder_id=?,name=?,location=?,project_type=?,bhk_options=?,price_range_min=?,price_range_max=?,commission_pct=?,total_units=?,available_units=?,rera_no=?,possession_date=?,amenities=?,status=?,notes=?,updated_at=? WHERE id=? AND tenant_id=?`,
      [data.builder_id??null,data.name,data.location??null,data.project_type??'residential',data.bhk_options??null,data.price_range_min??null,data.price_range_max??null,data.commission_pct??0,data.total_units??null,data.available_units??null,data.rera_no??null,data.possession_date??null,data.amenities??null,data.status??'active',data.notes??null,now(),data.id,tenantId]
    );
  } else {
    await db.execute(
      `INSERT INTO re_projects (id,tenant_id,builder_id,name,location,project_type,bhk_options,price_range_min,price_range_max,commission_pct,total_units,available_units,rera_no,possession_date,amenities,status,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [uuid(),tenantId,data.builder_id??null,data.name,data.location??null,data.project_type??'residential',data.bhk_options??null,data.price_range_min??null,data.price_range_max??null,data.commission_pct??0,data.total_units??null,data.available_units??null,data.rera_no??null,data.possession_date??null,data.amenities??null,data.status??'active',data.notes??null]
    );
  }
}

export async function deleteProject(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE re_projects SET deleted_at=?,updated_at=? WHERE id=? AND tenant_id=?`, [now(),now(),id,tenantId]);
}

// ── Deals ─────────────────────────────────────────────────────────────────────

export async function listDeals(tenantId: string): Promise<REDeal[]> {
  const db = await getDb();
  return db.select<REDeal[]>(
    `SELECT * FROM re_deals WHERE tenant_id=? AND deleted_at IS NULL ORDER BY created_at DESC`,
    [tenantId]
  );
}

export async function saveDeal(tenantId: string, data: Partial<REDeal>): Promise<void> {
  const db = await getDb();
  if (data.id) {
    await db.execute(
      `UPDATE re_deals SET lead_id=?,property_id=?,project_id=?,deal_type=?,status=?,deal_value=?,commission_pct=?,commission_amount=?,co_broker=?,co_broker_split_pct=?,token_amount=?,token_date=?,agreement_date=?,registration_date=?,possession_date=?,notes=?,closed_at=?,updated_at=? WHERE id=? AND tenant_id=?`,
      [data.lead_id??null,data.property_id??null,data.project_id??null,data.deal_type??'resale',data.status??'in_progress',data.deal_value??null,data.commission_pct??2,data.commission_amount??null,data.co_broker??null,data.co_broker_split_pct??0,data.token_amount??null,data.token_date??null,data.agreement_date??null,data.registration_date??null,data.possession_date??null,data.notes??null,data.closed_at??null,now(),data.id,tenantId]
    );
  } else {
    await db.execute(
      `INSERT INTO re_deals (id,tenant_id,lead_id,property_id,project_id,deal_type,status,deal_value,commission_pct,commission_amount,co_broker,co_broker_split_pct,token_amount,token_date,agreement_date,registration_date,possession_date,notes,closed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [uuid(),tenantId,data.lead_id??null,data.property_id??null,data.project_id??null,data.deal_type??'resale',data.status??'in_progress',data.deal_value??null,data.commission_pct??2,data.commission_amount??null,data.co_broker??null,data.co_broker_split_pct??0,data.token_amount??null,data.token_date??null,data.agreement_date??null,data.registration_date??null,data.possession_date??null,data.notes??null,data.closed_at??null]
    );
  }
}

export async function deleteDeal(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE re_deals SET deleted_at=?,updated_at=? WHERE id=? AND tenant_id=?`, [now(),now(),id,tenantId]);
}

// ── Site Visits ───────────────────────────────────────────────────────────────

export async function listSiteVisits(tenantId: string): Promise<RESiteVisit[]> {
  const db = await getDb();
  return db.select<RESiteVisit[]>(
    `SELECT * FROM re_site_visits WHERE tenant_id=? AND deleted_at IS NULL ORDER BY scheduled_at DESC`,
    [tenantId]
  );
}

export async function saveSiteVisit(tenantId: string, data: Partial<RESiteVisit> & { lead_id: string; scheduled_at: string }): Promise<void> {
  const db = await getDb();
  if (data.id) {
    await db.execute(
      `UPDATE re_site_visits SET lead_id=?,property_id=?,project_id=?,scheduled_at=?,status=?,feedback=?,interest_level=?,next_action=?,notes=?,updated_at=? WHERE id=? AND tenant_id=?`,
      [data.lead_id,data.property_id??null,data.project_id??null,data.scheduled_at,data.status??'scheduled',data.feedback??null,data.interest_level??null,data.next_action??null,data.notes??null,now(),data.id,tenantId]
    );
  } else {
    await db.execute(
      `INSERT INTO re_site_visits (id,tenant_id,lead_id,property_id,project_id,scheduled_at,status,feedback,interest_level,next_action,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [uuid(),tenantId,data.lead_id,data.property_id??null,data.project_id??null,data.scheduled_at,data.status??'scheduled',data.feedback??null,data.interest_level??null,data.next_action??null,data.notes??null]
    );
  }
}

export async function deleteSiteVisit(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE re_site_visits SET deleted_at=?,updated_at=? WHERE id=? AND tenant_id=?`, [now(),now(),id,tenantId]);
}

// ── Commissions ───────────────────────────────────────────────────────────────

export async function listCommissions(tenantId: string): Promise<RECommission[]> {
  const db = await getDb();
  return db.select<RECommission[]>(
    `SELECT * FROM re_commissions WHERE tenant_id=? AND deleted_at IS NULL ORDER BY created_at DESC`,
    [tenantId]
  );
}

export async function saveCommission(tenantId: string, data: Partial<RECommission> & { amount: number; total_amount: number }): Promise<void> {
  const db = await getDb();
  if (data.id) {
    await db.execute(
      `UPDATE re_commissions SET deal_id=?,description=?,amount=?,gst_amount=?,total_amount=?,status=?,received_amount=?,received_date=?,tds_amount=?,payment_mode=?,notes=?,updated_at=? WHERE id=? AND tenant_id=?`,
      [data.deal_id??null,data.description??null,data.amount,data.gst_amount??0,data.total_amount,data.status??'pending',data.received_amount??0,data.received_date??null,data.tds_amount??0,data.payment_mode??null,data.notes??null,now(),data.id,tenantId]
    );
  } else {
    await db.execute(
      `INSERT INTO re_commissions (id,tenant_id,deal_id,description,amount,gst_amount,total_amount,status,received_amount,received_date,tds_amount,payment_mode,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [uuid(),tenantId,data.deal_id??null,data.description??null,data.amount,data.gst_amount??0,data.total_amount,data.status??'pending',data.received_amount??0,data.received_date??null,data.tds_amount??0,data.payment_mode??null,data.notes??null]
    );
  }
}

export async function deleteCommission(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE re_commissions SET deleted_at=?,updated_at=? WHERE id=? AND tenant_id=?`, [now(),now(),id,tenantId]);
}

// ── Documents ─────────────────────────────────────────────────────────────────

export async function listDocuments(tenantId: string, dealId: string): Promise<REDocument[]> {
  const db = await getDb();
  return db.select<REDocument[]>(
    `SELECT * FROM re_documents WHERE tenant_id=? AND deal_id=? AND deleted_at IS NULL ORDER BY doc_name ASC`,
    [tenantId, dealId]
  );
}

export async function saveDocument(tenantId: string, data: Partial<REDocument> & { deal_id: string; doc_name: string }): Promise<void> {
  const db = await getDb();
  if (data.id) {
    await db.execute(
      `UPDATE re_documents SET doc_name=?,status=?,notes=?,updated_at=? WHERE id=? AND tenant_id=?`,
      [data.doc_name,data.status??'pending',data.notes??null,now(),data.id,tenantId]
    );
  } else {
    await db.execute(
      `INSERT INTO re_documents (id,tenant_id,deal_id,doc_name,status,notes) VALUES (?,?,?,?,?,?)`,
      [uuid(),tenantId,data.deal_id,data.doc_name,data.status??'pending',data.notes??null]
    );
  }
}

export async function deleteDocument(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE re_documents SET deleted_at=?,updated_at=? WHERE id=? AND tenant_id=?`, [now(),now(),id,tenantId]);
}

// ── Follow-ups ────────────────────────────────────────────────────────────────

export async function listFollowUps(tenantId: string): Promise<REFollowUp[]> {
  const db = await getDb();
  const rows = await db.select<any[]>(
    `SELECT * FROM re_follow_ups WHERE tenant_id=? AND deleted_at IS NULL ORDER BY due_date ASC`,
    [tenantId]
  );
  return rows.map(r => ({ ...r, done: r.done === 1 }));
}

export async function saveFollowUp(tenantId: string, data: Partial<REFollowUp> & { due_date: string }): Promise<void> {
  const db = await getDb();
  if (data.id) {
    await db.execute(
      `UPDATE re_follow_ups SET lead_id=?,deal_id=?,due_date=?,mode=?,notes=?,done=?,done_at=?,updated_at=? WHERE id=? AND tenant_id=?`,
      [data.lead_id??null,data.deal_id??null,data.due_date,data.mode??'call',data.notes??null,data.done?1:0,data.done_at??null,now(),data.id,tenantId]
    );
  } else {
    await db.execute(
      `INSERT INTO re_follow_ups (id,tenant_id,lead_id,deal_id,due_date,mode,notes,done) VALUES (?,?,?,?,?,?,?,0)`,
      [uuid(),tenantId,data.lead_id??null,data.deal_id??null,data.due_date,data.mode??'call',data.notes??null]
    );
  }
}

export async function markFollowUpDone(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE re_follow_ups SET done=1,done_at=?,updated_at=? WHERE id=? AND tenant_id=?`,
    [now(),now(),id,tenantId]
  );
}

export async function deleteFollowUp(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE re_follow_ups SET deleted_at=?,updated_at=? WHERE id=? AND tenant_id=?`, [now(),now(),id,tenantId]);
}

// ── Dashboard Stats ───────────────────────────────────────────────────────────

export async function getREStats(tenantId: string): Promise<REStats> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + '-01';

  const [totalLeads] = await db.select<{c:number}[]>(`SELECT COUNT(*) c FROM re_leads WHERE tenant_id=? AND deleted_at IS NULL`, [tenantId]);
  const [newLeads] = await db.select<{c:number}[]>(`SELECT COUNT(*) c FROM re_leads WHERE tenant_id=? AND deleted_at IS NULL AND stage='new'`, [tenantId]);
  const [activeDeals] = await db.select<{c:number}[]>(`SELECT COUNT(*) c FROM re_deals WHERE tenant_id=? AND deleted_at IS NULL AND status='in_progress'`, [tenantId]);
  const [closedThisMonth] = await db.select<{c:number}[]>(`SELECT COUNT(*) c FROM re_deals WHERE tenant_id=? AND deleted_at IS NULL AND status='closed' AND closed_at>=?`, [tenantId, monthStart]);
  const [commMonthRow] = await db.select<{s:number}[]>(`SELECT COALESCE(SUM(received_amount),0) s FROM re_commissions WHERE tenant_id=? AND deleted_at IS NULL AND received_date>=?`, [tenantId, monthStart]);
  const [commPendingRow] = await db.select<{s:number}[]>(`SELECT COALESCE(SUM(total_amount-received_amount),0) s FROM re_commissions WHERE tenant_id=? AND deleted_at IS NULL AND status!='received'`, [tenantId]);
  const [visitsToday] = await db.select<{c:number}[]>(`SELECT COUNT(*) c FROM re_site_visits WHERE tenant_id=? AND deleted_at IS NULL AND scheduled_at LIKE ?`, [tenantId, today+'%']);
  const [followsToday] = await db.select<{c:number}[]>(`SELECT COUNT(*) c FROM re_follow_ups WHERE tenant_id=? AND deleted_at IS NULL AND done=0 AND due_date<=?`, [tenantId, today]);
  const [pipelineRow] = await db.select<{s:number}[]>(`SELECT COALESCE(SUM(deal_value),0) s FROM re_deals WHERE tenant_id=? AND deleted_at IS NULL AND status='in_progress'`, [tenantId]);

  return {
    totalLeads: totalLeads.c,
    newLeads: newLeads.c,
    activeDeals: activeDeals.c,
    closedDealsThisMonth: closedThisMonth.c,
    commissionThisMonth: commMonthRow.s,
    commissionPending: commPendingRow.s,
    siteVisitsToday: visitsToday.c,
    followUpsDueToday: followsToday.c,
    pipelineValue: pipelineRow.s,
  };
}

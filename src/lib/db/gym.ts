// [gym] [all tenants]
import { getDb, uuid, now } from './index';

export interface GymPlan {
  id: string; tenant_id: string;
  name: string; duration_days: number; price: number;
  description: string | null; is_active: boolean;
}

export interface GymMember {
  id: string; tenant_id: string;
  name: string; phone: string | null; email: string | null;
  address: string | null; dob: string | null; gender: string | null;
  goal: string | null; blood_group: string | null;
  emergency_contact: string | null; emergency_phone: string | null;
  plan_id: string | null; plan_name: string | null;
  membership_start: string | null; membership_end: string | null;
  amount_paid: number; balance_due: number;
  is_active: boolean; notes: string | null;
}

export interface GymCheckin {
  id: string; tenant_id: string;
  member_id: string; member_name: string;
  checked_in_at: string; checked_out_at: string | null; notes: string | null;
}

export interface GymRenewal {
  id: string; tenant_id: string;
  member_id: string; member_name: string;
  plan_id: string | null; plan_name: string;
  duration_days: number; amount: number;
  payment_method: string; renewed_at: string;
  valid_from: string; valid_until: string; notes: string | null;
}

export interface GymPTPackage {
  id: string; tenant_id: string;
  member_id: string; member_name: string;
  trainer_id: string | null; trainer_name: string | null;
  sessions_total: number; sessions_done: number;
  price: number; valid_until: string | null; is_active: boolean;
}

export interface GymStaff {
  id: string; tenant_id: string;
  name: string; phone: string | null;
  role: string; salary: number; is_active: boolean; joined_at: string;
}

// ─── Plans ───────────────────────────────────────────────────────────────────

export async function listPlans(tenantId: string): Promise<GymPlan[]> {
  const db = await getDb();
  const rows = await db.select<GymPlan[]>(
    `SELECT * FROM gym_plans WHERE tenant_id=? AND deleted_at IS NULL ORDER BY price`,
    [tenantId]
  );
  return rows.map(r => ({ ...r, is_active: !!r.is_active }));
}

export async function savePlan(tenantId: string, data: Partial<GymPlan> & { name: string }): Promise<string> {
  const db = await getDb();
  if (data.id) {
    await db.execute(
      `UPDATE gym_plans SET name=?,duration_days=?,price=?,description=?,is_active=?,updated_at=? WHERE id=? AND tenant_id=?`,
      [data.name, data.duration_days??30, data.price??0, data.description??null, data.is_active?1:0, now(), data.id, tenantId]
    );
    return data.id;
  }
  const id = uuid();
  await db.execute(
    `INSERT INTO gym_plans(id,tenant_id,name,duration_days,price,description) VALUES(?,?,?,?,?,?)`,
    [id, tenantId, data.name, data.duration_days??30, data.price??0, data.description??null]
  );
  return id;
}

export async function deletePlan(tenantId: string, id: string) {
  const db = await getDb();
  await db.execute(`UPDATE gym_plans SET deleted_at=datetime('now') WHERE id=? AND tenant_id=?`, [id, tenantId]);
}

// ─── Members ─────────────────────────────────────────────────────────────────

export async function listMembers(tenantId: string, activeOnly = false): Promise<GymMember[]> {
  const db = await getDb();
  const query = activeOnly
    ? `SELECT * FROM gym_members WHERE tenant_id=? AND is_active=1 AND deleted_at IS NULL ORDER BY name`
    : `SELECT * FROM gym_members WHERE tenant_id=? AND deleted_at IS NULL ORDER BY name`;
  const rows = await db.select<GymMember[]>(query, [tenantId]);
  return rows.map(r => ({ ...r, is_active: !!r.is_active }));
}

export async function saveMember(tenantId: string, data: Partial<GymMember> & { name: string }): Promise<string> {
  const db = await getDb();
  if (data.id) {
    await db.execute(
      `UPDATE gym_members SET name=?,phone=?,email=?,address=?,dob=?,gender=?,goal=?,blood_group=?,emergency_contact=?,emergency_phone=?,plan_id=?,plan_name=?,membership_start=?,membership_end=?,amount_paid=?,balance_due=?,is_active=?,notes=?,updated_at=? WHERE id=? AND tenant_id=?`,
      [data.name, data.phone??null, data.email??null, data.address??null, data.dob??null, data.gender??null, data.goal??null, data.blood_group??null, data.emergency_contact??null, data.emergency_phone??null, data.plan_id??null, data.plan_name??null, data.membership_start??null, data.membership_end??null, data.amount_paid??0, data.balance_due??0, data.is_active?1:0, data.notes??null, now(), data.id, tenantId]
    );
    return data.id;
  }
  const id = uuid();
  await db.execute(
    `INSERT INTO gym_members(id,tenant_id,name,phone,email,address,dob,gender,goal,blood_group,emergency_contact,emergency_phone,plan_id,plan_name,membership_start,membership_end,amount_paid,balance_due,is_active,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.name, data.phone??null, data.email??null, data.address??null, data.dob??null, data.gender??null, data.goal??null, data.blood_group??null, data.emergency_contact??null, data.emergency_phone??null, data.plan_id??null, data.plan_name??null, data.membership_start??null, data.membership_end??null, data.amount_paid??0, 0, 1, data.notes??null]
  );
  return id;
}

export async function deleteMember(tenantId: string, id: string) {
  const db = await getDb();
  await db.execute(`UPDATE gym_members SET deleted_at=datetime('now') WHERE id=? AND tenant_id=?`, [id, tenantId]);
}

// ─── Check-in ────────────────────────────────────────────────────────────────

export async function checkIn(tenantId: string, memberId: string, memberName: string): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO gym_checkins(id,tenant_id,member_id,member_name) VALUES(?,?,?,?)`,
    [id, tenantId, memberId, memberName]
  );
  return id;
}

export async function checkOut(tenantId: string, checkinId: string) {
  const db = await getDb();
  await db.execute(
    `UPDATE gym_checkins SET checked_out_at=datetime('now') WHERE id=? AND tenant_id=?`,
    [checkinId, tenantId]
  );
}

export async function getTodayCheckins(tenantId: string): Promise<GymCheckin[]> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  return db.select<GymCheckin[]>(
    `SELECT * FROM gym_checkins WHERE tenant_id=? AND date(checked_in_at)=? ORDER BY checked_in_at DESC`,
    [tenantId, today]
  );
}

// ─── Renewals ────────────────────────────────────────────────────────────────

export async function renewMembership(tenantId: string, data: Omit<GymRenewal, 'id' | 'tenant_id'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO gym_renewals(id,tenant_id,member_id,member_name,plan_id,plan_name,duration_days,amount,payment_method,valid_from,valid_until,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.member_id, data.member_name, data.plan_id??null, data.plan_name, data.duration_days, data.amount, data.payment_method, data.valid_from, data.valid_until, data.notes??null]
  );
  await db.execute(
    `UPDATE gym_members SET plan_name=?,membership_start=?,membership_end=?,amount_paid=amount_paid+?,balance_due=0,is_active=1,updated_at=? WHERE id=? AND tenant_id=?`,
    [data.plan_name, data.valid_from, data.valid_until, data.amount, now(), data.member_id, tenantId]
  );
  return id;
}

export async function getExpiringMembers(tenantId: string, days = 7): Promise<GymMember[]> {
  const db = await getDb();
  const cutoff = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db.select<GymMember[]>(
    `SELECT * FROM gym_members WHERE tenant_id=? AND membership_end>=? AND membership_end<=? AND deleted_at IS NULL ORDER BY membership_end`,
    [tenantId, today, cutoff]
  );
  return rows.map(r => ({ ...r, is_active: !!r.is_active }));
}

export async function getExpiredMembers(tenantId: string): Promise<GymMember[]> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db.select<GymMember[]>(
    `SELECT * FROM gym_members WHERE tenant_id=? AND membership_end<? AND is_active=1 AND deleted_at IS NULL ORDER BY membership_end`,
    [tenantId, today]
  );
  return rows.map(r => ({ ...r, is_active: !!r.is_active }));
}

// ─── PT Packages ─────────────────────────────────────────────────────────────

export async function listPTPackages(tenantId: string): Promise<GymPTPackage[]> {
  const db = await getDb();
  const rows = await db.select<GymPTPackage[]>(
    `SELECT * FROM gym_pt_packages WHERE tenant_id=? AND is_active=1 AND deleted_at IS NULL ORDER BY created_at DESC`,
    [tenantId]
  );
  return rows.map(r => ({ ...r, is_active: !!r.is_active }));
}

export async function savePTPackage(tenantId: string, data: Partial<GymPTPackage> & { member_id: string; member_name: string }): Promise<string> {
  const db = await getDb();
  if (data.id) {
    await db.execute(
      `UPDATE gym_pt_packages SET trainer_id=?,trainer_name=?,sessions_total=?,sessions_done=?,price=?,valid_until=?,is_active=?,updated_at=? WHERE id=? AND tenant_id=?`,
      [data.trainer_id??null, data.trainer_name??null, data.sessions_total??12, data.sessions_done??0, data.price??0, data.valid_until??null, data.is_active?1:0, now(), data.id, tenantId]
    );
    return data.id;
  }
  const id = uuid();
  await db.execute(
    `INSERT INTO gym_pt_packages(id,tenant_id,member_id,member_name,trainer_id,trainer_name,sessions_total,sessions_done,price,valid_until) VALUES(?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.member_id, data.member_name, data.trainer_id??null, data.trainer_name??null, data.sessions_total??12, 0, data.price??0, data.valid_until??null]
  );
  return id;
}

// ─── Staff ───────────────────────────────────────────────────────────────────

export async function listGymStaff(tenantId: string): Promise<GymStaff[]> {
  const db = await getDb();
  const rows = await db.select<GymStaff[]>(
    `SELECT * FROM gym_staff WHERE tenant_id=? AND deleted_at IS NULL ORDER BY name`,
    [tenantId]
  );
  return rows.map(r => ({ ...r, is_active: !!r.is_active }));
}

export async function saveGymStaff(tenantId: string, data: Partial<GymStaff> & { name: string }): Promise<string> {
  const db = await getDb();
  if (data.id) {
    await db.execute(
      `UPDATE gym_staff SET name=?,phone=?,role=?,salary=?,is_active=?,updated_at=? WHERE id=? AND tenant_id=?`,
      [data.name, data.phone??null, data.role??'trainer', data.salary??0, data.is_active?1:0, now(), data.id, tenantId]
    );
    return data.id;
  }
  const id = uuid();
  await db.execute(
    `INSERT INTO gym_staff(id,tenant_id,name,phone,role,salary) VALUES(?,?,?,?,?,?)`,
    [id, tenantId, data.name, data.phone??null, data.role??'trainer', data.salary??0]
  );
  return id;
}

export async function deleteGymStaff(tenantId: string, id: string) {
  const db = await getDb();
  await db.execute(`UPDATE gym_staff SET deleted_at=datetime('now') WHERE id=? AND tenant_id=?`, [id, tenantId]);
}

// ─── Dashboard stats ─────────────────────────────────────────────────────────

export async function getGymStats(tenantId: string) {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const in7days = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const [members] = await db.select<{ total: number; active: number }[]>(
    `SELECT COUNT(*) as total, SUM(CASE WHEN is_active=1 THEN 1 ELSE 0 END) as active FROM gym_members WHERE tenant_id=? AND deleted_at IS NULL`,
    [tenantId]
  );
  const [checkins] = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM gym_checkins WHERE tenant_id=? AND date(checked_in_at)=?`,
    [tenantId, today]
  );
  const [expiring] = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM gym_members WHERE tenant_id=? AND membership_end>=? AND membership_end<=? AND deleted_at IS NULL`,
    [tenantId, today, in7days]
  );
  const [expired] = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM gym_members WHERE tenant_id=? AND membership_end<? AND is_active=1 AND deleted_at IS NULL`,
    [tenantId, today]
  );
  const [revenue] = await db.select<{ total: number }[]>(
    `SELECT COALESCE(SUM(amount),0) as total FROM gym_renewals WHERE tenant_id=? AND date(renewed_at)=? AND deleted_at IS NULL`,
    [tenantId, today]
  );
  return {
    totalMembers: members?.total ?? 0,
    activeMembers: members?.active ?? 0,
    todayCheckins: checkins?.count ?? 0,
    expiringIn7Days: expiring?.count ?? 0,
    expiredCount: expired?.count ?? 0,
    todayRevenue: revenue?.total ?? 0,
  };
}

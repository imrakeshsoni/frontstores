// [drivingschool] [all tenants]
import { getDb, uuid, now } from './index';

export interface DSStudent {
  id: string; tenant_id: string;
  name: string; phone: string;
  address: string; dob: string;
  id_proof_type: string; id_proof_no: string;
  license_type: string;
  enrolled_at: string; ll_test_date: string | null;
  ll_passed: number; dl_test_date: string | null;
  dl_passed: number; dl_no: string;
  fees_total: number; fees_paid: number;
  status: string;
  updated_at: string | null; deleted_at: string | null;
}

export interface DSSession {
  id: string; tenant_id: string;
  student_id: string; vehicle_id: string;
  instructor_id: string; session_date: string;
  start_time: string; duration_mins: number;
  status: string; notes: string;
  updated_at: string | null; deleted_at: string | null;
  // joined
  student_name?: string; vehicle_reg?: string; instructor_name?: string;
}

export interface DSVehicle {
  id: string; tenant_id: string;
  reg_no: string; type: string;
  brand: string; model: string;
  fitness_expiry: string | null; insurance_expiry: string | null;
  status: string;
  updated_at: string | null; deleted_at: string | null;
}

export interface DSInstructor {
  id: string; tenant_id: string;
  name: string; phone: string;
  license_no: string; license_expiry: string | null;
  status: string;
  updated_at: string | null; deleted_at: string | null;
}

export interface DSPayment {
  id: string; tenant_id: string;
  student_id: string; amount: number;
  payment_mode: string; date: string;
  notes: string;
  updated_at: string | null; deleted_at: string | null;
}

// ─── Students ────────────────────────────────────────────────────────────────

export async function listDSStudents(tenantId: string, opts: { search?: string; status?: string } = {}): Promise<DSStudent[]> {
  const db = await getDb();
  const conditions = ['tenant_id=?', 'deleted_at IS NULL'];
  const params: unknown[] = [tenantId];
  if (opts.status && opts.status !== 'all') { conditions.push('status=?'); params.push(opts.status); }
  if (opts.search) { conditions.push('(name LIKE ? OR phone LIKE ?)'); const q = `%${opts.search}%`; params.push(q, q); }
  return db.select<DSStudent[]>(`SELECT * FROM ds_students WHERE ${conditions.join(' AND ')} ORDER BY enrolled_at DESC`, params);
}

export async function getDSStudent(tenantId: string, id: string): Promise<DSStudent | null> {
  const db = await getDb();
  const rows = await db.select<DSStudent[]>(`SELECT * FROM ds_students WHERE id=? AND tenant_id=? AND deleted_at IS NULL`, [id, tenantId]);
  return rows[0] ?? null;
}

export async function saveDSStudent(tenantId: string, data: Partial<DSStudent> & { name: string }): Promise<string> {
  const db = await getDb();
  if (data.id) {
    await db.execute(
      `UPDATE ds_students SET name=?,phone=?,address=?,dob=?,id_proof_type=?,id_proof_no=?,license_type=?,ll_test_date=?,ll_passed=?,dl_test_date=?,dl_passed=?,dl_no=?,fees_total=?,fees_paid=?,status=?,updated_at=? WHERE id=? AND tenant_id=?`,
      [data.name, data.phone??'', data.address??'', data.dob??'', data.id_proof_type??'', data.id_proof_no??'', data.license_type??'LMV', data.ll_test_date??null, data.ll_passed??0, data.dl_test_date??null, data.dl_passed??0, data.dl_no??'', data.fees_total??0, data.fees_paid??0, data.status??'active', now(), data.id, tenantId]
    );
    return data.id;
  }
  const id = uuid();
  await db.execute(
    `INSERT INTO ds_students(id,tenant_id,name,phone,address,dob,id_proof_type,id_proof_no,license_type,enrolled_at,fees_total,fees_paid,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.name, data.phone??'', data.address??'', data.dob??'', data.id_proof_type??'', data.id_proof_no??'', data.license_type??'LMV', now(), data.fees_total??0, data.fees_paid??0, 'active']
  );
  return id;
}

export async function deleteDSStudent(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE ds_students SET deleted_at=?,updated_at=? WHERE id=? AND tenant_id=?`, [now(), now(), id, tenantId]);
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export async function listDSSessions(tenantId: string, opts: { date?: string; studentId?: string } = {}): Promise<DSSession[]> {
  const db = await getDb();
  const conditions = ['s.tenant_id=?', 's.deleted_at IS NULL'];
  const params: unknown[] = [tenantId];
  if (opts.date) { conditions.push('s.session_date=?'); params.push(opts.date); }
  if (opts.studentId) { conditions.push('s.student_id=?'); params.push(opts.studentId); }
  return db.select<DSSession[]>(
    `SELECT s.*, st.name as student_name, v.reg_no as vehicle_reg, i.name as instructor_name
     FROM ds_sessions s
     LEFT JOIN ds_students st ON st.id=s.student_id AND st.tenant_id=s.tenant_id
     LEFT JOIN ds_vehicles v ON v.id=s.vehicle_id AND v.tenant_id=s.tenant_id
     LEFT JOIN ds_instructors i ON i.id=s.instructor_id AND i.tenant_id=s.tenant_id
     WHERE ${conditions.join(' AND ')} ORDER BY s.session_date DESC, s.start_time`,
    params
  );
}

export async function saveDSSession(tenantId: string, data: Partial<DSSession> & { student_id: string; session_date: string }): Promise<string> {
  const db = await getDb();
  if (data.id) {
    await db.execute(
      `UPDATE ds_sessions SET student_id=?,vehicle_id=?,instructor_id=?,session_date=?,start_time=?,duration_mins=?,status=?,notes=?,updated_at=? WHERE id=? AND tenant_id=?`,
      [data.student_id, data.vehicle_id??'', data.instructor_id??'', data.session_date, data.start_time??'', data.duration_mins??60, data.status??'scheduled', data.notes??'', now(), data.id, tenantId]
    );
    return data.id;
  }
  const id = uuid();
  await db.execute(
    `INSERT INTO ds_sessions(id,tenant_id,student_id,vehicle_id,instructor_id,session_date,start_time,duration_mins,status,notes) VALUES(?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.student_id, data.vehicle_id??'', data.instructor_id??'', data.session_date, data.start_time??'', data.duration_mins??60, data.status??'scheduled', data.notes??'']
  );
  return id;
}

export async function deleteDSSession(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE ds_sessions SET deleted_at=?,updated_at=? WHERE id=? AND tenant_id=?`, [now(), now(), id, tenantId]);
}

// ─── Vehicles ────────────────────────────────────────────────────────────────

export async function listDSVehicles(tenantId: string): Promise<DSVehicle[]> {
  const db = await getDb();
  return db.select<DSVehicle[]>(`SELECT * FROM ds_vehicles WHERE tenant_id=? AND deleted_at IS NULL ORDER BY reg_no`, [tenantId]);
}

export async function saveDSVehicle(tenantId: string, data: Partial<DSVehicle> & { reg_no: string }): Promise<string> {
  const db = await getDb();
  if (data.id) {
    await db.execute(
      `UPDATE ds_vehicles SET reg_no=?,type=?,brand=?,model=?,fitness_expiry=?,insurance_expiry=?,status=?,updated_at=? WHERE id=? AND tenant_id=?`,
      [data.reg_no, data.type??'car', data.brand??'', data.model??'', data.fitness_expiry??null, data.insurance_expiry??null, data.status??'active', now(), data.id, tenantId]
    );
    return data.id;
  }
  const id = uuid();
  await db.execute(
    `INSERT INTO ds_vehicles(id,tenant_id,reg_no,type,brand,model,fitness_expiry,insurance_expiry,status) VALUES(?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.reg_no, data.type??'car', data.brand??'', data.model??'', data.fitness_expiry??null, data.insurance_expiry??null, 'active']
  );
  return id;
}

export async function deleteDSVehicle(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE ds_vehicles SET deleted_at=?,updated_at=? WHERE id=? AND tenant_id=?`, [now(), now(), id, tenantId]);
}

// ─── Instructors ─────────────────────────────────────────────────────────────

export async function listDSInstructors(tenantId: string): Promise<DSInstructor[]> {
  const db = await getDb();
  return db.select<DSInstructor[]>(`SELECT * FROM ds_instructors WHERE tenant_id=? AND deleted_at IS NULL ORDER BY name`, [tenantId]);
}

export async function saveDSInstructor(tenantId: string, data: Partial<DSInstructor> & { name: string }): Promise<string> {
  const db = await getDb();
  if (data.id) {
    await db.execute(
      `UPDATE ds_instructors SET name=?,phone=?,license_no=?,license_expiry=?,status=?,updated_at=? WHERE id=? AND tenant_id=?`,
      [data.name, data.phone??'', data.license_no??'', data.license_expiry??null, data.status??'active', now(), data.id, tenantId]
    );
    return data.id;
  }
  const id = uuid();
  await db.execute(
    `INSERT INTO ds_instructors(id,tenant_id,name,phone,license_no,license_expiry,status) VALUES(?,?,?,?,?,?,?)`,
    [id, tenantId, data.name, data.phone??'', data.license_no??'', data.license_expiry??null, 'active']
  );
  return id;
}

export async function deleteDSInstructor(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE ds_instructors SET deleted_at=?,updated_at=? WHERE id=? AND tenant_id=?`, [now(), now(), id, tenantId]);
}

// ─── Payments ────────────────────────────────────────────────────────────────

export async function listDSPayments(tenantId: string, studentId?: string): Promise<DSPayment[]> {
  const db = await getDb();
  if (studentId) {
    return db.select<DSPayment[]>(`SELECT * FROM ds_payments WHERE tenant_id=? AND student_id=? AND deleted_at IS NULL ORDER BY date DESC`, [tenantId, studentId]);
  }
  return db.select<DSPayment[]>(`SELECT * FROM ds_payments WHERE tenant_id=? AND deleted_at IS NULL ORDER BY date DESC`, [tenantId]);
}

export async function addDSPayment(tenantId: string, data: { student_id: string; amount: number; payment_mode: string; date: string; notes?: string }): Promise<void> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO ds_payments(id,tenant_id,student_id,amount,payment_mode,date,notes) VALUES(?,?,?,?,?,?,?)`,
    [id, tenantId, data.student_id, data.amount, data.payment_mode, data.date, data.notes??'']
  );
  await db.execute(`UPDATE ds_students SET fees_paid=fees_paid+?,updated_at=? WHERE id=? AND tenant_id=?`, [data.amount, now(), data.student_id, tenantId]);
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export interface DSStats {
  activeStudents: number;
  sessionsToday: number;
  pendingFeesTotal: number;
  llPassedThisMonth: number;
  dlPassedThisMonth: number;
  totalVehicles: number;
  activeVehicles: number;
}

export async function getDSStats(tenantId: string): Promise<DSStats> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0,10);
  const monthStart = today.slice(0,7) + '-01';

  const [students] = await db.select<{active:number,pending_fees:number}[]>(
    `SELECT SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active, SUM(fees_total-fees_paid) as pending_fees FROM ds_students WHERE tenant_id=? AND deleted_at IS NULL`,
    [tenantId]
  );
  const [sessions] = await db.select<{c:number}[]>(
    `SELECT COUNT(*) as c FROM ds_sessions WHERE tenant_id=? AND session_date=? AND deleted_at IS NULL`,
    [tenantId, today]
  );
  const [testResults] = await db.select<{ll:number,dl:number}[]>(
    `SELECT SUM(CASE WHEN ll_passed=1 AND ll_test_date>=? THEN 1 ELSE 0 END) as ll, SUM(CASE WHEN dl_passed=1 AND dl_test_date>=? THEN 1 ELSE 0 END) as dl FROM ds_students WHERE tenant_id=? AND deleted_at IS NULL`,
    [monthStart, monthStart, tenantId]
  );
  const [vehicles] = await db.select<{total:number,active:number}[]>(
    `SELECT COUNT(*) as total, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active FROM ds_vehicles WHERE tenant_id=? AND deleted_at IS NULL`,
    [tenantId]
  );
  return {
    activeStudents: students?.active ?? 0,
    sessionsToday: sessions?.c ?? 0,
    pendingFeesTotal: students?.pending_fees ?? 0,
    llPassedThisMonth: testResults?.ll ?? 0,
    dlPassedThisMonth: testResults?.dl ?? 0,
    totalVehicles: vehicles?.total ?? 0,
    activeVehicles: vehicles?.active ?? 0,
  };
}

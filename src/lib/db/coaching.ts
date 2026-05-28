// [coaching] [all tenants]
import { getDb, uuid, now } from './index';

export interface CoachingStudent {
  id: string; tenant_id: string;
  name: string; phone: string | null; parent_phone: string | null;
  email: string | null; address: string | null;
  batch_id: string | null; course: string | null; class_grade: string | null;
  fee_amount: number; fee_due_day: number; balance_due: number;
  joined_at: string; is_active: boolean; notes: string | null;
}

export interface CoachingBatch {
  id: string; tenant_id: string;
  name: string; subject: string | null;
  teacher_id: string | null; teacher_name: string | null;
  days: string | null; start_time: string | null; end_time: string | null;
  room: string | null; capacity: number; is_active: boolean;
  student_count?: number;
}

export interface CoachingAttendance {
  id: string; tenant_id: string;
  batch_id: string; student_id: string;
  date: string; status: 'present' | 'absent' | 'late'; notes: string | null;
}

export interface CoachingFee {
  id: string; tenant_id: string;
  student_id: string; student_name: string;
  batch_id: string | null; batch_name: string | null;
  amount: number; month: string;
  payment_method: string; notes: string | null; collected_at: string;
}

export interface CoachingExam {
  id: string; tenant_id: string;
  batch_id: string | null; batch_name: string | null;
  title: string; subject: string | null; exam_date: string | null;
  total_marks: number; passing_marks: number; notes: string | null;
}

export interface CoachingExamResult {
  id: string; tenant_id: string;
  exam_id: string; student_id: string; student_name: string;
  marks_obtained: number | null; grade: string | null; remarks: string | null;
}

export interface CoachingTeacher {
  id: string; tenant_id: string;
  name: string; phone: string | null; email: string | null;
  subjects: string | null; salary: number; is_active: boolean; joined_at: string;
}

// ─── Students ───────────────────────────────────────────────────────────────

export async function listStudents(tenantId: string, batchId?: string): Promise<CoachingStudent[]> {
  const db = await getDb();
  const query = batchId
    ? `SELECT * FROM coaching_students WHERE tenant_id=? AND batch_id=? AND deleted_at IS NULL ORDER BY name`
    : `SELECT * FROM coaching_students WHERE tenant_id=? AND deleted_at IS NULL ORDER BY name`;
  const params = batchId ? [tenantId, batchId] : [tenantId];
  const rows = await db.select<CoachingStudent[]>(query, params);
  return rows.map(r => ({ ...r, is_active: !!r.is_active }));
}

export async function saveStudent(tenantId: string, data: Partial<CoachingStudent> & { name: string }): Promise<string> {
  const db = await getDb();
  if (data.id) {
    await db.execute(
      `UPDATE coaching_students SET name=?,phone=?,parent_phone=?,email=?,address=?,batch_id=?,course=?,class_grade=?,fee_amount=?,fee_due_day=?,balance_due=?,is_active=?,notes=?,updated_at=? WHERE id=? AND tenant_id=?`,
      [data.name, data.phone??null, data.parent_phone??null, data.email??null, data.address??null, data.batch_id??null, data.course??null, data.class_grade??null, data.fee_amount??0, data.fee_due_day??1, data.balance_due??0, data.is_active?1:0, data.notes??null, now(), data.id, tenantId]
    );
    return data.id;
  }
  const id = uuid();
  await db.execute(
    `INSERT INTO coaching_students(id,tenant_id,name,phone,parent_phone,email,address,batch_id,course,class_grade,fee_amount,fee_due_day,balance_due,is_active,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.name, data.phone??null, data.parent_phone??null, data.email??null, data.address??null, data.batch_id??null, data.course??null, data.class_grade??null, data.fee_amount??0, data.fee_due_day??1, 0, 1, data.notes??null]
  );
  return id;
}

export async function deleteStudent(tenantId: string, id: string) {
  const db = await getDb();
  await db.execute(`UPDATE coaching_students SET deleted_at=datetime('now') WHERE id=? AND tenant_id=?`, [id, tenantId]);
}

// ─── Batches ─────────────────────────────────────────────────────────────────

export async function listBatches(tenantId: string): Promise<CoachingBatch[]> {
  const db = await getDb();
  const batches = await db.select<CoachingBatch[]>(
    `SELECT b.*, (SELECT COUNT(*) FROM coaching_students s WHERE s.batch_id=b.id AND s.deleted_at IS NULL) as student_count
     FROM coaching_batches b WHERE b.tenant_id=? AND b.deleted_at IS NULL ORDER BY b.name`,
    [tenantId]
  );
  return batches.map(b => ({ ...b, is_active: !!b.is_active }));
}

export async function saveBatch(tenantId: string, data: Partial<CoachingBatch> & { name: string }): Promise<string> {
  const db = await getDb();
  if (data.id) {
    await db.execute(
      `UPDATE coaching_batches SET name=?,subject=?,teacher_id=?,teacher_name=?,days=?,start_time=?,end_time=?,room=?,capacity=?,is_active=?,updated_at=? WHERE id=? AND tenant_id=?`,
      [data.name, data.subject??null, data.teacher_id??null, data.teacher_name??null, data.days??null, data.start_time??null, data.end_time??null, data.room??null, data.capacity??30, data.is_active?1:0, now(), data.id, tenantId]
    );
    return data.id;
  }
  const id = uuid();
  await db.execute(
    `INSERT INTO coaching_batches(id,tenant_id,name,subject,teacher_id,teacher_name,days,start_time,end_time,room,capacity) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.name, data.subject??null, data.teacher_id??null, data.teacher_name??null, data.days??null, data.start_time??null, data.end_time??null, data.room??null, data.capacity??30]
  );
  return id;
}

export async function deleteBatch(tenantId: string, id: string) {
  const db = await getDb();
  await db.execute(`UPDATE coaching_batches SET deleted_at=datetime('now') WHERE id=? AND tenant_id=?`, [id, tenantId]);
}

// ─── Attendance ──────────────────────────────────────────────────────────────

export async function getAttendance(tenantId: string, batchId: string, date: string): Promise<CoachingAttendance[]> {
  const db = await getDb();
  return db.select<CoachingAttendance[]>(
    `SELECT * FROM coaching_attendance WHERE tenant_id=? AND batch_id=? AND date=?`,
    [tenantId, batchId, date]
  );
}

export async function saveAttendance(tenantId: string, batchId: string, date: string, records: { student_id: string; status: string }[]) {
  const db = await getDb();
  for (const r of records) {
    await db.execute(
      `INSERT INTO coaching_attendance(id,tenant_id,batch_id,student_id,date,status) VALUES(?,?,?,?,?,?)
       ON CONFLICT(tenant_id,batch_id,student_id,date) DO UPDATE SET status=excluded.status, updated_at=datetime('now')`,
      [uuid(), tenantId, batchId, r.student_id, date, r.status]
    );
  }
}

export async function getAttendanceSummary(tenantId: string, studentId: string, fromDate: string, toDate: string) {
  const db = await getDb();
  const rows = await db.select<{ status: string; cnt: number }[]>(
    `SELECT status, COUNT(*) as cnt FROM coaching_attendance WHERE tenant_id=? AND student_id=? AND date>=? AND date<=? GROUP BY status`,
    [tenantId, studentId, fromDate, toDate]
  );
  const result = { present: 0, absent: 0, late: 0 };
  for (const r of rows) { result[r.status as keyof typeof result] = r.cnt; }
  return result;
}

// ─── Fees ────────────────────────────────────────────────────────────────────

export async function listFees(tenantId: string, month?: string): Promise<CoachingFee[]> {
  const db = await getDb();
  const query = month
    ? `SELECT * FROM coaching_fees WHERE tenant_id=? AND month=? AND deleted_at IS NULL ORDER BY collected_at DESC`
    : `SELECT * FROM coaching_fees WHERE tenant_id=? AND deleted_at IS NULL ORDER BY collected_at DESC LIMIT 200`;
  return db.select<CoachingFee[]>(query, month ? [tenantId, month] : [tenantId]);
}

export async function collectFee(tenantId: string, data: Omit<CoachingFee, 'id' | 'tenant_id'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO coaching_fees(id,tenant_id,student_id,student_name,batch_id,batch_name,amount,month,payment_method,notes) VALUES(?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.student_id, data.student_name, data.batch_id??null, data.batch_name??null, data.amount, data.month, data.payment_method, data.notes??null]
  );
  await db.execute(
    `UPDATE coaching_students SET balance_due=MAX(0,balance_due-?),updated_at=? WHERE id=? AND tenant_id=?`,
    [data.amount, now(), data.student_id, tenantId]
  );
  return id;
}

export async function getFeeSummary(tenantId: string, month: string) {
  const db = await getDb();
  const [row] = await db.select<{ total: number; count: number }[]>(
    `SELECT COALESCE(SUM(amount),0) as total, COUNT(*) as count FROM coaching_fees WHERE tenant_id=? AND month=? AND deleted_at IS NULL`,
    [tenantId, month]
  );
  return row ?? { total: 0, count: 0 };
}

export async function getDueStudents(tenantId: string): Promise<CoachingStudent[]> {
  const db = await getDb();
  const rows = await db.select<CoachingStudent[]>(
    `SELECT * FROM coaching_students WHERE tenant_id=? AND balance_due>0 AND deleted_at IS NULL ORDER BY balance_due DESC`,
    [tenantId]
  );
  return rows.map(r => ({ ...r, is_active: !!r.is_active }));
}

// ─── Exams ───────────────────────────────────────────────────────────────────

export async function listExams(tenantId: string): Promise<CoachingExam[]> {
  const db = await getDb();
  return db.select<CoachingExam[]>(
    `SELECT * FROM coaching_exams WHERE tenant_id=? AND deleted_at IS NULL ORDER BY exam_date DESC`,
    [tenantId]
  );
}

export async function saveExam(tenantId: string, data: Partial<CoachingExam> & { title: string }): Promise<string> {
  const db = await getDb();
  if (data.id) {
    await db.execute(
      `UPDATE coaching_exams SET title=?,batch_id=?,batch_name=?,subject=?,exam_date=?,total_marks=?,passing_marks=?,notes=?,updated_at=? WHERE id=? AND tenant_id=?`,
      [data.title, data.batch_id??null, data.batch_name??null, data.subject??null, data.exam_date??null, data.total_marks??100, data.passing_marks??35, data.notes??null, now(), data.id, tenantId]
    );
    return data.id;
  }
  const id = uuid();
  await db.execute(
    `INSERT INTO coaching_exams(id,tenant_id,title,batch_id,batch_name,subject,exam_date,total_marks,passing_marks,notes) VALUES(?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.title, data.batch_id??null, data.batch_name??null, data.subject??null, data.exam_date??null, data.total_marks??100, data.passing_marks??35, data.notes??null]
  );
  return id;
}

export async function saveExamResults(tenantId: string, examId: string, results: { student_id: string; student_name: string; marks_obtained: number | null; grade: string | null; remarks: string | null }[]) {
  const db = await getDb();
  for (const r of results) {
    await db.execute(
      `INSERT INTO coaching_exam_results(id,tenant_id,exam_id,student_id,student_name,marks_obtained,grade,remarks) VALUES(?,?,?,?,?,?,?,?)
       ON CONFLICT(exam_id,student_id) DO UPDATE SET marks_obtained=excluded.marks_obtained,grade=excluded.grade,remarks=excluded.remarks,updated_at=datetime('now')`,
      [uuid(), tenantId, examId, r.student_id, r.student_name, r.marks_obtained??null, r.grade??null, r.remarks??null]
    );
  }
}

export async function getExamResults(tenantId: string, examId: string): Promise<CoachingExamResult[]> {
  const db = await getDb();
  return db.select<CoachingExamResult[]>(
    `SELECT * FROM coaching_exam_results WHERE tenant_id=? AND exam_id=? ORDER BY marks_obtained DESC`,
    [tenantId, examId]
  );
}

// ─── Teachers ────────────────────────────────────────────────────────────────

export async function listTeachers(tenantId: string): Promise<CoachingTeacher[]> {
  const db = await getDb();
  const rows = await db.select<CoachingTeacher[]>(
    `SELECT * FROM coaching_teachers WHERE tenant_id=? AND deleted_at IS NULL ORDER BY name`,
    [tenantId]
  );
  return rows.map(r => ({ ...r, is_active: !!r.is_active }));
}

export async function saveTeacher(tenantId: string, data: Partial<CoachingTeacher> & { name: string }): Promise<string> {
  const db = await getDb();
  if (data.id) {
    await db.execute(
      `UPDATE coaching_teachers SET name=?,phone=?,email=?,subjects=?,salary=?,is_active=?,updated_at=? WHERE id=? AND tenant_id=?`,
      [data.name, data.phone??null, data.email??null, data.subjects??null, data.salary??0, data.is_active?1:0, now(), data.id, tenantId]
    );
    return data.id;
  }
  const id = uuid();
  await db.execute(
    `INSERT INTO coaching_teachers(id,tenant_id,name,phone,email,subjects,salary) VALUES(?,?,?,?,?,?,?)`,
    [id, tenantId, data.name, data.phone??null, data.email??null, data.subjects??null, data.salary??0]
  );
  return id;
}

export async function deleteTeacher(tenantId: string, id: string) {
  const db = await getDb();
  await db.execute(`UPDATE coaching_teachers SET deleted_at=datetime('now') WHERE id=? AND tenant_id=?`, [id, tenantId]);
}

// ─── Dashboard stats ─────────────────────────────────────────────────────────

export async function getCoachingStats(tenantId: string) {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);
  const [students] = await db.select<{ total: number; active: number; due: number }[]>(
    `SELECT COUNT(*) as total, SUM(CASE WHEN is_active=1 THEN 1 ELSE 0 END) as active, SUM(CASE WHEN balance_due>0 THEN 1 ELSE 0 END) as due FROM coaching_students WHERE tenant_id=? AND deleted_at IS NULL`,
    [tenantId]
  );
  const [fees] = await db.select<{ total: number }[]>(
    `SELECT COALESCE(SUM(amount),0) as total FROM coaching_fees WHERE tenant_id=? AND month=? AND deleted_at IS NULL`,
    [tenantId, thisMonth]
  );
  const [batches] = await db.select<{ total: number }[]>(
    `SELECT COUNT(*) as total FROM coaching_batches WHERE tenant_id=? AND is_active=1 AND deleted_at IS NULL`,
    [tenantId]
  );
  const [teachers] = await db.select<{ total: number }[]>(
    `SELECT COUNT(*) as total FROM coaching_teachers WHERE tenant_id=? AND is_active=1 AND deleted_at IS NULL`,
    [tenantId]
  );
  const todayAtt = await db.select<{ status: string; cnt: number }[]>(
    `SELECT status, COUNT(*) as cnt FROM coaching_attendance WHERE tenant_id=? AND date=? GROUP BY status`,
    [tenantId, today]
  );
  const attMap = Object.fromEntries(todayAtt.map(r => [r.status, r.cnt]));
  return {
    totalStudents: students?.total ?? 0,
    activeStudents: students?.active ?? 0,
    studentsWithDues: students?.due ?? 0,
    feeCollectedThisMonth: fees?.total ?? 0,
    activeBatches: batches?.total ?? 0,
    activeTeachers: teachers?.total ?? 0,
    todayPresent: attMap['present'] ?? 0,
    todayAbsent: attMap['absent'] ?? 0,
  };
}

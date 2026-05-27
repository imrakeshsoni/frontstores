// [clinic] [all tenants]
import { getDb, uuid, now } from './index';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ClinicDoctor {
  id: string; tenant_id: string; name: string; specialization: string | null;
  qualification: string | null; registration_no: string | null; phone: string | null;
  consultation_fee: number; is_active: boolean; created_at: string;
}

export interface ClinicPatient {
  id: string; tenant_id: string; patient_no: string; name: string;
  age: number | null; age_unit: string; gender: string | null; blood_group: string | null;
  phone: string | null; address: string | null; allergies: string | null;
  medical_history: string | null; created_at: string; updated_at: string;
}

export interface ClinicToken {
  id: string; tenant_id: string; date: string; token_no: number;
  patient_id: string | null; patient_name: string | null;
  doctor_id: string | null; doctor_name: string | null;
  status: 'waiting' | 'in_progress' | 'done' | 'skipped';
  visit_id: string | null; created_at: string;
}

export interface ClinicAppointment {
  id: string; tenant_id: string; patient_id: string; patient_name: string | null;
  patient_phone: string | null; doctor_id: string | null; doctor_name: string | null;
  appointment_date: string; appointment_time: string | null;
  type: string; status: string; notes: string | null; created_at: string;
}

export interface ClinicVitals {
  id: string; visit_id: string; patient_id: string;
  bp_systolic: number | null; bp_diastolic: number | null; pulse: number | null;
  temperature: number | null; spo2: number | null; weight: number | null;
  height: number | null; blood_sugar: number | null; recorded_at: string;
}

export interface ClinicPrescriptionItem {
  id: string; prescription_id: string; medicine_name: string; dosage: string | null;
  frequency: string | null; duration: string | null; instructions: string | null;
  quantity: number | null; sort_order: number;
}

export interface ClinicPrescription {
  id: string; tenant_id: string; visit_id: string; patient_id: string;
  doctor_id: string | null; notes: string | null; prescribed_at: string;
  items: ClinicPrescriptionItem[];
}

export interface ClinicLabOrder {
  id: string; tenant_id: string; visit_id: string; patient_id: string;
  test_name: string; test_category: string | null; status: string;
  result_value: string | null; result_unit: string | null; reference_range: string | null;
  is_abnormal: boolean; notes: string | null; ordered_at: string; resulted_at: string | null;
}

export interface ClinicVisit {
  id: string; tenant_id: string; patient_id: string; patient_name: string | null;
  doctor_id: string | null; doctor_name: string | null; token_id: string | null;
  visit_date: string; chief_complaint: string | null; diagnosis: string | null;
  notes: string | null; follow_up_date: string | null; follow_up_notes: string | null;
  status: string; created_at: string;
  vitals?: ClinicVitals | null;
  prescription?: ClinicPrescription | null;
  lab_orders?: ClinicLabOrder[];
}

export interface ClinicMedicine {
  id: string; tenant_id: string; name: string; generic_name: string | null;
  form: string | null; strength: string | null; unit: string;
  stock_qty: number; min_stock_qty: number; selling_price: number;
  cost_price: number | null; gst_rate: number; expiry_date: string | null; is_active: boolean;
}

export interface ClinicBed {
  id: string; tenant_id: string; ward: string; room_no: string | null;
  bed_no: string; bed_type: string; charges_per_day: number; status: string;
}

export interface ClinicAdmission {
  id: string; tenant_id: string; patient_id: string; patient_name: string | null;
  bed_id: string | null; bed_no: string | null; ward: string | null;
  doctor_id: string | null; doctor_name: string | null;
  admission_date: string; discharge_date: string | null;
  diagnosis: string | null; status: string; room_charges: number; notes: string | null;
}

export interface ClinicBill {
  id: string; tenant_id: string; bill_number: string; patient_id: string | null;
  patient_name: string | null; patient_phone: string | null;
  doctor_id: string | null; doctor_name: string | null;
  visit_id: string | null; admission_id: string | null;
  bill_type: string; payment_method: string; payment_status: string;
  subtotal: number; discount: number; gst_amount: number; total: number;
  notes: string | null; created_at: string;
  items?: ClinicBillItem[];
}

export interface ClinicBillItem {
  id: string; bill_id: string; description: string;
  quantity: number; unit_price: number; gst_rate: number; total: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function mapDoctor(r: any): ClinicDoctor { return { ...r, is_active: r.is_active === 1 }; }
function mapPatient(r: any): ClinicPatient { return r; }
function mapMedicine(r: any): ClinicMedicine { return { ...r, is_active: r.is_active === 1, is_abnormal: r.is_abnormal === 1 }; }
function mapLabOrder(r: any): ClinicLabOrder { return { ...r, is_abnormal: r.is_abnormal === 1 }; }

async function nextPatientNo(tenantId: string): Promise<string> {
  const db = await getDb();
  const year = new Date().getFullYear();
  const rows = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM clinic_patients WHERE tenant_id = ? AND created_at LIKE ?`,
    [tenantId, `${year}%`]
  );
  const seq = (rows[0]?.count ?? 0) + 1;
  return `PT-${year}-${String(seq).padStart(4, '0')}`;
}

async function nextBillNo(tenantId: string): Promise<string> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rows = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM clinic_bills WHERE tenant_id = ? AND created_at LIKE ?`,
    [tenantId, `${new Date().toISOString().slice(0, 10)}%`]
  );
  const seq = (rows[0]?.count ?? 0) + 1;
  return `BL${today}-${String(seq).padStart(3, '0')}`;
}

// ── Doctors ──────────────────────────────────────────────────────────────────

export async function listDoctors(tenantId: string): Promise<ClinicDoctor[]> {
  const db = await getDb();
  const rows = await db.select<any[]>(
    `SELECT * FROM clinic_doctors WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY name`,
    [tenantId]
  );
  return rows.map(mapDoctor);
}

export async function createDoctor(tenantId: string, data: Omit<ClinicDoctor, 'id' | 'tenant_id' | 'created_at'>): Promise<ClinicDoctor> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO clinic_doctors (id, tenant_id, name, specialization, qualification, registration_no, phone, consultation_fee, is_active)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.name, data.specialization ?? null, data.qualification ?? null,
     data.registration_no ?? null, data.phone ?? null, data.consultation_fee, data.is_active ? 1 : 0]
  );
  const rows = await db.select<any[]>(`SELECT * FROM clinic_doctors WHERE id = ?`, [id]);
  return mapDoctor(rows[0]);
}

export async function updateDoctor(tenantId: string, id: string, data: Partial<ClinicDoctor>): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE clinic_doctors SET name=?, specialization=?, qualification=?, registration_no=?, phone=?, consultation_fee=?, is_active=?, updated_at=? WHERE id=? AND tenant_id=?`,
    [data.name, data.specialization ?? null, data.qualification ?? null, data.registration_no ?? null,
     data.phone ?? null, data.consultation_fee, data.is_active ? 1 : 0, now(), id, tenantId]
  );
}

export async function deleteDoctor(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE clinic_doctors SET deleted_at = ? WHERE id = ? AND tenant_id = ?`, [now(), id, tenantId]);
}

// ── Patients ─────────────────────────────────────────────────────────────────

export async function searchPatients(tenantId: string, search: string, limit = 20): Promise<ClinicPatient[]> {
  const db = await getDb();
  const s = `%${search}%`;
  return db.select<any[]>(
    `SELECT * FROM clinic_patients WHERE tenant_id = ? AND deleted_at IS NULL
     AND (name LIKE ? OR phone LIKE ? OR patient_no LIKE ?)
     ORDER BY updated_at DESC LIMIT ?`,
    [tenantId, s, s, s, limit]
  );
}

export async function getPatient(tenantId: string, id: string): Promise<ClinicPatient | null> {
  const db = await getDb();
  const rows = await db.select<any[]>(`SELECT * FROM clinic_patients WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL`, [id, tenantId]);
  return rows.length ? rows[0] : null;
}

export async function createPatient(tenantId: string, data: Omit<ClinicPatient, 'id' | 'tenant_id' | 'patient_no' | 'created_at' | 'updated_at'>): Promise<ClinicPatient> {
  const db = await getDb();
  const id = uuid();
  const patient_no = await nextPatientNo(tenantId);
  await db.execute(
    `INSERT INTO clinic_patients (id, tenant_id, patient_no, name, age, age_unit, gender, blood_group, phone, address, allergies, medical_history)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, patient_no, data.name, data.age ?? null, data.age_unit ?? 'years',
     data.gender ?? null, data.blood_group ?? null, data.phone ?? null,
     data.address ?? null, data.allergies ?? null, data.medical_history ?? null]
  );
  const rows = await db.select<any[]>(`SELECT * FROM clinic_patients WHERE id = ?`, [id]);
  return rows[0];
}

export async function updatePatient(tenantId: string, id: string, data: Partial<ClinicPatient>): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE clinic_patients SET name=?, age=?, age_unit=?, gender=?, blood_group=?, phone=?, address=?, allergies=?, medical_history=?, updated_at=? WHERE id=? AND tenant_id=?`,
    [data.name, data.age ?? null, data.age_unit ?? 'years', data.gender ?? null,
     data.blood_group ?? null, data.phone ?? null, data.address ?? null,
     data.allergies ?? null, data.medical_history ?? null, now(), id, tenantId]
  );
}

export async function getPatientVisits(tenantId: string, patientId: string, limit = 20): Promise<ClinicVisit[]> {
  const db = await getDb();
  return db.select<any[]>(
    `SELECT * FROM clinic_visits WHERE tenant_id = ? AND patient_id = ? AND deleted_at IS NULL ORDER BY visit_date DESC, created_at DESC LIMIT ?`,
    [tenantId, patientId, limit]
  );
}

// ── Tokens (OPD Queue) ────────────────────────────────────────────────────────

export async function getTodayTokens(tenantId: string): Promise<ClinicToken[]> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  return db.select<any[]>(
    `SELECT * FROM clinic_tokens WHERE tenant_id = ? AND date = ? ORDER BY token_no ASC`,
    [tenantId, today]
  );
}

export async function issueToken(tenantId: string, data: {
  patient_id?: string; patient_name?: string; doctor_id?: string; doctor_name?: string;
}): Promise<ClinicToken> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db.select<{ max_token: number }[]>(
    `SELECT COALESCE(MAX(token_no), 0) as max_token FROM clinic_tokens WHERE tenant_id = ? AND date = ?`,
    [tenantId, today]
  );
  const tokenNo = (rows[0]?.max_token ?? 0) + 1;
  const id = uuid();
  await db.execute(
    `INSERT INTO clinic_tokens (id, tenant_id, date, token_no, patient_id, patient_name, doctor_id, doctor_name, status)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, today, tokenNo, data.patient_id ?? null, data.patient_name ?? null,
     data.doctor_id ?? null, data.doctor_name ?? null, 'waiting']
  );
  const result = await db.select<any[]>(`SELECT * FROM clinic_tokens WHERE id = ?`, [id]);
  return result[0];
}

export async function updateTokenStatus(tenantId: string, tokenId: string, status: string, visitId?: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE clinic_tokens SET status = ?, visit_id = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`,
    [status, visitId ?? null, now(), tokenId, tenantId]
  );
}

export async function getTodayStats(tenantId: string): Promise<{
  totalPatients: number; waiting: number; inProgress: number; done: number;
  totalRevenue: number; totalBills: number;
}> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const tokenRows = await db.select<any[]>(
    `SELECT status, COUNT(*) as count FROM clinic_tokens WHERE tenant_id = ? AND date = ? GROUP BY status`,
    [tenantId, today]
  );
  const billRows = await db.select<{ total: number; count: number }[]>(
    `SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count FROM clinic_bills WHERE tenant_id = ? AND created_at LIKE ? AND deleted_at IS NULL`,
    [tenantId, `${today}%`]
  );
  let waiting = 0, inProgress = 0, done = 0, totalPatients = 0;
  for (const r of tokenRows) {
    totalPatients += r.count;
    if (r.status === 'waiting') waiting = r.count;
    else if (r.status === 'in_progress') inProgress = r.count;
    else if (r.status === 'done') done = r.count;
  }
  return {
    totalPatients, waiting, inProgress, done,
    totalRevenue: billRows[0]?.total ?? 0, totalBills: billRows[0]?.count ?? 0,
  };
}

// ── Appointments ──────────────────────────────────────────────────────────────

export async function listAppointments(tenantId: string, date: string): Promise<ClinicAppointment[]> {
  const db = await getDb();
  return db.select<any[]>(
    `SELECT * FROM clinic_appointments WHERE tenant_id = ? AND appointment_date = ? AND deleted_at IS NULL ORDER BY appointment_time ASC`,
    [tenantId, date]
  );
}

export async function listUpcomingAppointments(tenantId: string, limit = 10): Promise<ClinicAppointment[]> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  return db.select<any[]>(
    `SELECT * FROM clinic_appointments WHERE tenant_id = ? AND appointment_date >= ? AND deleted_at IS NULL AND status NOT IN ('cancelled','completed')
     ORDER BY appointment_date ASC, appointment_time ASC LIMIT ?`,
    [tenantId, today, limit]
  );
}

export async function createAppointment(tenantId: string, data: Omit<ClinicAppointment, 'id' | 'tenant_id' | 'created_at'>): Promise<ClinicAppointment> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO clinic_appointments (id, tenant_id, patient_id, patient_name, patient_phone, doctor_id, doctor_name, appointment_date, appointment_time, type, status, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.patient_id, data.patient_name ?? null, data.patient_phone ?? null,
     data.doctor_id ?? null, data.doctor_name ?? null, data.appointment_date,
     data.appointment_time ?? null, data.type, data.status ?? 'scheduled', data.notes ?? null]
  );
  const rows = await db.select<any[]>(`SELECT * FROM clinic_appointments WHERE id = ?`, [id]);
  return rows[0];
}

export async function updateAppointmentStatus(tenantId: string, id: string, status: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE clinic_appointments SET status = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`, [status, now(), id, tenantId]);
}

// ── Visits ────────────────────────────────────────────────────────────────────

export async function createVisit(tenantId: string, data: {
  patient_id: string; patient_name?: string; doctor_id?: string; doctor_name?: string;
  token_id?: string; chief_complaint?: string; diagnosis?: string; notes?: string;
  follow_up_date?: string; follow_up_notes?: string;
  vitals?: Partial<Omit<ClinicVitals, 'id' | 'visit_id' | 'patient_id' | 'recorded_at' | 'tenant_id'>>;
  prescription_items?: Array<Partial<ClinicPrescriptionItem>>;
  lab_orders?: string[];
  doctor_id_for_rx?: string;
}): Promise<ClinicVisit> {
  const db = await getDb();
  const visitId = uuid();
  const visitDate = new Date().toISOString().slice(0, 10);

  await db.execute(
    `INSERT INTO clinic_visits (id, tenant_id, patient_id, patient_name, doctor_id, doctor_name, token_id, visit_date, chief_complaint, diagnosis, notes, follow_up_date, follow_up_notes, status)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [visitId, tenantId, data.patient_id, data.patient_name ?? null, data.doctor_id ?? null,
     data.doctor_name ?? null, data.token_id ?? null, visitDate,
     data.chief_complaint ?? null, data.diagnosis ?? null, data.notes ?? null,
     data.follow_up_date ?? null, data.follow_up_notes ?? null, 'completed']
  );

  // Vitals
  const v = data.vitals;
  if (v && Object.values(v).some(x => x != null)) {
    await db.execute(
      `INSERT INTO clinic_vitals (id, tenant_id, visit_id, patient_id, bp_systolic, bp_diastolic, pulse, temperature, spo2, weight, height, blood_sugar)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [uuid(), tenantId, visitId, data.patient_id,
       v.bp_systolic ?? null, v.bp_diastolic ?? null, v.pulse ?? null,
       v.temperature ?? null, v.spo2 ?? null, v.weight ?? null,
       v.height ?? null, v.blood_sugar ?? null]
    );
  }

  // Prescription
  if (data.prescription_items && data.prescription_items.length > 0) {
    const rxId = uuid();
    await db.execute(
      `INSERT INTO clinic_prescriptions (id, tenant_id, visit_id, patient_id, doctor_id) VALUES (?,?,?,?,?)`,
      [rxId, tenantId, visitId, data.patient_id, data.doctor_id ?? null]
    );
    for (let i = 0; i < data.prescription_items.length; i++) {
      const item = data.prescription_items[i];
      if (!item.medicine_name?.trim()) continue;
      await db.execute(
        `INSERT INTO clinic_prescription_items (id, tenant_id, prescription_id, medicine_name, dosage, frequency, duration, instructions, quantity, sort_order)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [uuid(), tenantId, rxId, item.medicine_name, item.dosage ?? null, item.frequency ?? null,
         item.duration ?? null, item.instructions ?? null, item.quantity ?? null, i]
      );
    }
  }

  // Lab orders
  if (data.lab_orders && data.lab_orders.length > 0) {
    for (const test of data.lab_orders) {
      await db.execute(
        `INSERT INTO clinic_lab_orders (id, tenant_id, visit_id, patient_id, test_name, status) VALUES (?,?,?,?,?,?)`,
        [uuid(), tenantId, visitId, data.patient_id, test, 'ordered']
      );
    }
  }

  // Update token
  if (data.token_id) {
    await db.execute(
      `UPDATE clinic_tokens SET status = 'done', visit_id = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`,
      [visitId, now(), data.token_id, tenantId]
    );
  }

  const rows = await db.select<any[]>(`SELECT * FROM clinic_visits WHERE id = ?`, [visitId]);
  return rows[0];
}

export async function getVisitWithDetails(tenantId: string, visitId: string): Promise<ClinicVisit | null> {
  const db = await getDb();
  const visits = await db.select<any[]>(`SELECT * FROM clinic_visits WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL`, [visitId, tenantId]);
  if (!visits.length) return null;
  const visit = visits[0];

  const vitals = await db.select<any[]>(`SELECT * FROM clinic_vitals WHERE visit_id = ? ORDER BY recorded_at DESC LIMIT 1`, [visitId]);
  const prescriptions = await db.select<any[]>(`SELECT * FROM clinic_prescriptions WHERE visit_id = ? AND deleted_at IS NULL LIMIT 1`, [visitId]);
  let prescription = null;
  if (prescriptions.length) {
    const items = await db.select<any[]>(`SELECT * FROM clinic_prescription_items WHERE prescription_id = ? ORDER BY sort_order`, [prescriptions[0].id]);
    prescription = { ...prescriptions[0], items };
  }
  const labOrders = await db.select<any[]>(`SELECT * FROM clinic_lab_orders WHERE visit_id = ? AND deleted_at IS NULL ORDER BY ordered_at`, [visitId]);

  return { ...visit, vitals: vitals[0] ?? null, prescription, lab_orders: labOrders.map(mapLabOrder) };
}

export async function updateLabResult(tenantId: string, orderId: string, data: {
  result_value: string; result_unit?: string; reference_range?: string; is_abnormal?: boolean; notes?: string;
}): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE clinic_lab_orders SET result_value=?, result_unit=?, reference_range=?, is_abnormal=?, notes=?, status='resulted', resulted_at=? WHERE id=? AND tenant_id=?`,
    [data.result_value, data.result_unit ?? null, data.reference_range ?? null,
     data.is_abnormal ? 1 : 0, data.notes ?? null, now(), orderId, tenantId]
  );
}

// ── Medicines (Clinic Pharmacy) ───────────────────────────────────────────────

export async function listClinicMedicines(tenantId: string, search = ''): Promise<ClinicMedicine[]> {
  const db = await getDb();
  const cond = search ? `AND (name LIKE ? OR generic_name LIKE ?)` : '';
  const params: any[] = [tenantId];
  if (search) params.push(`%${search}%`, `%${search}%`);
  const rows = await db.select<any[]>(
    `SELECT * FROM clinic_medicines WHERE tenant_id = ? AND deleted_at IS NULL ${cond} ORDER BY name LIMIT 100`,
    params
  );
  return rows.map(mapMedicine);
}

export async function createClinicMedicine(tenantId: string, data: Omit<ClinicMedicine, 'id' | 'tenant_id'>): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO clinic_medicines (id, tenant_id, name, generic_name, form, strength, unit, stock_qty, min_stock_qty, selling_price, cost_price, gst_rate, expiry_date, is_active)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [uuid(), tenantId, data.name, data.generic_name ?? null, data.form ?? null, data.strength ?? null,
     data.unit, data.stock_qty, data.min_stock_qty, data.selling_price, data.cost_price ?? null,
     data.gst_rate, data.expiry_date ?? null, data.is_active ? 1 : 0]
  );
}

export async function dispenseMedicine(tenantId: string, medicineId: string, qty: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE clinic_medicines SET stock_qty = MAX(0, stock_qty - ?), updated_at = ? WHERE id = ? AND tenant_id = ?`,
    [qty, now(), medicineId, tenantId]
  );
}

export async function getLowStockMedicines(tenantId: string): Promise<ClinicMedicine[]> {
  const db = await getDb();
  const rows = await db.select<any[]>(
    `SELECT * FROM clinic_medicines WHERE tenant_id = ? AND deleted_at IS NULL AND stock_qty <= min_stock_qty AND is_active = 1 ORDER BY stock_qty ASC`,
    [tenantId]
  );
  return rows.map(mapMedicine);
}

export async function getExpiringMedicines(tenantId: string, days = 60): Promise<ClinicMedicine[]> {
  const db = await getDb();
  const cutoff = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const rows = await db.select<any[]>(
    `SELECT * FROM clinic_medicines WHERE tenant_id = ? AND deleted_at IS NULL AND expiry_date IS NOT NULL AND expiry_date <= ? AND is_active = 1 ORDER BY expiry_date ASC`,
    [tenantId, cutoff]
  );
  return rows.map(mapMedicine);
}

// ── Beds & IPD ────────────────────────────────────────────────────────────────

export async function listBeds(tenantId: string): Promise<ClinicBed[]> {
  const db = await getDb();
  return db.select<any[]>(`SELECT * FROM clinic_beds WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY ward, bed_no`, [tenantId]);
}

export async function createBed(tenantId: string, data: Omit<ClinicBed, 'id' | 'tenant_id'>): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO clinic_beds (id, tenant_id, ward, room_no, bed_no, bed_type, charges_per_day, status) VALUES (?,?,?,?,?,?,?,?)`,
    [uuid(), tenantId, data.ward, data.room_no ?? null, data.bed_no, data.bed_type, data.charges_per_day, data.status]
  );
}

export async function listAdmissions(tenantId: string, status?: string): Promise<ClinicAdmission[]> {
  const db = await getDb();
  const cond = status ? `AND status = ?` : '';
  const params: any[] = [tenantId];
  if (status) params.push(status);
  return db.select<any[]>(
    `SELECT * FROM clinic_admissions WHERE tenant_id = ? AND deleted_at IS NULL ${cond} ORDER BY admission_date DESC`,
    params
  );
}

export async function admitPatient(tenantId: string, data: {
  patient_id: string; patient_name?: string; bed_id?: string; bed_no?: string; ward?: string;
  doctor_id?: string; doctor_name?: string; diagnosis?: string; notes?: string;
}): Promise<ClinicAdmission> {
  const db = await getDb();
  const id = uuid();
  const today = new Date().toISOString().slice(0, 10);
  await db.execute(
    `INSERT INTO clinic_admissions (id, tenant_id, patient_id, patient_name, bed_id, bed_no, ward, doctor_id, doctor_name, admission_date, diagnosis, notes, status)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.patient_id, data.patient_name ?? null, data.bed_id ?? null,
     data.bed_no ?? null, data.ward ?? null, data.doctor_id ?? null, data.doctor_name ?? null,
     today, data.diagnosis ?? null, data.notes ?? null, 'admitted']
  );
  if (data.bed_id) {
    await db.execute(`UPDATE clinic_beds SET status = 'occupied', updated_at = ? WHERE id = ?`, [now(), data.bed_id]);
  }
  const rows = await db.select<any[]>(`SELECT * FROM clinic_admissions WHERE id = ?`, [id]);
  return rows[0];
}

export async function dischargePatient(tenantId: string, admissionId: string, bedId?: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE clinic_admissions SET status = 'discharged', discharge_date = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`,
    [new Date().toISOString().slice(0, 10), now(), admissionId, tenantId]
  );
  if (bedId) {
    await db.execute(`UPDATE clinic_beds SET status = 'available', updated_at = ? WHERE id = ?`, [now(), bedId]);
  }
}

// ── Billing ───────────────────────────────────────────────────────────────────

export async function createBill(tenantId: string, data: {
  patient_id?: string; patient_name?: string; patient_phone?: string;
  doctor_id?: string; doctor_name?: string;
  visit_id?: string; admission_id?: string; bill_type?: string;
  payment_method: string; discount?: number;
  items: Array<{ description: string; quantity: number; unit_price: number; gst_rate?: number }>;
  notes?: string;
}): Promise<ClinicBill> {
  const db = await getDb();
  const billId = uuid();
  const billNumber = await nextBillNo(tenantId);
  const subtotal = data.items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const discount = data.discount ?? 0;
  const gstAmount = data.items.reduce((s, i) => s + i.quantity * i.unit_price * (i.gst_rate ?? 0) / 100, 0);
  const total = Math.max(0, subtotal - discount + gstAmount);

  await db.execute(
    `INSERT INTO clinic_bills (id, tenant_id, bill_number, patient_id, patient_name, patient_phone, doctor_id, doctor_name, visit_id, admission_id, bill_type, payment_method, payment_status, subtotal, discount, gst_amount, total, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [billId, tenantId, billNumber, data.patient_id ?? null, data.patient_name ?? null,
     data.patient_phone ?? null, data.doctor_id ?? null, data.doctor_name ?? null,
     data.visit_id ?? null, data.admission_id ?? null, data.bill_type ?? 'consultation',
     data.payment_method, 'paid', subtotal, discount, gstAmount, total, data.notes ?? null]
  );

  for (const item of data.items) {
    const lineTotal = item.quantity * item.unit_price;
    await db.execute(
      `INSERT INTO clinic_bill_items (id, tenant_id, bill_id, description, quantity, unit_price, gst_rate, total) VALUES (?,?,?,?,?,?,?,?)`,
      [uuid(), tenantId, billId, item.description, item.quantity, item.unit_price, item.gst_rate ?? 0, lineTotal]
    );
  }

  const rows = await db.select<any[]>(`SELECT * FROM clinic_bills WHERE id = ?`, [billId]);
  return rows[0];
}

export async function listBills(tenantId: string, opts: { date?: string; limit?: number } = {}): Promise<ClinicBill[]> {
  const db = await getDb();
  const cond = opts.date ? `AND created_at LIKE ?` : '';
  const params: any[] = [tenantId];
  if (opts.date) params.push(`${opts.date}%`);
  return db.select<any[]>(
    `SELECT * FROM clinic_bills WHERE tenant_id = ? AND deleted_at IS NULL ${cond} ORDER BY created_at DESC LIMIT ${opts.limit ?? 100}`,
    params
  );
}

// ── Reports ───────────────────────────────────────────────────────────────────

export async function getMonthlyRevenueReport(tenantId: string, months = 6): Promise<Array<{ month: string; revenue: number; bills: number }>> {
  const db = await getDb();
  return db.select<any[]>(
    `SELECT strftime('%Y-%m', created_at) as month, COALESCE(SUM(total),0) as revenue, COUNT(*) as bills
     FROM clinic_bills WHERE tenant_id = ? AND deleted_at IS NULL GROUP BY month ORDER BY month DESC LIMIT ?`,
    [tenantId, months]
  );
}

export async function getDoctorWiseReport(tenantId: string, date: string): Promise<Array<{ doctor_name: string; patients: number; revenue: number }>> {
  const db = await getDb();
  return db.select<any[]>(
    `SELECT doctor_name, COUNT(*) as patients, COALESCE(SUM(total),0) as revenue
     FROM clinic_bills WHERE tenant_id = ? AND created_at LIKE ? AND deleted_at IS NULL AND doctor_name IS NOT NULL
     GROUP BY doctor_name ORDER BY patients DESC`,
    [tenantId, `${date.slice(0,7)}%`]
  );
}

export async function getCommonDiagnoses(tenantId: string): Promise<Array<{ diagnosis: string; count: number }>> {
  const db = await getDb();
  return db.select<any[]>(
    `SELECT diagnosis, COUNT(*) as count FROM clinic_visits WHERE tenant_id = ? AND deleted_at IS NULL AND diagnosis IS NOT NULL AND diagnosis != ''
     GROUP BY LOWER(diagnosis) ORDER BY count DESC LIMIT 10`,
    [tenantId]
  );
}

// [hotel] [all tenants]
import { getDb, uuid, now } from './index';

export interface HotelRoom {
  id: string;
  tenant_id: string;
  number: string;
  type: string;
  floor: number;
  capacity: number;
  rate_weekday: number;
  rate_weekend: number;
  status: string;
  amenities: string;
  notes: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface HotelGuest {
  id: string;
  tenant_id: string;
  name: string;
  phone: string;
  email: string;
  id_proof_type: string;
  id_proof_no: string;
  address: string;
  city: string;
  nationality: string;
  total_stays: number;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface HotelBooking {
  id: string;
  tenant_id: string;
  room_id: string;
  guest_id: string;
  check_in: string;
  check_out: string;
  actual_check_in: string | null;
  actual_check_out: string | null;
  adults: number;
  children: number;
  status: string;
  source: string;
  advance_paid: number;
  special_requests: string;
  booking_ref: string;
  updated_at: string | null;
  deleted_at: string | null;
  // joined fields
  guest_name?: string;
  guest_phone?: string;
  room_number?: string;
  room_type?: string;
}

export interface HotelFolio {
  id: string;
  tenant_id: string;
  booking_id: string;
  total_amount: number;
  paid_amount: number;
  payment_mode: string;
  status: string;
  notes: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface HotelFolioItem {
  id: string;
  tenant_id: string;
  folio_id: string;
  description: string;
  category: string;
  quantity: number;
  rate: number;
  amount: number;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface HotelHousekeeping {
  id: string;
  tenant_id: string;
  room_id: string;
  assigned_to: string;
  status: string;
  date: string;
  notes: string;
  updated_at: string | null;
  deleted_at: string | null;
  room_number?: string;
}

export interface HotelMaintenance {
  id: string;
  tenant_id: string;
  room_id: string;
  issue: string;
  status: string;
  priority: string;
  reported_by: string;
  resolved_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
  room_number?: string;
}

export interface HotelDashboardStats {
  totalRooms: number;
  occupied: number;
  available: number;
  cleaning: number;
  maintenance: number;
  todayArrivals: number;
  todayDepartures: number;
  todayRevenue: number;
  occupancyPct: number;
}

// ─── Rooms ────────────────────────────────────────────────────────────────────

export async function getRooms(tenantId: string): Promise<HotelRoom[]> {
  const db = await getDb();
  return db.select<HotelRoom[]>(
    `SELECT * FROM hotel_rooms WHERE tenant_id=? AND deleted_at IS NULL ORDER BY CAST(number AS INTEGER), number`,
    [tenantId]
  );
}

export async function saveRoom(tenantId: string, data: Partial<HotelRoom> & { number: string; type: string }): Promise<string> {
  const db = await getDb();
  if (data.id) {
    await db.execute(
      `UPDATE hotel_rooms SET number=?,type=?,floor=?,capacity=?,rate_weekday=?,rate_weekend=?,status=?,amenities=?,notes=?,updated_at=? WHERE id=? AND tenant_id=?`,
      [data.number, data.type, data.floor ?? 1, data.capacity ?? 2,
       data.rate_weekday ?? 0, data.rate_weekend ?? 0, data.status ?? 'available',
       data.amenities ?? '', data.notes ?? '', now(), data.id, tenantId]
    );
    return data.id;
  }
  const id = uuid();
  await db.execute(
    `INSERT INTO hotel_rooms(id,tenant_id,number,type,floor,capacity,rate_weekday,rate_weekend,status,amenities,notes,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.number, data.type, data.floor ?? 1, data.capacity ?? 2,
     data.rate_weekday ?? 0, data.rate_weekend ?? 0, data.status ?? 'available',
     data.amenities ?? '', data.notes ?? '', now()]
  );
  return id;
}

export async function deleteRoom(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE hotel_rooms SET deleted_at=?,updated_at=? WHERE id=? AND tenant_id=?`,
    [now(), now(), id, tenantId]
  );
}

export async function updateRoomStatus(tenantId: string, id: string, status: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE hotel_rooms SET status=?,updated_at=? WHERE id=? AND tenant_id=?`,
    [status, now(), id, tenantId]
  );
}

// ─── Guests ───────────────────────────────────────────────────────────────────

export async function getGuests(tenantId: string, search?: string): Promise<HotelGuest[]> {
  const db = await getDb();
  if (search) {
    return db.select<HotelGuest[]>(
      `SELECT * FROM hotel_guests WHERE tenant_id=? AND deleted_at IS NULL AND (name LIKE ? OR phone LIKE ?) ORDER BY name`,
      [tenantId, `%${search}%`, `%${search}%`]
    );
  }
  return db.select<HotelGuest[]>(
    `SELECT * FROM hotel_guests WHERE tenant_id=? AND deleted_at IS NULL ORDER BY name`,
    [tenantId]
  );
}

export async function saveGuest(tenantId: string, data: Partial<HotelGuest> & { name: string }): Promise<string> {
  const db = await getDb();
  if (data.id) {
    await db.execute(
      `UPDATE hotel_guests SET name=?,phone=?,email=?,id_proof_type=?,id_proof_no=?,address=?,city=?,nationality=?,updated_at=? WHERE id=? AND tenant_id=?`,
      [data.name, data.phone ?? '', data.email ?? '', data.id_proof_type ?? '', data.id_proof_no ?? '',
       data.address ?? '', data.city ?? '', data.nationality ?? 'Indian', now(), data.id, tenantId]
    );
    return data.id;
  }
  const id = uuid();
  await db.execute(
    `INSERT INTO hotel_guests(id,tenant_id,name,phone,email,id_proof_type,id_proof_no,address,city,nationality,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.name, data.phone ?? '', data.email ?? '', data.id_proof_type ?? '',
     data.id_proof_no ?? '', data.address ?? '', data.city ?? '', data.nationality ?? 'Indian', now()]
  );
  return id;
}

// ─── Bookings ─────────────────────────────────────────────────────────────────

export async function getBookings(tenantId: string, filters?: { status?: string; dateFrom?: string; dateTo?: string }): Promise<HotelBooking[]> {
  const db = await getDb();
  const conditions = [`b.tenant_id=?`, `b.deleted_at IS NULL`];
  const params: any[] = [tenantId];
  if (filters?.status) { conditions.push(`b.status=?`); params.push(filters.status); }
  if (filters?.dateFrom) { conditions.push(`b.check_in >= ?`); params.push(filters.dateFrom); }
  if (filters?.dateTo) { conditions.push(`b.check_out <= ?`); params.push(filters.dateTo); }
  const where = conditions.join(' AND ');
  return db.select<HotelBooking[]>(
    `SELECT b.*,g.name AS guest_name,g.phone AS guest_phone,r.number AS room_number,r.type AS room_type
     FROM hotel_bookings b
     LEFT JOIN hotel_guests g ON b.guest_id=g.id
     LEFT JOIN hotel_rooms r ON b.room_id=r.id
     WHERE ${where} ORDER BY b.check_in DESC`,
    params
  );
}

export async function saveBooking(tenantId: string, data: Partial<HotelBooking> & { room_id: string; guest_id: string; check_in: string; check_out: string }): Promise<string> {
  const db = await getDb();
  if (data.id) {
    await db.execute(
      `UPDATE hotel_bookings SET room_id=?,guest_id=?,check_in=?,check_out=?,adults=?,children=?,status=?,source=?,advance_paid=?,special_requests=?,booking_ref=?,updated_at=? WHERE id=? AND tenant_id=?`,
      [data.room_id, data.guest_id, data.check_in, data.check_out, data.adults ?? 1, data.children ?? 0,
       data.status ?? 'confirmed', data.source ?? 'direct', data.advance_paid ?? 0,
       data.special_requests ?? '', data.booking_ref ?? '', now(), data.id, tenantId]
    );
    return data.id;
  }
  const id = uuid();
  const ref = 'BK' + Date.now().toString().slice(-6);
  await db.execute(
    `INSERT INTO hotel_bookings(id,tenant_id,room_id,guest_id,check_in,check_out,adults,children,status,source,advance_paid,special_requests,booking_ref,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.room_id, data.guest_id, data.check_in, data.check_out,
     data.adults ?? 1, data.children ?? 0, data.status ?? 'confirmed', data.source ?? 'direct',
     data.advance_paid ?? 0, data.special_requests ?? '', data.booking_ref || ref, now()]
  );
  return id;
}

export async function updateBookingStatus(tenantId: string, id: string, status: string, actualDate?: string): Promise<void> {
  const db = await getDb();
  if (status === 'checked_in') {
    await db.execute(
      `UPDATE hotel_bookings SET status=?,actual_check_in=?,updated_at=? WHERE id=? AND tenant_id=?`,
      [status, actualDate ?? now(), now(), id, tenantId]
    );
  } else if (status === 'checked_out') {
    await db.execute(
      `UPDATE hotel_bookings SET status=?,actual_check_out=?,updated_at=? WHERE id=? AND tenant_id=?`,
      [status, actualDate ?? now(), now(), id, tenantId]
    );
  } else {
    await db.execute(
      `UPDATE hotel_bookings SET status=?,updated_at=? WHERE id=? AND tenant_id=?`,
      [status, now(), id, tenantId]
    );
  }
}

export async function getTodayArrivals(tenantId: string): Promise<HotelBooking[]> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  return db.select<HotelBooking[]>(
    `SELECT b.*,g.name AS guest_name,g.phone AS guest_phone,r.number AS room_number,r.type AS room_type
     FROM hotel_bookings b
     LEFT JOIN hotel_guests g ON b.guest_id=g.id
     LEFT JOIN hotel_rooms r ON b.room_id=r.id
     WHERE b.tenant_id=? AND b.deleted_at IS NULL AND b.check_in=? AND b.status IN ('confirmed','checked_in')
     ORDER BY b.check_in`,
    [tenantId, today]
  );
}

export async function getTodayDepartures(tenantId: string): Promise<HotelBooking[]> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  return db.select<HotelBooking[]>(
    `SELECT b.*,g.name AS guest_name,g.phone AS guest_phone,r.number AS room_number,r.type AS room_type
     FROM hotel_bookings b
     LEFT JOIN hotel_guests g ON b.guest_id=g.id
     LEFT JOIN hotel_rooms r ON b.room_id=r.id
     WHERE b.tenant_id=? AND b.deleted_at IS NULL AND b.check_out=? AND b.status='checked_in'
     ORDER BY b.check_out`,
    [tenantId, today]
  );
}

export async function getOccupiedRooms(tenantId: string): Promise<HotelBooking[]> {
  const db = await getDb();
  return db.select<HotelBooking[]>(
    `SELECT b.*,g.name AS guest_name,g.phone AS guest_phone,r.number AS room_number,r.type AS room_type
     FROM hotel_bookings b
     LEFT JOIN hotel_guests g ON b.guest_id=g.id
     LEFT JOIN hotel_rooms r ON b.room_id=r.id
     WHERE b.tenant_id=? AND b.deleted_at IS NULL AND b.status='checked_in'`,
    [tenantId]
  );
}

// ─── Folios ───────────────────────────────────────────────────────────────────

export async function getFolio(tenantId: string, bookingId: string): Promise<HotelFolio> {
  const db = await getDb();
  const rows = await db.select<HotelFolio[]>(
    `SELECT * FROM hotel_folios WHERE tenant_id=? AND booking_id=? AND deleted_at IS NULL LIMIT 1`,
    [tenantId, bookingId]
  );
  if (rows.length) return rows[0];
  // Create folio
  const id = uuid();
  await db.execute(
    `INSERT INTO hotel_folios(id,tenant_id,booking_id,updated_at) VALUES(?,?,?,?)`,
    [id, tenantId, bookingId, now()]
  );
  const created = await db.select<HotelFolio[]>(`SELECT * FROM hotel_folios WHERE id=?`, [id]);
  return created[0];
}

export async function addFolioItem(tenantId: string, folioId: string, item: { description: string; category?: string; quantity?: number; rate: number }): Promise<void> {
  const db = await getDb();
  const qty = item.quantity ?? 1;
  const amount = qty * item.rate;
  const id = uuid();
  await db.execute(
    `INSERT INTO hotel_folio_items(id,tenant_id,folio_id,description,category,quantity,rate,amount,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, folioId, item.description, item.category ?? 'room', qty, item.rate, amount, now()]
  );
  // Recalculate folio total
  await _recalcFolioTotal(tenantId, folioId);
}

export async function getFolioItems(tenantId: string, folioId: string): Promise<HotelFolioItem[]> {
  const db = await getDb();
  return db.select<HotelFolioItem[]>(
    `SELECT * FROM hotel_folio_items WHERE tenant_id=? AND folio_id=? AND deleted_at IS NULL ORDER BY rowid`,
    [tenantId, folioId]
  );
}

export async function deleteFolioItem(tenantId: string, itemId: string, folioId: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE hotel_folio_items SET deleted_at=?,updated_at=? WHERE id=? AND tenant_id=?`,
    [now(), now(), itemId, tenantId]
  );
  await _recalcFolioTotal(tenantId, folioId);
}

async function _recalcFolioTotal(tenantId: string, folioId: string): Promise<void> {
  const db = await getDb();
  const [{ total }] = await db.select<{ total: number }[]>(
    `SELECT COALESCE(SUM(amount),0) as total FROM hotel_folio_items WHERE folio_id=? AND tenant_id=? AND deleted_at IS NULL`,
    [folioId, tenantId]
  );
  await db.execute(
    `UPDATE hotel_folios SET total_amount=?,updated_at=? WHERE id=? AND tenant_id=?`,
    [total, now(), folioId, tenantId]
  );
}

export async function updateFolioPayment(tenantId: string, folioId: string, paid: number, mode: string): Promise<void> {
  const db = await getDb();
  const folios = await db.select<HotelFolio[]>(`SELECT * FROM hotel_folios WHERE id=? AND tenant_id=?`, [folioId, tenantId]);
  if (!folios.length) return;
  const folio = folios[0];
  const newPaid = folio.paid_amount + paid;
  const status = newPaid >= folio.total_amount ? 'settled' : 'open';
  await db.execute(
    `UPDATE hotel_folios SET paid_amount=?,payment_mode=?,status=?,updated_at=? WHERE id=? AND tenant_id=?`,
    [newPaid, mode, status, now(), folioId, tenantId]
  );
}

// ─── Housekeeping ─────────────────────────────────────────────────────────────

export async function getHousekeepingTasks(tenantId: string, date: string): Promise<HotelHousekeeping[]> {
  const db = await getDb();
  return db.select<HotelHousekeeping[]>(
    `SELECT h.*,r.number AS room_number FROM hotel_housekeeping h
     LEFT JOIN hotel_rooms r ON h.room_id=r.id
     WHERE h.tenant_id=? AND h.date=? AND h.deleted_at IS NULL
     ORDER BY r.number`,
    [tenantId, date]
  );
}

export async function saveHousekeepingTask(tenantId: string, data: Partial<HotelHousekeeping> & { room_id: string; date: string }): Promise<string> {
  const db = await getDb();
  if (data.id) {
    await db.execute(
      `UPDATE hotel_housekeeping SET room_id=?,assigned_to=?,status=?,date=?,notes=?,updated_at=? WHERE id=? AND tenant_id=?`,
      [data.room_id, data.assigned_to ?? '', data.status ?? 'dirty', data.date, data.notes ?? '', now(), data.id, tenantId]
    );
    return data.id;
  }
  const id = uuid();
  await db.execute(
    `INSERT INTO hotel_housekeeping(id,tenant_id,room_id,assigned_to,status,date,notes,updated_at) VALUES(?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.room_id, data.assigned_to ?? '', data.status ?? 'dirty', data.date, data.notes ?? '', now()]
  );
  return id;
}

// ─── Maintenance ──────────────────────────────────────────────────────────────

export async function getMaintenanceLog(tenantId: string, status?: string): Promise<HotelMaintenance[]> {
  const db = await getDb();
  const conditions = [`m.tenant_id=?`, `m.deleted_at IS NULL`];
  const params: any[] = [tenantId];
  if (status) { conditions.push(`m.status=?`); params.push(status); }
  return db.select<HotelMaintenance[]>(
    `SELECT m.*,r.number AS room_number FROM hotel_maintenance m
     LEFT JOIN hotel_rooms r ON m.room_id=r.id
     WHERE ${conditions.join(' AND ')} ORDER BY CASE m.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END, m.updated_at DESC`,
    params
  );
}

export async function saveMaintenanceItem(tenantId: string, data: Partial<HotelMaintenance> & { room_id: string; issue: string }): Promise<string> {
  const db = await getDb();
  if (data.id) {
    await db.execute(
      `UPDATE hotel_maintenance SET room_id=?,issue=?,status=?,priority=?,reported_by=?,resolved_at=?,updated_at=? WHERE id=? AND tenant_id=?`,
      [data.room_id, data.issue, data.status ?? 'open', data.priority ?? 'normal',
       data.reported_by ?? '', data.resolved_at ?? null, now(), data.id, tenantId]
    );
    return data.id;
  }
  const id = uuid();
  await db.execute(
    `INSERT INTO hotel_maintenance(id,tenant_id,room_id,issue,status,priority,reported_by,updated_at) VALUES(?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.room_id, data.issue, data.status ?? 'open', data.priority ?? 'normal', data.reported_by ?? '', now()]
  );
  return id;
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export async function getDashboardStats(tenantId: string): Promise<HotelDashboardStats> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);

  const [{ totalRooms }] = await db.select<{ totalRooms: number }[]>(
    `SELECT COUNT(*) as totalRooms FROM hotel_rooms WHERE tenant_id=? AND deleted_at IS NULL`, [tenantId]
  );
  const [{ occupied }] = await db.select<{ occupied: number }[]>(
    `SELECT COUNT(*) as occupied FROM hotel_rooms WHERE tenant_id=? AND deleted_at IS NULL AND status='occupied'`, [tenantId]
  );
  const [{ available }] = await db.select<{ available: number }[]>(
    `SELECT COUNT(*) as available FROM hotel_rooms WHERE tenant_id=? AND deleted_at IS NULL AND status='available'`, [tenantId]
  );
  const [{ cleaning }] = await db.select<{ cleaning: number }[]>(
    `SELECT COUNT(*) as cleaning FROM hotel_rooms WHERE tenant_id=? AND deleted_at IS NULL AND status='cleaning'`, [tenantId]
  );
  const [{ maintenance }] = await db.select<{ maintenance: number }[]>(
    `SELECT COUNT(*) as maintenance FROM hotel_rooms WHERE tenant_id=? AND deleted_at IS NULL AND status='maintenance'`, [tenantId]
  );
  const [{ todayArrivals }] = await db.select<{ todayArrivals: number }[]>(
    `SELECT COUNT(*) as todayArrivals FROM hotel_bookings WHERE tenant_id=? AND deleted_at IS NULL AND check_in=? AND status IN ('confirmed','checked_in')`, [tenantId, today]
  );
  const [{ todayDepartures }] = await db.select<{ todayDepartures: number }[]>(
    `SELECT COUNT(*) as todayDepartures FROM hotel_bookings WHERE tenant_id=? AND deleted_at IS NULL AND check_out=? AND status='checked_in'`, [tenantId, today]
  );
  const [{ todayRevenue }] = await db.select<{ todayRevenue: number }[]>(
    `SELECT COALESCE(SUM(fi.amount),0) as todayRevenue FROM hotel_folio_items fi
     JOIN hotel_folios f ON fi.folio_id=f.id
     JOIN hotel_bookings b ON f.booking_id=b.id
     WHERE fi.tenant_id=? AND fi.deleted_at IS NULL AND fi.category='room' AND DATE(fi.updated_at)=?`,
    [tenantId, today]
  );

  return {
    totalRooms, occupied, available, cleaning, maintenance,
    todayArrivals, todayDepartures, todayRevenue,
    occupancyPct: totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0,
  };
}

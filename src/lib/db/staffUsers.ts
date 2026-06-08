// [core] [all apps] [all tenants]
// Staff logins under the same tenant — the owner creates a username+password
// from Settings, we approve from the admin panel, and only then can that login
// sign in locally. Same hash/salt scheme as app_auth — the password never
// leaves the device; only the username + a request id are sent for approval.
import { getDb, uuid, now } from './index';
import { hashPassword, randomSalt, hasAuth, getAuthUsername } from './auth';
import { getCloudSyncStatus } from './cloudSync';
import { enqueue } from '../syncQueue';

const SERVER = 'https://update.frontstores.com';

const _memLock = new Map<string, { count: number; lockedUntil: number }>();

function _lockKey(tenantId: string, username: string) { return `${tenantId}::${username}`; }

function _checkMem(key: string): { locked: boolean; lockedUntil?: string } {
  const m = _memLock.get(key);
  if (!m || Date.now() >= m.lockedUntil) return { locked: false };
  return { locked: true, lockedUntil: new Date(m.lockedUntil).toISOString() };
}

function _recordMemAttempt(key: string, max: number): { locked: boolean; lockedUntil?: string } {
  const m = _memLock.get(key) || { count: 0, lockedUntil: 0 };
  m.count += 1;
  if (m.count >= max) m.lockedUntil = Date.now() + 30 * 60 * 1000;
  _memLock.set(key, m);
  return m.lockedUntil > Date.now() ? { locked: true, lockedUntil: new Date(m.lockedUntil).toISOString() } : { locked: false };
}

function _clearMem(key: string) { _memLock.delete(key); }

export interface StaffUser {
  id: string;
  tenant_id: string;
  username: string;
  password_hash: string;
  salt: string;
  status: 'pending' | 'approved' | 'rejected';
  request_id: string | null;
  failed_attempts: number;
  locked_until: string | null;
  requested_at: string;
  approved_at: string | null;
  updated_at: string;
}

export async function listStaffUsers(tenantId: string): Promise<StaffUser[]> {
  const db = await getDb();
  return db.select<StaffUser[]>(
    `SELECT * FROM staff_users WHERE tenant_id = ? ORDER BY requested_at DESC`,
    [tenantId]
  );
}

// Owner creates a staff login request — stored locally as 'pending' and queued
// for admin approval. Becomes usable for login only once approved.
export async function requestStaffUser(
  tenantId: string, username: string, password: string
): Promise<{ ok: boolean; error?: string }> {
  const cleanUsername = username.trim().toLowerCase();
  if (cleanUsername.length < 3) return { ok: false, error: 'Username must be at least 3 characters' };
  if (password.length < 4) return { ok: false, error: 'Password must be at least 4 characters' };

  // Staff logins ride on Cloud Sync to reach other devices (the credential row
  // syncs down via the generic table sync) — without it, a staff member could
  // never log in from anywhere but the owner's own machine.
  const syncStatus = await getCloudSyncStatus();
  if (!syncStatus.enabled) {
    return { ok: false, error: 'Enable Cloud Sync first (Settings → Cloud Sync) so staff can also log in from other devices' };
  }

  const db = await getDb();

  const ownerUsername = await getAuthUsername(tenantId);
  if (ownerUsername === cleanUsername) return { ok: false, error: 'That username is already in use' };

  const dupes = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM staff_users WHERE tenant_id = ? AND username = ? AND status != 'rejected'`,
    [tenantId, cleanUsername]
  );
  if ((dupes[0]?.count ?? 0) > 0) return { ok: false, error: 'That username is already in use' };

  const salt = randomSalt();
  const hash = await hashPassword(password, salt);
  const id = uuid();
  const requestId = uuid();

  await db.execute(
    `INSERT INTO staff_users (id, tenant_id, username, password_hash, salt, status, request_id, failed_attempts, requested_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, 0, ?, ?)`,
    [id, tenantId, cleanUsername, hash, salt, requestId, now(), now()]
  );

  await enqueue('staff_user_request', tenantId, { tenant_id: tenantId, request_id: requestId, username: cleanUsername });

  return { ok: true };
}

// Owner removes/revokes a staff login (soft — keeps the row for history)
export async function removeStaffUser(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE staff_users SET status = 'rejected', updated_at = ? WHERE id = ? AND tenant_id = ?`,
    [now(), id, tenantId]
  );
}

// Ask the server which pending requests have been approved/rejected and update locally
export async function refreshStaffUserApprovals(tenantId: string): Promise<void> {
  const db = await getDb();
  const pending = await db.select<{ id: string; request_id: string | null }[]>(
    `SELECT id, request_id FROM staff_users WHERE tenant_id = ? AND status = 'pending' AND request_id IS NOT NULL`,
    [tenantId]
  );
  if (pending.length === 0) return;

  try {
    const res = await fetch(`${SERVER}/staff-user-status/${tenantId}`, { signal: AbortSignal.timeout(8000) });
    const data = await res.json() as { ok: boolean; requests?: Record<string, { status: string }> };
    if (!data.ok || !data.requests) return;

    for (const row of pending) {
      const remote = row.request_id ? data.requests[row.request_id] : null;
      if (!remote) continue;
      if (remote.status === 'approved') {
        await db.execute(
          `UPDATE staff_users SET status = 'approved', approved_at = ?, updated_at = ? WHERE id = ?`,
          [now(), now(), row.id]
        );
      } else if (remote.status === 'rejected') {
        await db.execute(
          `UPDATE staff_users SET status = 'rejected', updated_at = ? WHERE id = ?`,
          [now(), row.id]
        );
      }
    }
  } catch { /* offline — try again next time */ }
}

export async function verifyStaffAuth(
  tenantId: string,
  username: string,
  password: string,
  maxAttempts: number = 5
): Promise<{ ok: boolean; locked?: boolean; lockedUntil?: string; attemptsLeft?: number }> {
  const cleanUsername = username.trim().toLowerCase();
  const key = _lockKey(tenantId, cleanUsername);
  const db = await getDb();
  const rows = await db.select<StaffUser[]>(
    `SELECT * FROM staff_users WHERE tenant_id = ? AND username = ? AND status = 'approved' LIMIT 1`,
    [tenantId, cleanUsername]
  );
  const staff = rows[0];
  if (!staff) return { ok: false };

  const memState = _checkMem(key);
  if (memState.locked) return { ok: false, locked: true, lockedUntil: memState.lockedUntil };

  if (staff.locked_until && new Date(staff.locked_until) > new Date()) {
    const ts = new Date(staff.locked_until).getTime();
    _memLock.set(key, { count: maxAttempts, lockedUntil: ts });
    return { ok: false, locked: true, lockedUntil: staff.locked_until };
  }

  const hash = await hashPassword(password, staff.salt);
  if (hash !== staff.password_hash) {
    const newAttempts = (staff.failed_attempts ?? 0) + 1;
    const memResult = _recordMemAttempt(key, maxAttempts);
    if (newAttempts >= maxAttempts || memResult.locked) {
      const lockUntil = memResult.lockedUntil || new Date(Date.now() + 30 * 60 * 1000).toISOString();
      await db.execute(
        `UPDATE staff_users SET failed_attempts = ?, locked_until = ?, updated_at = ? WHERE id = ?`,
        [newAttempts, lockUntil, now(), staff.id]
      );
      return { ok: false, locked: true, lockedUntil: lockUntil };
    }
    await db.execute(
      `UPDATE staff_users SET failed_attempts = ?, updated_at = ? WHERE id = ?`,
      [newAttempts, now(), staff.id]
    );
    return { ok: false, attemptsLeft: maxAttempts - newAttempts };
  }

  _clearMem(key);
  await db.execute(
    `UPDATE staff_users SET failed_attempts = 0, locked_until = NULL, updated_at = ? WHERE id = ?`,
    [now(), staff.id]
  );
  return { ok: true };
}

// True if `username` is a staff login (not the owner) for this tenant — used to
// hide owner-only sections (e.g. "Staff Logins" management) from staff accounts
export async function isStaffUsername(tenantId: string, username: string): Promise<boolean> {
  if (await hasAuth(tenantId)) {
    const ownerUsername = await getAuthUsername(tenantId);
    if (ownerUsername === username.trim().toLowerCase()) return false;
  }
  const db = await getDb();
  const rows = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM staff_users WHERE tenant_id = ? AND username = ? AND status = 'approved'`,
    [tenantId, username.trim().toLowerCase()]
  );
  return (rows[0]?.count ?? 0) > 0;
}

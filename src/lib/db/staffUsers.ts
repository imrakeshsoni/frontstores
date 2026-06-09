// [core] [all apps] [all tenants]
// Staff users v2 — owner creates staff from Settings, auto-approved (no admin needed).
// Server is notified of every create/deactivate for billing & audit tracking.
// Users can never be deleted — only deactivated. Password hash never leaves the device.
import { getDb, uuid, now } from './index';
import { hashPassword, randomSalt, hasAuth, getAuthUsername } from './auth';
import { getOrCreateShopCode } from './config';

const SERVER = 'https://update.frontstores.com';

// ── In-memory brute-force protection ────────────────────────────────────────
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

// ── Types ────────────────────────────────────────────────────────────────────
export interface StaffUser {
  id: string;
  tenant_id: string;
  username: string;
  password_hash: string;
  salt: string;
  display_name: string;
  role: string;
  tab_access: string; // JSON array string
  join_pin_hash: string | null;
  pin_salt: string | null;
  pin_expires_at: string | null;
  pin_used_at: string | null;
  status: 'pending' | 'approved' | 'rejected';
  failed_attempts: number;
  locked_until: string | null;
  requested_at: string;
  approved_at: string | null;
  deactivated_at: string | null;
  updated_at: string;
}

// ── Read ─────────────────────────────────────────────────────────────────────
export async function listStaffUsers(tenantId: string): Promise<StaffUser[]> {
  const db = await getDb();
  return db.select<StaffUser[]>(
    `SELECT * FROM staff_users WHERE tenant_id = ? ORDER BY requested_at DESC`,
    [tenantId]
  );
}

export async function countActiveStaffUsers(tenantId: string): Promise<number> {
  const db = await getDb();
  const rows = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM staff_users WHERE tenant_id = ? AND deactivated_at IS NULL`,
    [tenantId]
  );
  return rows[0]?.count ?? 0;
}

// ── Create ───────────────────────────────────────────────────────────────────
export async function createStaffUser(
  tenantId: string,
  displayName: string,
  username: string,
  password: string,
  role: string,
  tabAccess: string[]
): Promise<{ ok: boolean; joinPin?: string; error?: string }> {
  const cleanUsername = username.trim().toLowerCase();
  if (displayName.trim().length < 2) return { ok: false, error: 'Display name must be at least 2 characters' };
  if (cleanUsername.length < 3) return { ok: false, error: 'Username must be at least 3 characters' };
  if (password.length < 4) return { ok: false, error: 'Password must be at least 4 characters' };

  const ownerUsername = await getAuthUsername(tenantId);
  if (ownerUsername === cleanUsername) return { ok: false, error: 'That username is already in use' };

  const db = await getDb();
  const dupes = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM staff_users WHERE tenant_id = ? AND username = ? AND deactivated_at IS NULL`,
    [tenantId, cleanUsername]
  );
  if ((dupes[0]?.count ?? 0) > 0) return { ok: false, error: 'That username is already in use' };

  const salt = randomSalt();
  const hash = await hashPassword(password, salt);
  const id = uuid();

  const { pinHash, pinSalt, plainPin } = await _generatePin();
  const pinExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  await db.execute(
    `INSERT INTO staff_users
      (id, tenant_id, username, password_hash, salt, display_name, role, tab_access,
       join_pin_hash, pin_salt, pin_expires_at, status, failed_attempts, requested_at, approved_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', 0, ?, ?, ?)`,
    [id, tenantId, cleanUsername, hash, salt,
     displayName.trim(), role.trim(), JSON.stringify(tabAccess),
     pinHash, pinSalt, pinExpiresAt,
     now(), now(), now()]
  );

  // Notify server for billing/audit — fire-and-forget (include shop_code for join flow)
  const db2 = await getDb();
  const cfgRows = await db2.select<{ shop_type: string; shop_code: string | null }[]>(
    `SELECT shop_type, shop_code FROM app_config WHERE tenant_id = ? LIMIT 1`, [tenantId]
  );
  const shopType = cfgRows[0]?.shop_type ?? '';
  const shopCode = cfgRows[0]?.shop_code ?? await getOrCreateShopCode(tenantId, shopType);
  _notifyCreate(tenantId, id, displayName.trim(), cleanUsername, role.trim(), tabAccess, shopCode).catch(() => {});

  return { ok: true, joinPin: plainPin };
}

// ── Generate / Refresh Join PIN ───────────────────────────────────────────────
export async function generateJoinPin(tenantId: string, staffId: string): Promise<{ ok: boolean; joinPin?: string; error?: string }> {
  const db = await getDb();
  const rows = await db.select<{ id: string }[]>(
    `SELECT id FROM staff_users WHERE id = ? AND tenant_id = ? AND deactivated_at IS NULL`,
    [staffId, tenantId]
  );
  if (!rows[0]) return { ok: false, error: 'Staff user not found' };

  const { pinHash, pinSalt, plainPin } = await _generatePin();
  const pinExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  await db.execute(
    `UPDATE staff_users SET join_pin_hash = ?, pin_salt = ?, pin_expires_at = ?, pin_used_at = NULL, updated_at = ?
     WHERE id = ? AND tenant_id = ?`,
    [pinHash, pinSalt, pinExpiresAt, now(), staffId, tenantId]
  );
  return { ok: true, joinPin: plainPin };
}

// ── Deactivate (no delete) ────────────────────────────────────────────────────
export async function deactivateStaffUser(tenantId: string, staffId: string): Promise<{ ok: boolean; error?: string }> {
  const db = await getDb();
  const rows = await db.select<{ id: string; display_name: string; username: string }[]>(
    `SELECT id, display_name, username FROM staff_users WHERE id = ? AND tenant_id = ? AND deactivated_at IS NULL`,
    [staffId, tenantId]
  );
  if (!rows[0]) return { ok: false, error: 'Staff user not found or already deactivated' };

  await db.execute(
    `UPDATE staff_users SET deactivated_at = ?, status = 'rejected', updated_at = ? WHERE id = ? AND tenant_id = ?`,
    [now(), now(), staffId, tenantId]
  );

  _notifyDeactivate(tenantId, staffId, rows[0].display_name, rows[0].username).catch(() => {});
  return { ok: true };
}

// ── Join PIN verification (used when staff joins on a new device) ─────────────
export async function verifyJoinPin(
  tenantId: string,
  pin: string
): Promise<{ ok: boolean; staffId?: string; username?: string; error?: string }> {
  const db = await getDb();
  const rows = await db.select<StaffUser[]>(
    `SELECT * FROM staff_users
     WHERE tenant_id = ? AND pin_used_at IS NULL AND deactivated_at IS NULL
       AND pin_expires_at > datetime('now')`,
    [tenantId]
  );

  for (const staff of rows) {
    if (!staff.join_pin_hash || !staff.pin_salt) continue;
    const hash = await hashPassword(pin, staff.pin_salt);
    if (hash === staff.join_pin_hash) {
      await db.execute(
        `UPDATE staff_users SET pin_used_at = ?, updated_at = ? WHERE id = ?`,
        [now(), now(), staff.id]
      );
      return { ok: true, staffId: staff.id, username: staff.username };
    }
  }
  return { ok: false, error: 'Invalid or expired PIN' };
}

// ── Verify login ─────────────────────────────────────────────────────────────
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
    `SELECT * FROM staff_users WHERE tenant_id = ? AND username = ? AND status = 'approved' AND deactivated_at IS NULL LIMIT 1`,
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

// Returns allowed tabs for the logged-in staff user (empty array = all tabs for owner)
export async function getStaffTabAccess(tenantId: string, username: string): Promise<string[] | null> {
  const cleanUsername = username.trim().toLowerCase();
  if (await hasAuth(tenantId)) {
    const ownerUsername = await getAuthUsername(tenantId);
    if (ownerUsername === cleanUsername) return null; // null = owner, no restrictions
  }
  const db = await getDb();
  const rows = await db.select<{ tab_access: string }[]>(
    `SELECT tab_access FROM staff_users WHERE tenant_id = ? AND username = ? AND status = 'approved' AND deactivated_at IS NULL LIMIT 1`,
    [tenantId, cleanUsername]
  );
  if (!rows[0]) return [];
  try { return JSON.parse(rows[0].tab_access) as string[]; } catch { return []; }
}

// True if username belongs to a staff account (not the owner)
export async function isStaffUsername(tenantId: string, username: string): Promise<boolean> {
  if (await hasAuth(tenantId)) {
    const ownerUsername = await getAuthUsername(tenantId);
    if (ownerUsername === username.trim().toLowerCase()) return false;
  }
  const db = await getDb();
  const rows = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM staff_users WHERE tenant_id = ? AND username = ? AND status = 'approved' AND deactivated_at IS NULL`,
    [tenantId, username.trim().toLowerCase()]
  );
  return (rows[0]?.count ?? 0) > 0;
}

// ── Internal helpers ──────────────────────────────────────────────────────────
async function _generatePin(): Promise<{ pinHash: string; pinSalt: string; plainPin: string }> {
  const digits = Array.from(crypto.getRandomValues(new Uint8Array(8))).map(b => b % 10).join('');
  const plainPin = `${digits.slice(0, 4)}-${digits.slice(4)}`;
  const pinSalt = randomSalt();
  const pinHash = await hashPassword(plainPin.replace('-', ''), pinSalt);
  return { pinHash, pinSalt, plainPin };
}

async function _notifyCreate(
  tenantId: string, staffId: string, displayName: string, username: string, role: string, tabAccess: string[], shopCode: string
): Promise<void> {
  try {
    await fetch(`${SERVER}/staff-user-create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId, shop_code: shopCode, staff_id: staffId, display_name: displayName, username, role, tab_access: tabAccess, created_at: now() }),
      signal: AbortSignal.timeout(8000),
    });
  } catch { /* offline — server will see it on next cloud sync push */ }
}

async function _notifyDeactivate(
  tenantId: string, staffId: string, displayName: string, username: string
): Promise<void> {
  try {
    await fetch(`${SERVER}/staff-user-deactivate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId, staff_id: staffId, display_name: displayName, username, deactivated_at: now() }),
      signal: AbortSignal.timeout(8000),
    });
  } catch { /* offline — server will see it on next cloud sync push */ }
}

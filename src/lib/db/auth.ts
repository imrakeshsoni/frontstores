import { getDb, uuid, now } from './index';

// In-memory lockout tracking — survives DB edits within a session.
// A user editing SQLite to clear locked_until or reset failed_attempts
// cannot bypass this because it lives in process memory, not on disk.
const _memLock = new Map<string, { count: number; lockedUntil: number }>();

function _checkMem(tenantId: string): { locked: boolean; lockedUntil?: string } {
  const m = _memLock.get(tenantId);
  if (!m || Date.now() >= m.lockedUntil) return { locked: false };
  return { locked: true, lockedUntil: new Date(m.lockedUntil).toISOString() };
}

function _recordMemAttempt(tenantId: string, max: number): { locked: boolean; lockedUntil?: string } {
  const m = _memLock.get(tenantId) || { count: 0, lockedUntil: 0 };
  m.count += 1;
  if (m.count >= max) m.lockedUntil = Date.now() + 30 * 60 * 1000;
  _memLock.set(tenantId, m);
  return m.lockedUntil > Date.now() ? { locked: true, lockedUntil: new Date(m.lockedUntil).toISOString() } : { locked: false };
}

function _clearMem(tenantId: string) { _memLock.delete(tenantId); }

export interface AppAuth {
  id: string;
  tenant_id: string;
  username: string;
  password_hash: string;
  salt: string;
  failed_attempts: number;
  locked_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExportLog {
  id: string;
  tenant_id: string;
  export_type: string;
  row_count: number;
  exported_at: string;
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomSalt(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hasAuth(tenantId: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db.select<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM app_auth WHERE tenant_id = ?', [tenantId]
  );
  return (rows[0]?.count ?? 0) > 0;
}

export async function getAuthUsername(tenantId: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db.select<{ username: string }[]>(
    'SELECT username FROM app_auth WHERE tenant_id = ? LIMIT 1', [tenantId]
  );
  return rows[0]?.username ?? null;
}

export async function createAuth(tenantId: string, username: string, password: string): Promise<void> {
  if (password.length < 4) throw new Error('Password must be at least 4 characters');
  const db = await getDb();
  const salt = randomSalt();
  const hash = await hashPassword(password, salt);
  await db.execute(
    `INSERT INTO app_auth (id, tenant_id, username, password_hash, salt, failed_attempts, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
    [uuid(), tenantId, username.trim().toLowerCase(), hash, salt, now(), now()]
  );
}

export async function verifyAuth(
  tenantId: string,
  username: string,
  password: string,
  maxAttempts: number = 5
): Promise<{ ok: boolean; locked?: boolean; lockedUntil?: string; attemptsLeft?: number }> {
  const db = await getDb();
  const rows = await db.select<AppAuth[]>(
    'SELECT * FROM app_auth WHERE tenant_id = ? LIMIT 1', [tenantId]
  );
  const auth = rows[0];
  if (!auth) return { ok: false };

  // In-memory check first — cannot be bypassed by editing SQLite
  const memState = _checkMem(tenantId);
  if (memState.locked) return { ok: false, locked: true, lockedUntil: memState.lockedUntil };

  // DB check (catches lockouts from previous sessions)
  if (auth.locked_until && new Date(auth.locked_until) > new Date()) {
    // Mirror into memory so current session is also blocked
    const ts = new Date(auth.locked_until).getTime();
    _memLock.set(tenantId, { count: maxAttempts, lockedUntil: ts });
    return { ok: false, locked: true, lockedUntil: auth.locked_until };
  }

  // Username must match
  if (auth.username !== username.trim().toLowerCase()) {
    _recordMemAttempt(tenantId, maxAttempts);
    return { ok: false };
  }

  const hash = await hashPassword(password, auth.salt);
  if (hash !== auth.password_hash) {
    const newAttempts = (auth.failed_attempts ?? 0) + 1;
    const memResult = _recordMemAttempt(tenantId, maxAttempts);
    if (newAttempts >= maxAttempts || memResult.locked) {
      const lockUntil = memResult.lockedUntil || new Date(Date.now() + 30 * 60 * 1000).toISOString();
      await db.execute(
        'UPDATE app_auth SET failed_attempts = ?, locked_until = ?, updated_at = ? WHERE tenant_id = ?',
        [newAttempts, lockUntil, now(), tenantId]
      );
      return { ok: false, locked: true, lockedUntil: lockUntil };
    }
    await db.execute(
      'UPDATE app_auth SET failed_attempts = ?, updated_at = ? WHERE tenant_id = ?',
      [newAttempts, now(), tenantId]
    );
    return { ok: false };
  }

  // Correct password — reset both in-memory and DB counters
  _clearMem(tenantId);
  await db.execute(
    'UPDATE app_auth SET failed_attempts = 0, locked_until = NULL, updated_at = ? WHERE tenant_id = ?',
    [now(), tenantId]
  );
  return { ok: true };
}

export async function clearLockout(tenantId: string): Promise<void> {
  _clearMem(tenantId);
  const db = await getDb();
  await db.execute(
    'UPDATE app_auth SET failed_attempts = 0, locked_until = NULL, updated_at = ? WHERE tenant_id = ?',
    [now(), tenantId]
  );
}

export async function changePassword(tenantId: string, currentPassword: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
  const db = await getDb();
  const rows = await db.select<AppAuth[]>(
    'SELECT * FROM app_auth WHERE tenant_id = ? LIMIT 1', [tenantId]
  );
  if (!rows[0]) return { ok: false, error: 'No account found' };
  const hash = await hashPassword(currentPassword, rows[0].salt);
  if (hash !== rows[0].password_hash) return { ok: false, error: 'Current password is incorrect' };
  const newSalt = randomSalt();
  const newHash = await hashPassword(newPassword, newSalt);
  await db.execute(
    'UPDATE app_auth SET password_hash = ?, salt = ?, failed_attempts = 0, locked_until = NULL, updated_at = ? WHERE tenant_id = ?',
    [newHash, newSalt, now(), tenantId]
  );
  return { ok: true };
}

export async function changeUsername(tenantId: string, newUsername: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    'UPDATE app_auth SET username = ?, updated_at = ? WHERE tenant_id = ?',
    [newUsername.trim().toLowerCase(), now(), tenantId]
  );
}

// Reset via admin-issued code — replaces password and clears lockout
export async function resetPasswordWithCode(
  tenantId: string, code: string, newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  if (newPassword.length < 4) return { ok: false, error: 'Password must be at least 4 characters' };
  const SERVER = 'https://update.frontstores.com';
  try {
    const res = await fetch(`${SERVER}/verify-reset-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId, code }),
    });
    const data = await res.json() as { ok: boolean; error?: string };
    if (!data.ok) return { ok: false, error: data.error || 'Invalid or expired code' };
    const db = await getDb();
    const salt = randomSalt();
    const hash = await hashPassword(newPassword, salt);
    await db.execute(
      'UPDATE app_auth SET password_hash = ?, salt = ?, failed_attempts = 0, locked_until = NULL, updated_at = ? WHERE tenant_id = ?',
      [hash, salt, now(), tenantId]
    );
    return { ok: true };
  } catch {
    return { ok: false, error: 'Cannot reach server. Check your internet connection.' };
  }
}

// Unlock via admin-issued code — clears lockout WITHOUT changing password
export async function unlockWithCode(
  tenantId: string, code: string
): Promise<{ ok: boolean; error?: string }> {
  const SERVER = 'https://update.frontstores.com';
  try {
    const res = await fetch(`${SERVER}/verify-unlock-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId, code }),
    });
    const data = await res.json() as { ok: boolean; error?: string };
    if (!data.ok) return { ok: false, error: data.error || 'Invalid or expired code' };
    await clearLockout(tenantId);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Cannot reach server. Check your internet connection.' };
  }
}

// ── Export audit log ─────────────────────────────────────────────────────────

export async function logExport(tenantId: string, exportType: string, rowCount: number): Promise<void> {
  try {
    const db = await getDb();
    await db.execute(
      'INSERT INTO export_logs (id, tenant_id, export_type, row_count, exported_at) VALUES (?, ?, ?, ?, ?)',
      [uuid(), tenantId, exportType, rowCount, now()]
    );
  } catch { /* non-critical — never block an export */ }
}

export async function getExportLogs(tenantId: string, limit = 30): Promise<ExportLog[]> {
  const db = await getDb();
  return db.select<ExportLog[]>(
    'SELECT * FROM export_logs WHERE tenant_id = ? ORDER BY exported_at DESC LIMIT ?',
    [tenantId, limit]
  );
}

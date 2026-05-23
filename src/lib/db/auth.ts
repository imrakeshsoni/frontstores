import { getDb, uuid, now } from './index';

export interface AppAuth {
  id: string;
  tenant_id: string;
  username: string;
  password_hash: string;
  salt: string;
  created_at: string;
  updated_at: string;
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
  const db = await getDb();
  const salt = randomSalt();
  const hash = await hashPassword(password, salt);
  await db.execute(
    `INSERT INTO app_auth (id, tenant_id, username, password_hash, salt, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [uuid(), tenantId, username.trim().toLowerCase(), hash, salt, now(), now()]
  );
}

export async function verifyAuth(tenantId: string, username: string, password: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db.select<AppAuth[]>(
    'SELECT * FROM app_auth WHERE tenant_id = ? AND username = ? LIMIT 1',
    [tenantId, username.trim().toLowerCase()]
  );
  if (!rows[0]) return false;
  const hash = await hashPassword(password, rows[0].salt);
  return hash === rows[0].password_hash;
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
    'UPDATE app_auth SET password_hash = ?, salt = ?, updated_at = ? WHERE tenant_id = ?',
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

// Reset via admin-issued code — replaces password with new one if code is valid
export async function resetPasswordWithCode(
  tenantId: string, code: string, newPassword: string
): Promise<{ ok: boolean; error?: string }> {
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
      'UPDATE app_auth SET password_hash = ?, salt = ?, updated_at = ? WHERE tenant_id = ?',
      [hash, salt, now(), tenantId]
    );
    return { ok: true };
  } catch {
    return { ok: false, error: 'Cannot reach server. Check your internet connection.' };
  }
}

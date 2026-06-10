// [core] [all apps] [all tenants]
// Admin-pushed announcements — silently polled from the server (no manual "update"
// click needed) and cached locally so every user under a tenant sees them, can
// be notified via a one-time popup, and can revisit them later from the sidebar.
import { getDb, uuid, now } from './index';

const SERVER = 'https://update.frontstores.com';

export interface Announcement {
  id: string;
  remote_id: string;
  title: string;
  message: string;
  created_at: string;
  notified_at: string | null;
  read_at: string | null;
}

interface RemoteAnnouncement {
  id: string;
  title: string;
  message: string;
  created_at: string;
}

// Pull active announcements from the server and cache any new ones locally.
// Safe to call frequently (e.g. on launch + a periodic interval) — it only inserts rows that don't exist yet.
export async function pollAnnouncements(tenantId: string): Promise<void> {
  if (!tenantId) return;
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`${SERVER}/announcements`, { signal: ctrl.signal });
    clearTimeout(timeout);
    if (!res.ok) return;
    const remote: RemoteAnnouncement[] = await res.json();
    if (!Array.isArray(remote) || !remote.length) return;

    const db = await getDb();
    for (const a of remote) {
      if (!a?.id) continue;
      await db.execute(
        `INSERT OR IGNORE INTO announcements (id, tenant_id, remote_id, title, message, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uuid(), tenantId, a.id, a.title, a.message, a.created_at, now()]
      );
    }
  } catch {
    // offline or server unreachable — try again next poll
  }
}

export async function listAnnouncements(tenantId: string): Promise<Announcement[]> {
  const db = await getDb();
  return db.select<Announcement[]>(
    `SELECT id, remote_id, title, message, created_at, notified_at, read_at
     FROM announcements WHERE tenant_id = ? AND deleted_at IS NULL
     ORDER BY created_at DESC`,
    [tenantId]
  );
}

// The newest announcement(s) that haven't been shown in the dismissible popup yet.
export async function getUnnotifiedAnnouncements(tenantId: string): Promise<Announcement[]> {
  const db = await getDb();
  return db.select<Announcement[]>(
    `SELECT id, remote_id, title, message, created_at, notified_at, read_at
     FROM announcements WHERE tenant_id = ? AND deleted_at IS NULL AND notified_at IS NULL
     ORDER BY created_at DESC`,
    [tenantId]
  );
}

export async function getUnreadCount(tenantId: string): Promise<number> {
  const db = await getDb();
  const rows = await db.select<{ c: number }[]>(
    `SELECT COUNT(*) as c FROM announcements WHERE tenant_id = ? AND deleted_at IS NULL AND read_at IS NULL`,
    [tenantId]
  );
  return rows[0]?.c ?? 0;
}

// Mark all currently-unnotified announcements as notified in one go — avoids
// bombarding the user with a stack of popups for messages they missed while offline.
export async function markAllNotified(tenantId: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE announcements SET notified_at = ?, updated_at = ? WHERE tenant_id = ? AND notified_at IS NULL`,
    [now(), now(), tenantId]
  );
}

export async function markAllRead(tenantId: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE announcements SET read_at = ?, updated_at = ? WHERE tenant_id = ? AND read_at IS NULL`,
    [now(), now(), tenantId]
  );
}

export async function acknowledgeAnnouncement(tenantId: string, announcementId: string, shopName: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE announcements SET read_at = COALESCE(read_at,?), notified_at = COALESCE(notified_at,?), updated_at = ? WHERE id = ? AND tenant_id = ?`,
    [now(), now(), now(), announcementId, tenantId]
  );
  // [core] [all tenants] — the server keys announcements by its own id (remote_id
  // here), not our local row id, so look that up before reporting acknowledgement.
  try {
    const rows = await db.select<{ remote_id: string }[]>(
      `SELECT remote_id FROM announcements WHERE id = ? AND tenant_id = ?`,
      [announcementId, tenantId]
    );
    const remoteId = rows[0]?.remote_id;
    if (!remoteId) return;
    await fetch(`${SERVER}/announcement-seen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ announcement_id: remoteId, tenant_id: tenantId, shop_name: shopName, seen_at: new Date().toISOString() }),
    });
  } catch { /* offline — ignore */ }
}

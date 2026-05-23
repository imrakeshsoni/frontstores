import { getDb, uuid, now } from './db/index';

const SERVER = 'https://update.frontstores.com';
const MAX_ATTEMPTS = 10;

export type SyncType = 'register' | 'error';

// Add an item to the local queue (always succeeds, even offline)
export async function enqueue(type: SyncType, tenantId: string, payload: object) {
  const db = await getDb();
  await db.execute(
    `INSERT OR IGNORE INTO sync_queue (id, tenant_id, type, payload, attempts, created_at)
     VALUES (?, ?, ?, ?, 0, ?)`,
    [uuid(), tenantId, type, JSON.stringify(payload), now()]
  );
}

// Flush pending items — call on app start and when online event fires
export async function flushQueue() {
  if (!navigator.onLine) return;

  const db = await getDb();
  const pending = await db.select<{ id: string; type: string; payload: string; attempts: number }[]>(
    `SELECT id, type, payload, attempts FROM sync_queue
     WHERE synced_at IS NULL AND attempts < ?
     ORDER BY created_at ASC LIMIT 50`,
    [MAX_ATTEMPTS]
  );

  for (const item of pending) {
    try {
      const endpoint = item.type === 'register' ? '/register' : '/error';
      const res = await fetch(`${SERVER}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: item.payload,
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        await db.execute(
          `UPDATE sync_queue SET synced_at = ?, attempts = attempts + 1 WHERE id = ?`,
          [now(), item.id]
        );
      } else {
        await db.execute(`UPDATE sync_queue SET attempts = attempts + 1 WHERE id = ?`, [item.id]);
      }
    } catch {
      // Offline or server down — increment attempt count, will retry next time
      await db.execute(`UPDATE sync_queue SET attempts = attempts + 1 WHERE id = ?`, [item.id]);
      break; // Stop trying if network is down
    }
  }

  // Clean up synced items older than 7 days
  await db.execute(
    `DELETE FROM sync_queue WHERE synced_at IS NOT NULL AND created_at < datetime('now', '-7 days')`
  );
}

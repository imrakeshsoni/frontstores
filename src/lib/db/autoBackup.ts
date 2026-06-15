// [core] [all tenants] — automatic local backup safety net.
//
// FrontStores is offline-first: all data lives in a local SQLite DB on the user's
// machine. If they never run a manual backup and the machine dies, the data is
// gone. This writes an automatic plain-JSON snapshot of all the tenant's tables
// to the app's local data folder once a day, keeping the last KEEP_BACKUPS files.
//
// Plain JSON (not encrypted) is acceptable here: it never leaves the machine, and
// the live SQLite DB on the same disk is itself unencrypted — so this adds zero
// new exposure while making recovery dead simple. The password-encrypted export
// (backup.ts) stays for the "move to a new computer" cross-machine case.

import { mkdir, writeTextFile, readDir, remove, BaseDirectory } from '@tauri-apps/plugin-fs';
import { dumpTenantTables } from './backup';
import { now } from './index';

const BACKUP_DIR = 'auto-backups';
const KEEP_BACKUPS = 14;            // ~2 weeks of daily snapshots
const MIN_INTERVAL_MS = 20 * 60 * 60 * 1000; // don't back up more than ~once/day
const LAST_KEY = (tenantId: string) => `fs_auto_backup_last_${tenantId}`;

function fileStamp(): string {
  // backup-2026-06-15T05-12-00.json — sortable & filesystem-safe
  return now().replace('T', 'T').replace(/[:.]/g, '-').replace(' ', 'T');
}

// Best-effort daily snapshot. Never throws — backup failure must not break launch.
export async function runAutoBackup(tenantId: string): Promise<void> {
  try {
    if (!tenantId) return;

    const last = Number(localStorage.getItem(LAST_KEY(tenantId)) || 0);
    if (last && Date.now() - last < MIN_INTERVAL_MS) return;

    const tables = await dumpTenantTables(tenantId);
    const payload = JSON.stringify({
      app: 'frontstores',
      kind: 'auto-backup',
      v: 1,
      tenant_id: tenantId,
      created_at: now(),
      tables,
    });

    await mkdir(BACKUP_DIR, { baseDir: BaseDirectory.AppLocalData, recursive: true });
    const fileName = `${BACKUP_DIR}/backup-${fileStamp()}.json`;
    await writeTextFile(fileName, payload, { baseDir: BaseDirectory.AppLocalData });

    localStorage.setItem(LAST_KEY(tenantId), String(Date.now()));
    await pruneOldBackups();
  } catch (err) {
    // Best-effort only — log and move on.
    console.warn('[autoBackup] skipped:', err);
  }
}

// Keep only the most recent KEEP_BACKUPS snapshots.
async function pruneOldBackups(): Promise<void> {
  try {
    const entries = await readDir(BACKUP_DIR, { baseDir: BaseDirectory.AppLocalData });
    const files = entries
      .filter((e) => e.isFile && e.name.startsWith('backup-') && e.name.endsWith('.json'))
      .map((e) => e.name)
      .sort(); // names are timestamp-sortable; oldest first
    const excess = files.length - KEEP_BACKUPS;
    for (let i = 0; i < excess; i++) {
      await remove(`${BACKUP_DIR}/${files[i]}`, { baseDir: BaseDirectory.AppLocalData });
    }
  } catch {
    // ignore prune failures
  }
}

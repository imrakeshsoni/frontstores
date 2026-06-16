import Database from '@tauri-apps/plugin-sql';
import { exists, remove, stat } from '@tauri-apps/plugin-fs';
import { appLocalDataDir, join } from '@tauri-apps/api/path';
import { readMigrations } from './migrations';
import { reportError } from '../errorReporter';

let _db: Database | null = null;
let _dbPromise: Promise<Database> | null = null; // [all apps] [all tenants] prevent concurrent init race → UNIQUE on _migrations

export async function getDb(): Promise<Database> {
  if (_db) return _db;
  if (_dbPromise) return _dbPromise;
  _dbPromise = _initDb();
  return _dbPromise;
}

// Stale WAL/SHM files from a deleted DB cause SQLITE_IOERR_SHORT_READ (code 522).
// Clean them up whenever the main DB is tiny (empty/new) but WAL/SHM exist.
async function _cleanStaleWal() {
  try {
    const dir = await appLocalDataDir();
    const dbPath  = await join(dir, 'frontstores.db');
    const shmPath = dbPath + '-shm';
    const walPath = dbPath + '-wal';
    const shmExists = await exists(shmPath);
    const walExists = await exists(walPath);
    if (!shmExists && !walExists) return;
    // Under 8KB = fresh/empty DB
    let dbTiny = false;
    try { const info = await stat(dbPath); dbTiny = (info.size ?? 0) < 8192; }
    catch { dbTiny = true; }
    if (dbTiny) {
      if (shmExists) await remove(shmPath);
      if (walExists) await remove(walPath);
    }
  } catch { /* non-fatal */ }
}

async function _initDb(): Promise<Database> {
  try {
    await _cleanStaleWal();
    _db = await Database.load('sqlite:frontstores.db');
    await _db.execute('PRAGMA journal_mode = WAL');
    await _db.execute('PRAGMA busy_timeout = 10000');
    await _db.execute('PRAGMA foreign_keys = ON');
    await _db.execute('PRAGMA synchronous = NORMAL');
    await runMigrations(_db);
    _wrapExecuteForSync(_db);
  } catch (e: any) {
    _dbPromise = null; // allow retry on failure
    reportError(String(e?.message || e), e?.stack, 'db.getDb');
    throw e;
  }
  return _db!;
}

async function runMigrations(db: Database) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      name      TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  const migrations = await readMigrations();
  for (const { name, sql } of migrations) {
    const existing = await db.select<{ id: number }[]>(
      'SELECT id FROM _migrations WHERE name = ?', [name]
    );
    if (existing.length === 0) {
      // Strip comment lines, then split by semicolon
      const stripped = sql
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('--'))
        .join('\n');
      const statements = stripped
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      let migrationFailed = false;
      for (const stmt of statements) {
        try {
          await db.execute(stmt + ';');
        } catch (e: any) {
          const msg = String(e);
          // Ignore errors that mean "already done" — idempotent migrations
          if (
            msg.includes('already exists') ||
            msg.includes('duplicate column name')
          ) continue;
          reportError(`Migration ${name} failed: ${msg}`, undefined, `migration.${name}`);
          migrationFailed = true;
          break;
        }
      }
      // Only mark as applied if all statements succeeded — failed migrations retry on next launch
      if (!migrationFailed) {
        await db.execute('INSERT INTO _migrations (name) VALUES (?)', [name]);
      }
    }
  }
}

export function uuid(): string {
  return crypto.randomUUID();
}

function _pad(n: number) { return String(n).padStart(2, '0'); }

export function now(): string {
  const d = new Date();
  return `${d.getFullYear()}-${_pad(d.getMonth()+1)}-${_pad(d.getDate())} ${_pad(d.getHours())}:${_pad(d.getMinutes())}:${_pad(d.getSeconds())}`;
}

export function localDateISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${_pad(d.getMonth()+1)}-${_pad(d.getDate())}`;
}

// [all apps] [all tenants] — central hook: any write (INSERT/UPDATE/DELETE) made
// anywhere via getDb() schedules a debounced Cloud Sync push. Without this, only
// the handful of call sites that remembered to call triggerAutoSync() directly
// would ever sync — every other table (products, orders, customers, etc.) would
// silently never reach the cloud.
function _wrapExecuteForSync(db: Database) {
  const originalExecute = db.execute.bind(db);
  db.execute = (async (sql: string, bindValues?: unknown[]) => {
    const result = await originalExecute(sql, bindValues);
    const op = sql.trim().slice(0, 6).toUpperCase();
    const upper = sql.toUpperCase();
    if (
      (op === 'INSERT' || op === 'UPDATE' || op === 'DELETE') &&
      !upper.includes('_MIGRATIONS') &&
      !upper.includes('SYNC_QUEUE') &&
      !upper.includes('AUDIT_LOG')
    ) {
      import('../autoSync').then(({ triggerAutoSync }) => triggerAutoSync()).catch(() => {});
      // [core] [all apps] [all tenants] — auto audit trail. Uses originalExecute so the
      // audit insert bypasses this wrapper (no recursion, no sync of the log itself).
      import('./audit').then(({ recordAudit }) => recordAudit(originalExecute, sql, bindValues)).catch(() => {});
    }
    return result;
  }) as typeof db.execute;
}

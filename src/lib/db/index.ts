import Database from '@tauri-apps/plugin-sql';
import { readMigrations } from './migrations';
import { reportError } from '../errorReporter';

let _db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (_db) return _db;
  try {
    _db = await Database.load('sqlite:frontstores.db');
    await _db.execute('PRAGMA foreign_keys = ON');
    await runMigrations(_db);
  } catch (e: any) {
    reportError(String(e?.message || e), e?.stack, 'db.getDb');
    throw e;
  }
  return _db;
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
          throw e;
        }
      }
      await db.execute('INSERT INTO _migrations (name) VALUES (?)', [name]);
    }
  }
}

export function uuid(): string {
  return crypto.randomUUID();
}

export function now(): string {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

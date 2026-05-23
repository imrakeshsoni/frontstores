import Database from '@tauri-apps/plugin-sql';
import { readMigrations } from './migrations';

let _db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (_db) return _db;
  _db = await Database.load('sqlite:frontstores.db');
  await runMigrations(_db);
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
      await db.execute(sql);
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

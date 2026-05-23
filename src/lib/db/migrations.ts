import migration0001 from '../../../src-tauri/migrations/0001_initial.sql?raw';

export interface Migration {
  name: string;
  sql: string;
}

export async function readMigrations(): Promise<Migration[]> {
  return [
    { name: '0001_initial', sql: migration0001 },
  ];
}

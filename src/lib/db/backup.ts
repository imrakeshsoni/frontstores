import { getDb, now } from './index';

// Tables exported in order (parent before child for FK safety on restore)
export const BACKUP_TABLES = [
  'app_config',
  'app_auth',
  'bill_sequences',
  'suppliers',
  'products',
  'customers',
  'orders',
  'order_items',
  'inventory_batches',
  'inventory_adjustments',
  'purchase_orders',
  'purchase_order_items',
  'supplier_payments',
  'khata_entries',
  'expenses',
  'vehicles',
  'service_jobs',
  'restaurant_tables',
];

// ── Crypto helpers ────────────────────────────────────────────────────────────

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  // Cast to ArrayBuffer to satisfy strict WebCrypto typings
  const saltBuf = salt.buffer as ArrayBuffer;
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBuf, iterations: 200_000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function toB64(buf: ArrayBuffer | Uint8Array): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf instanceof ArrayBuffer ? buf : buf.buffer)));
}

function fromB64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

// ── Export ────────────────────────────────────────────────────────────────────

// Dump every backup table for one tenant. Shared by the encrypted export and the
// automatic local backup. Missing tables (older schema) are skipped silently.
export async function dumpTenantTables(tenantId: string): Promise<Record<string, unknown[]>> {
  const db = await getDb();
  const tables: Record<string, unknown[]> = {};
  for (const table of BACKUP_TABLES) {
    try {
      tables[table] = await db.select<unknown[]>(
        `SELECT * FROM ${table} WHERE tenant_id = ?`, [tenantId],
      );
    } catch {
      tables[table] = [];
    }
  }
  return tables;
}

export async function exportBackup(tenantId: string, password: string): Promise<Blob> {
  // Dump every table for this tenant
  const tables = await dumpTenantTables(tenantId);

  const payload = JSON.stringify({ tables, exported_at: now() });

  // Encrypt
  const salt    = crypto.getRandomValues(new Uint8Array(16));
  const iv      = crypto.getRandomValues(new Uint8Array(12));
  const key     = await deriveKey(password, salt);
  const ivBuf   = iv.buffer as ArrayBuffer;
  const dataBuf = new TextEncoder().encode(payload).buffer as ArrayBuffer;
  const enc     = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: ivBuf }, key, dataBuf);

  // Build file JSON (header is readable, payload is ciphertext)
  const file = JSON.stringify({
    v:           1,
    app:         'frontstores',
    tenant_id:   tenantId,
    exported_at: now(),
    salt:        toB64(salt),
    iv:          toB64(iv),
    payload:     toB64(enc),
  });

  return new Blob([file], { type: 'application/octet-stream' });
}

// ── Import ────────────────────────────────────────────────────────────────────

export interface ImportResult {
  ok: boolean;
  shop_name?: string;
  tenant_id?: string;
  error?: string;
}

export async function importBackup(file: File, password: string): Promise<ImportResult> {
  try {
    const raw = await file.text();
    const header = JSON.parse(raw) as {
      v: number; app: string; tenant_id: string; exported_at: string;
      salt: string; iv: string; payload: string;
    };

    if (header.app !== 'frontstores' || header.v !== 1) {
      return { ok: false, error: 'This file is not a valid FrontStores backup.' };
    }

    // Decrypt
    const salt = fromB64(header.salt);
    const iv   = fromB64(header.iv);
    let decrypted: ArrayBuffer;
    try {
      const key = await deriveKey(password, salt);
      const ivBuf = iv.buffer as ArrayBuffer;
      const payloadBuf = fromB64(header.payload).buffer as ArrayBuffer;
      decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBuf }, key, payloadBuf);
    } catch {
      return { ok: false, error: 'Wrong password. Please enter the password you used on your old computer.' };
    }

    const { tables } = JSON.parse(new TextDecoder().decode(decrypted)) as {
      tables: Record<string, Record<string, unknown>[]>;
    };

    const db = await getDb();

    // Restore each table — clear existing rows for this tenant first, then insert
    for (const table of BACKUP_TABLES) {
      const rows = tables[table];
      if (!rows || rows.length === 0) continue;

      try {
        // Delete existing data for this tenant
        await db.execute(`DELETE FROM ${table} WHERE tenant_id = ?`, [header.tenant_id]);

        // Insert restored rows
        for (const row of rows) {
          const cols = Object.keys(row);
          const placeholders = cols.map(() => '?').join(', ');
          const values = cols.map(c => row[c]);
          await db.execute(
            `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`,
            values,
          );
        }
      } catch {
        // Table may not exist yet — migrations will create it, skip for now
      }
    }

    // Read shop name from restored app_config
    const configs = await db.select<{ shop_name: string }[]>(
      `SELECT shop_name FROM app_config WHERE tenant_id = ? LIMIT 1`,
      [header.tenant_id],
    );

    return { ok: true, shop_name: configs[0]?.shop_name, tenant_id: header.tenant_id };
  } catch (e) {
    return { ok: false, error: `Restore failed: ${String(e)}` };
  }
}

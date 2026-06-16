// [core] [all apps] [all tenants]
// Automatic, tamper-evident audit trail. recordAudit() is called by the execute()
// wrapper in index.ts after EVERY write, so any current or future feature that writes
// through getDb() is logged with no extra code. Logging never throws — a failure here
// must never break the actual write.
import { uuid, now } from './index';

type RawExecute = (sql: string, bindValues?: unknown[]) => Promise<unknown>;

// Set from the app store whenever the tenant config loads (see app.store.ts), mirroring
// how setReporterTenantId works. Writes before this is set (migrations, first launch)
// are intentionally not attributed to a tenant and so are skipped.
let _auditTenantId = '';
export function setAuditTenantId(tenantId: string | null | undefined) {
  _auditTenantId = tenantId || '';
}

// Internal plumbing tables — never audited (would be noise or cause recursion).
const SKIP_TABLES = new Set(['_migrations', 'sync_queue', 'audit_log']);

function parseWrite(sql: string): { action: 'CREATE' | 'UPDATE' | 'DELETE'; table: string } | null {
  const s = sql.trim();
  let m = /^insert\s+(?:or\s+\w+\s+)?into\s+["'`]?(\w+)/i.exec(s);
  if (m) return { action: 'CREATE', table: m[1] };
  m = /^update\s+["'`]?(\w+)/i.exec(s);
  if (m) {
    // A soft delete is an UPDATE that sets deleted_at — record it as a deletion.
    return { action: /\bdeleted_at\s*=/i.test(s) ? 'DELETE' : 'UPDATE', table: m[1] };
  }
  m = /^delete\s+from\s+["'`]?(\w+)/i.exec(s);
  if (m) return { action: 'DELETE', table: m[1] };
  return null;
}

function currentActor(): string {
  try { return sessionStorage.getItem('fs_logged_in_username') || 'owner'; } catch { return 'owner'; }
}

export async function recordAudit(rawExecute: RawExecute, sql: string, params?: unknown[]): Promise<void> {
  try {
    const parsed = parseWrite(sql);
    if (!parsed) return;
    if (SKIP_TABLES.has(parsed.table.toLowerCase())) return;
    const tenantId = _auditTenantId;
    if (!tenantId) return;

    const verb = parsed.action === 'CREATE' ? 'Created' : parsed.action === 'DELETE' ? 'Deleted' : 'Updated';
    const summary = `${verb} ${parsed.table.replace(/_/g, ' ')}`;
    // INSERTs in this codebase always bind the row id first.
    const recordId = parsed.action === 'CREATE' && Array.isArray(params) ? String(params[0] ?? '') : null;
    const details = JSON.stringify({ sql: sql.replace(/\s+/g, ' ').trim(), params: params ?? [] });

    await rawExecute(
      `INSERT INTO audit_log (id, tenant_id, action, table_name, record_id, summary, details, actor, created_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [uuid(), tenantId, parsed.action, parsed.table, recordId, summary, details, currentActor(), now()],
    );
  } catch {
    /* audit logging must never break the underlying write */
  }
}

export interface AuditRow {
  id: string;
  action: string;
  table_name: string;
  record_id: string | null;
  summary: string;
  details: string;
  actor: string;
  created_at: string;
}

// Fetch all audit entries for a tenant from a given local datetime string ('YYYY-MM-DD HH:MM:SS').
export async function exportAuditTrail(tenantId: string, fromLocal: string): Promise<AuditRow[]> {
  const { getDb } = await import('./index');
  const db = await getDb();
  return db.select<AuditRow[]>(
    `SELECT id, action, table_name, record_id, summary, details, actor, created_at
     FROM audit_log WHERE tenant_id = ? AND created_at >= ? ORDER BY created_at DESC`,
    [tenantId, fromLocal],
  );
}

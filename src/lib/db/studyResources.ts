// [study] [all tenants] — local student resources (images, PDFs, notes)
import { getDb, uuid, now } from './index';

export interface StudyResource {
  id: string;
  tenant_id: string;
  name: string;
  type: 'image' | 'pdf' | 'text' | 'note';
  subject: string | null;
  content: string | null;
  image_data: string | null;
  file_size: number;
  created_at: string;
}

export async function listResources(tenantId: string): Promise<StudyResource[]> {
  const db = await getDb();
  return db.select<StudyResource[]>(
    `SELECT id, tenant_id, name, type, subject, content, image_data, file_size, created_at
     FROM study_resources WHERE tenant_id=? AND deleted_at IS NULL ORDER BY created_at DESC`,
    [tenantId]
  );
}

export async function saveResource(tenantId: string, data: {
  name: string; type: StudyResource['type']; subject: string | null;
  content: string | null; image_data: string | null; file_size: number;
}): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO study_resources (id, tenant_id, name, type, subject, content, image_data, file_size, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.name, data.type, data.subject, data.content, data.image_data, data.file_size, now()]
  );
  return id;
}

export async function deleteResource(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE study_resources SET deleted_at=? WHERE id=? AND tenant_id=?`, [now(), id, tenantId]);
}

export async function searchRelevantResources(tenantId: string, question: string): Promise<StudyResource[]> {
  const db = await getDb();
  const all = await db.select<StudyResource[]>(
    `SELECT * FROM study_resources WHERE tenant_id=? AND deleted_at IS NULL`,
    [tenantId]
  );
  if (!all.length) return [];
  const words = question.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (!words.length) return all.slice(0, 3);
  const scored = all.map(r => {
    const hay = `${r.name} ${r.subject ?? ''} ${(r.content ?? '').substring(0, 500)}`.toLowerCase();
    const score = words.filter(w => hay.includes(w)).length;
    return { r, score };
  });
  return scored.filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 3).map(x => x.r);
}

// Extract text from PDF bytes (basic extraction for standard PDFs)
export function extractPdfText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const raw = new TextDecoder('latin1').decode(bytes);
  const parts: string[] = [];
  const btBlocks = raw.match(/BT[\s\S]*?ET/g) ?? [];
  for (const block of btBlocks) {
    const tjs = block.match(/\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*Tj/g) ?? [];
    for (const tj of tjs) {
      const m = tj.match(/\(([^)\\]*(?:\\.[^)\\]*)*)\)/);
      if (m?.[1]) parts.push(m[1].replace(/\\n/g, '\n').replace(/\\t/g, ' '));
    }
    const tjarr = block.match(/\[([^\]]*)\]\s*TJ/g) ?? [];
    for (const tja of tjarr) {
      const str = tja.match(/\(([^)]*)\)/g)?.map(s => s.slice(1, -1)).join('') ?? '';
      if (str.trim()) parts.push(str);
    }
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim().substring(0, 50000);
}

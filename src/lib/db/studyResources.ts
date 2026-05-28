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

// Extract text from PDF bytes using pdfjs-dist (handles compressed modern PDFs)
export async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    // Use legacy build to avoid worker issues in Tauri WebView
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer), useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= Math.min(pdf.numPages, 100); i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .filter(item => 'str' in item)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((item: any) => (item.str as string) + (item.hasEOL ? '\n' : ' '))
        .join('');
      pages.push(pageText);
    }
    return pages.join('\n\n').replace(/\s{3,}/g, '  ').trim().substring(0, 50000);
  } catch (e) {
    console.error('PDF extraction failed:', e);
    return '';
  }
}

// [study] [all tenants]
import { useState } from 'react';
import { toast } from 'sonner';
import { Download, Upload, HardDrive, AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getDb } from '@/lib/db/index';

async function exportAllData(tenantId: string) {
  const db = await getDb();
  const tables = [
    'study_config', 'study_conversations', 'study_messages',
    'study_mock_tests', 'study_mock_questions', 'study_flashcard_decks',
    'study_flashcards', 'study_sessions', 'study_resources',
    'study_timetable', 'study_exams', 'study_assignments', 'study_goals',
    'study_achievements', 'study_formula_bank', 'study_daily_challenge',
    'study_bookmarks', 'study_mindmaps', 'study_pyq', 'study_chapter_checklist',
    'study_xp_log', 'study_streak_freeze', 'study_revision_plan',
  ];
  const data: Record<string, unknown[]> = {};
  for (const table of tables) {
    try {
      const rows = await db.select<unknown[]>(`SELECT * FROM ${table} WHERE tenant_id=?`, [tenantId]);
      data[table] = rows;
    } catch { data[table] = []; }
  }
  return { version: 1, tenant_id: tenantId, exported_at: new Date().toISOString(), data };
}

async function importData(tenantId: string, backup: ReturnType<typeof exportAllData> extends Promise<infer T> ? T : never) {
  const db = await getDb();
  if (backup.tenant_id !== tenantId) throw new Error('This backup belongs to a different tenant. Cannot import.');
  const tablesToRestore = Object.keys(backup.data);
  for (const table of tablesToRestore) {
    const rows = backup.data[table] as Record<string, unknown>[];
    if (!rows.length) continue;
    const cols = Object.keys(rows[0]);
    for (const row of rows) {
      const vals = cols.map(c => row[c]);
      const placeholders = cols.map(() => '?').join(',');
      try {
        await db.execute(
          `INSERT OR REPLACE INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`,
          vals
        );
      } catch { /* skip rows that fail */ }
    }
  }
}

export function BackupPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirmImport, setConfirmImport] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await exportAllData(tenantId);
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `studymate-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Backup downloaded!');
    } catch (e: unknown) {
      toast.error('Export failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setPendingFile(file); setConfirmImport(true); }
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!pendingFile) return;
    setImporting(true);
    setConfirmImport(false);
    try {
      const text = await pendingFile.text();
      const backup = JSON.parse(text);
      if (!backup.version || !backup.tenant_id || !backup.data) throw new Error('Invalid backup file format');
      await importData(tenantId, backup);
      toast.success('Data restored successfully! Refresh the app to see everything.');
    } catch (e: unknown) {
      toast.error('Import failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setImporting(false);
      setPendingFile(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: '#dbeafe' }}>
          <HardDrive className="h-5 w-5" style={{ color: '#2563eb' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Backup & Restore</h1>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Export all study data to a file, restore on any device</p>
        </div>
      </div>

      {/* Export */}
      <div className="rounded-2xl p-6 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: '#dcfce7' }}>
            <Download className="h-5 w-5" style={{ color: '#16a34a' }} />
          </div>
          <div>
            <p className="font-bold" style={{ color: 'var(--text-primary)' }}>Export Backup</p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Download all your data as a JSON file</p>
          </div>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Exports: sessions, flashcards, test history, notes, resources, assignments, exams, goals, formulas, mindmaps, and all other study data.
        </p>
        <button onClick={handleExport} disabled={exporting}
          className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-60 flex items-center justify-center gap-2"
          style={{ background: '#16a34a' }}>
          {exporting ? '⏳ Exporting…' : <><Download className="h-4 w-4" /> Download Backup</>}
        </button>
      </div>

      {/* Import */}
      <div className="rounded-2xl p-6 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: '#fef3c7' }}>
            <Upload className="h-5 w-5" style={{ color: '#d97706' }} />
          </div>
          <div>
            <p className="font-bold" style={{ color: 'var(--text-primary)' }}>Restore Backup</p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Import a previously exported JSON file</p>
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-xl p-3" style={{ background: '#fef3c7' }}>
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#d97706' }} />
          <p className="text-xs" style={{ color: '#92400e' }}>
            Restoring will merge the backup data with your current data. Existing records won't be deleted, but new ones from the backup will be added. Use only your own backup file.
          </p>
        </div>
        <label className="w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 cursor-pointer"
          style={{ background: '#d97706' }}>
          {importing ? '⏳ Restoring…' : <><Upload className="h-4 w-4" /> Select Backup File</>}
          <input type="file" accept=".json" onChange={handleFileSelect} className="hidden" disabled={importing} />
        </label>
      </div>

      {/* What's included */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <p className="font-bold mb-3" style={{ color: 'var(--text-primary)' }}>What's included in backup</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            'Study sessions & streaks', 'Mock tests & scores', 'Flashcard decks & cards',
            'Notes & resources', 'Assignments & exams', 'Goals & achievements',
            'Formula bank', 'Mind maps', 'PYQ tracker', 'Chapter checklist',
            'Timetable', 'Revision plan',
          ].map(item => (
            <div key={item} className="flex items-center gap-1.5">
              <span className="text-green-500 text-xs">✓</span>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Confirm modal */}
      {confirmImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ background: 'var(--bg)' }}>
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
              <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Confirm Restore</h2>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Restore from <strong>{pendingFile?.name}</strong>? This will merge the backup data into your current data.
            </p>
            <div className="flex gap-3">
              <button onClick={() => { setConfirmImport(false); setPendingFile(null); }}
                className="flex-1 py-3 rounded-xl font-semibold text-sm border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Cancel</button>
              <button onClick={handleImport}
                className="flex-1 py-3 rounded-xl font-semibold text-sm text-white" style={{ background: '#d97706' }}>Restore</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

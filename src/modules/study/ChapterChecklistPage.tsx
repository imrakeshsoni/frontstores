// [study] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ListChecks, Loader2 } from 'lucide-react';
import { askTutor } from '@/lib/study/studyAI';
import { useAppStore } from '@/app/store/app.store';
import { listChapters, addChapter, updateChapterStatus, deleteChapter, StudyChapterChecklist } from '@/lib/db/study';

type Status = StudyChapterChecklist['status'];

const STATUS_CONFIG: Record<Status, { label: string; bg: string; color: string; next: Status }> = {
  not_started: { label: 'Not Started', bg: '#f1f5f9', color: '#64748b', next: 'in_progress' },
  in_progress:  { label: 'In Progress', bg: '#fef3c7', color: '#d97706', next: 'revised' },
  revised:      { label: 'Revised',     bg: '#dbeafe', color: '#2563eb', next: 'done' },
  done:         { label: 'Done ✓',      bg: '#dcfce7', color: '#16a34a', next: 'not_started' },
};

const STATUS_ORDER: Status[] = ['not_started', 'in_progress', 'revised', 'done'];

export function ChapterChecklistPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newChapter, setNewChapter] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [aiImporting, setAiImporting] = useState(false);
  const [syllabusText, setSyllabusText] = useState('');
  const [showAIImport, setShowAIImport] = useState(false);

  const { data: chapters = [] } = useQuery({ queryKey: ['study-chapters', tenantId], queryFn: () => listChapters(tenantId), enabled: !!tenantId });

  const addMutation = useMutation({
    mutationFn: () => addChapter(tenantId, (activeSubject || newSubject).trim(), newChapter.trim()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['study-chapters'] }); setNewChapter(''); setShowAdd(false); },
  });

  const bulkAddMutation = useMutation({
    mutationFn: async () => {
      const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
      for (const ch of lines) await addChapter(tenantId, (activeSubject || newSubject).trim(), ch);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['study-chapters'] }); setBulkText(''); setShowBulk(false); },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Status }) => updateChapterStatus(tenantId, id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study-chapters'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteChapter(tenantId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study-chapters'] }),
  });

  const subjects = [...new Set(chapters.map(c => c.subject))].sort();
  const displayed = activeSubject ? chapters.filter(c => c.subject === activeSubject) : chapters;

  const getSubjectStats = (subj: string) => {
    const cs = chapters.filter(c => c.subject === subj);
    const done = cs.filter(c => c.status === 'done').length;
    return { total: cs.length, done, pct: cs.length > 0 ? Math.round((done / cs.length) * 100) : 0 };
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: '#dcfce7' }}>
            <ListChecks className="h-5 w-5" style={{ color: '#16a34a' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Chapter Checklist</h1>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Track every chapter: Not Started → Done</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAIImport(true)}
            className="px-4 py-2.5 rounded-xl font-semibold text-sm border" style={{ borderColor: '#7c3aed', color: '#7c3aed' }}>
            🤖 AI Import
          </button>
          <button onClick={() => setShowBulk(true)}
            className="px-4 py-2.5 rounded-xl font-semibold text-sm border" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
            Bulk Add
          </button>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white" style={{ background: 'var(--accent)' }}>
            <Plus className="h-4 w-4" /> Add Chapter
          </button>
        </div>
      </div>

      {/* Subject filter chips */}
      {subjects.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => setActiveSubject(null)}
            className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold"
            style={!activeSubject ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
            All
          </button>
          {subjects.map(s => {
            const stats = getSubjectStats(s);
            return (
              <button key={s} onClick={() => setActiveSubject(s)}
                className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                style={activeSubject === s ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
                {s}
                <span className="text-xs opacity-75">{stats.done}/{stats.total}</span>
              </button>
            );
          })}
        </div>
      )}

      {chapters.length === 0 && (
        <div className="rounded-2xl p-10 flex flex-col items-center gap-3 text-center"
          style={{ background: 'var(--surface)', border: '2px dashed var(--surface-border)' }}>
          <p className="text-4xl">📚</p>
          <p className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>No chapters yet</p>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Add your syllabus chapters and track progress from Not Started to Done</p>
        </div>
      )}

      {/* Status legend */}
      {chapters.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {STATUS_ORDER.map(s => (
            <span key={s} className="text-xs px-3 py-1 rounded-full font-semibold"
              style={{ background: STATUS_CONFIG[s].bg, color: STATUS_CONFIG[s].color }}>
              {STATUS_CONFIG[s].label}: {displayed.filter(c => c.status === s).length}
            </span>
          ))}
        </div>
      )}

      {/* Grouped by subject */}
      {activeSubject === null ? (
        subjects.map(subj => {
          const cs = chapters.filter(c => c.subject === subj);
          const stats = getSubjectStats(subj);
          return (
            <div key={subj} className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
              <div className="px-4 py-3 flex items-center gap-3" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--surface-border)' }}>
                <p className="font-bold flex-1" style={{ color: 'var(--text-primary)' }}>{subj}</p>
                <span className="text-xs font-semibold" style={{ color: stats.pct === 100 ? '#16a34a' : 'var(--accent)' }}>{stats.pct}%</span>
                <div className="w-24 h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-border)' }}>
                  <div className="h-full rounded-full" style={{ width: `${stats.pct}%`, background: stats.pct === 100 ? '#16a34a' : 'var(--accent)' }} />
                </div>
              </div>
              <ChapterRows chapters={cs} onStatus={(id, s) => statusMutation.mutate({ id, status: s })} onDelete={id => deleteMutation.mutate(id)} />
            </div>
          );
        })
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <ChapterRows chapters={displayed} onStatus={(id, s) => statusMutation.mutate({ id, status: s })} onDelete={id => deleteMutation.mutate(id)} />
        </div>
      )}

      {/* Add single chapter modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ background: 'var(--bg)' }}>
            <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Add Chapter</h2>
            {!activeSubject && (
              <input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="Subject"
                className="w-full px-4 py-3 rounded-xl text-sm border outline-none"
                style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
            )}
            {activeSubject && <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Subject: {activeSubject}</p>}
            <input value={newChapter} onChange={e => setNewChapter(e.target.value)} placeholder="Chapter name"
              className="w-full px-4 py-3 rounded-xl text-sm border outline-none"
              style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
            <div className="flex gap-3">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-3 rounded-xl font-semibold text-sm border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Cancel</button>
              <button onClick={() => addMutation.mutate()} disabled={!newChapter.trim() || (!activeSubject && !newSubject.trim()) || addMutation.isPending}
                className="flex-1 py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-50" style={{ background: 'var(--accent)' }}>Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk add modal */}
      {showBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: 'var(--bg)' }}>
            <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Bulk Add Chapters</h2>
            {!activeSubject && (
              <input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="Subject"
                className="w-full px-4 py-3 rounded-xl text-sm border outline-none"
                style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
            )}
            <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} rows={8}
              placeholder={'One chapter per line:\nChapter 1: Motion\nChapter 2: Forces\nChapter 3: Work and Energy'}
              className="w-full px-4 py-3 rounded-xl text-sm border outline-none resize-none"
              style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
            <div className="flex gap-3">
              <button onClick={() => setShowBulk(false)} className="flex-1 py-3 rounded-xl font-semibold text-sm border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Cancel</button>
              <button onClick={() => bulkAddMutation.mutate()} disabled={!bulkText.trim() || (!activeSubject && !newSubject.trim()) || bulkAddMutation.isPending}
                className="flex-1 py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-50" style={{ background: 'var(--accent)' }}>Add All</button>
            </div>
          </div>
        </div>
      )}

      {/* AI Syllabus Import Modal */}
      {showAIImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-4" style={{ background: 'var(--bg)' }}>
            <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>🤖 AI Syllabus Import</h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Paste your syllabus text — AI will extract chapter names automatically.</p>
            {!activeSubject && (
              <input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="Subject"
                className="w-full px-4 py-3 rounded-xl text-sm border outline-none"
                style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
            )}
            <textarea value={syllabusText} onChange={e => setSyllabusText(e.target.value)} rows={8}
              placeholder="Paste CBSE/ICSE/state board syllabus, textbook contents, chapter list — any format works"
              className="w-full px-4 py-3 rounded-xl text-sm border outline-none resize-none"
              style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
            <div className="flex gap-3">
              <button onClick={() => setShowAIImport(false)} className="flex-1 py-3 rounded-xl font-semibold text-sm border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Cancel</button>
              <button onClick={async () => {
                if (!syllabusText.trim() || (!activeSubject && !newSubject.trim())) return;
                setAiImporting(true);
                try {
                  const result = await askTutor('', `Extract ONLY the chapter/unit names from this syllabus as a plain list, one per line, no numbers or extra text:\n\n${syllabusText}`, null, []);
                  const chapters = result.split('\n').map(l => l.replace(/^[\d\.\-\*\s]+/, '').trim()).filter(l => l.length > 2 && l.length < 100);
                  const subj = activeSubject || newSubject.trim();
                  for (const ch of chapters) await addChapter(tenantId, subj, ch);
                  qc.invalidateQueries({ queryKey: ['study-chapters'] });
                  setShowAIImport(false); setSyllabusText('');
                  if (!activeSubject) setActiveSubject(subj);
                } catch { /* silently fail */ }
                setAiImporting(false);
              }} disabled={!syllabusText.trim() || (!activeSubject && !newSubject.trim()) || aiImporting}
                className="flex-1 py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-50 flex items-center justify-center gap-2" style={{ background: '#7c3aed' }}>
                {aiImporting ? <><Loader2 className="h-4 w-4 animate-spin" /> Extracting…</> : '🤖 Extract Chapters'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChapterRows({ chapters, onStatus, onDelete }: {
  chapters: StudyChapterChecklist[];
  onStatus: (id: string, s: Status) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="divide-y" style={{ borderColor: 'var(--surface-border)' }}>
      {chapters.map(c => {
        const cfg = STATUS_CONFIG[c.status];
        return (
          <div key={c.id} className="flex items-center gap-3 px-4 py-3">
            <button onClick={() => onStatus(c.id, cfg.next)}
              className="px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0 transition-all"
              style={{ background: cfg.bg, color: cfg.color }}>
              {cfg.label}
            </button>
            <p className="flex-1 text-sm font-medium" style={{ color: 'var(--text-primary)', textDecoration: c.status === 'done' ? 'line-through' : 'none', opacity: c.status === 'done' ? 0.6 : 1 }}>
              {c.chapter_name}
            </p>
            <button onClick={() => onDelete(c.id)} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-red-50 text-red-300 hover:text-red-500 flex-shrink-0">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

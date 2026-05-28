// [study] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, FileArchive, Minus } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listPYQ, addPYQ, updatePYQProgress, deletePYQ, StudyPYQ } from '@/lib/db/study';

const BOARDS = ['CBSE', 'ICSE', 'State Board', 'IIT JEE', 'NEET', 'UPSC', 'Other'];
const SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography', 'English', 'Economics', 'Science', 'Hindi', 'Other'];

function PYQCard({ pyq, onDelete, onUpdate }: { pyq: StudyPYQ; onDelete: () => void; onUpdate: (done: number) => void }) {
  const pct = pyq.total_questions > 0 ? Math.round((pyq.done_questions / pyq.total_questions) * 100) : 0;
  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-bold truncate" style={{ color: 'var(--text-primary)' }}>{pyq.paper_name}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#dbeafe', color: '#2563eb' }}>{pyq.subject}</span>
            {pyq.exam_board && <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#f1f5f9', color: '#64748b' }}>{pyq.exam_board}</span>}
            <span className="text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{pyq.year}</span>
          </div>
        </div>
        <button onClick={onDelete} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-red-50 text-red-400 flex-shrink-0">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {pyq.total_questions > 0 && (
        <div className="mt-4">
          <div className="flex justify-between text-xs mb-1.5">
            <span style={{ color: 'var(--text-secondary)' }}>{pyq.done_questions} / {pyq.total_questions} questions done</span>
            <span className="font-bold" style={{ color: pct === 100 ? '#16a34a' : 'var(--accent)' }}>{pct}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: 'var(--surface-2)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct === 100 ? '#16a34a' : 'var(--accent)' }} />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onUpdate(Math.max(0, pyq.done_questions - 1))}
              className="h-8 w-8 rounded-lg flex items-center justify-center border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="text-sm font-semibold flex-1 text-center" style={{ color: 'var(--text-primary)' }}>{pyq.done_questions} done</span>
            <button onClick={() => onUpdate(Math.min(pyq.total_questions, pyq.done_questions + 1))}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-white" style={{ background: 'var(--accent)' }}>
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {pyq.notes && <p className="text-xs mt-3 italic" style={{ color: 'var(--text-tertiary)' }}>{pyq.notes}</p>}
    </div>
  );
}

export function PYQPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [filterSubject, setFilterSubject] = useState('');
  const [form, setForm] = useState({ subject: '', exam_board: '', year: String(new Date().getFullYear()), paper_name: '', total_questions: '', notes: '' });

  const { data: papers = [] } = useQuery({ queryKey: ['study-pyq', tenantId], queryFn: () => listPYQ(tenantId), enabled: !!tenantId });

  const addMutation = useMutation({
    mutationFn: () => addPYQ(tenantId, {
      subject: form.subject.trim(), exam_board: form.exam_board || null,
      year: parseInt(form.year), paper_name: form.paper_name.trim(),
      resource_id: null, total_questions: parseInt(form.total_questions) || 0,
      done_questions: 0, notes: form.notes.trim() || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['study-pyq'] }); setShowAdd(false); setForm({ subject: '', exam_board: '', year: String(new Date().getFullYear()), paper_name: '', total_questions: '', notes: '' }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, done }: { id: string; done: number }) => updatePYQProgress(tenantId, id, done),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study-pyq'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePYQ(tenantId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study-pyq'] }),
  });

  const subjects = [...new Set(papers.map(p => p.subject))].sort();
  const filtered = filterSubject ? papers.filter(p => p.subject === filterSubject) : papers;

  const totalPapers = papers.length;
  const completedPapers = papers.filter(p => p.total_questions > 0 && p.done_questions >= p.total_questions).length;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: '#fee2e2' }}>
            <FileArchive className="h-5 w-5" style={{ color: '#dc2626' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Previous Year Papers</h1>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{completedPapers}/{totalPapers} papers completed</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white" style={{ background: 'var(--accent)' }}>
          <Plus className="h-4 w-4" /> Add Paper
        </button>
      </div>

      {subjects.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => setFilterSubject('')}
            className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold"
            style={!filterSubject ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
            All
          </button>
          {subjects.map(s => (
            <button key={s} onClick={() => setFilterSubject(s)}
              className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold"
              style={filterSubject === s ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {papers.length === 0 && (
        <div className="rounded-2xl p-10 flex flex-col items-center gap-3 text-center"
          style={{ background: 'var(--surface)', border: '2px dashed var(--surface-border)' }}>
          <p className="text-4xl">📄</p>
          <p className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>No papers yet</p>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Track your previous year paper practice and coverage</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map(p => (
          <PYQCard key={p.id} pyq={p}
            onDelete={() => deleteMutation.mutate(p.id)}
            onUpdate={(done) => updateMutation.mutate({ id: p.id, done })} />
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-3" style={{ background: 'var(--bg)' }}>
            <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Add Paper</h2>
            {[
              { label: 'Paper Name', key: 'paper_name', placeholder: 'e.g. Physics 2023 Question Paper' },
            ].map(f => (
              <input key={f.key} value={(form as any)[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full px-4 py-3 rounded-xl text-sm border outline-none"
                style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
            ))}
            <div className="grid grid-cols-2 gap-2">
              <select value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                className="px-4 py-3 rounded-xl text-sm border outline-none"
                style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}>
                <option value="">Subject</option>
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={form.exam_board} onChange={e => setForm(f => ({ ...f, exam_board: e.target.value }))}
                className="px-4 py-3 rounded-xl text-sm border outline-none"
                style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}>
                <option value="">Board</option>
                {BOARDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
                placeholder="Year" className="px-4 py-3 rounded-xl text-sm border outline-none"
                style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
              <input type="number" value={form.total_questions} onChange={e => setForm(f => ({ ...f, total_questions: e.target.value }))}
                placeholder="Total Qs" className="px-4 py-3 rounded-xl text-sm border outline-none"
                style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-3 rounded-xl font-semibold text-sm border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Cancel</button>
              <button onClick={() => addMutation.mutate()} disabled={!form.paper_name.trim() || !form.subject || addMutation.isPending}
                className="flex-1 py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-50" style={{ background: 'var(--accent)' }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

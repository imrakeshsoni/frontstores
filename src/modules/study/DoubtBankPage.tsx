// [study] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, CheckCircle2, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listDoubts, addDoubt, resolveDoubt, deleteDoubt, StudyDoubt } from '@/lib/db/study';

const SUBJECTS = ['Mathematics','Physics','Chemistry','Biology','History','Geography','English','Economics','Science','Hindi','Other'];

function DoubtCard({ doubt, onResolve, onDelete }: { doubt: StudyDoubt; onResolve: (id:string, res:string) => void; onDelete: (id:string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [resText, setResText] = useState('');

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: `2px solid ${doubt.status === 'solved' ? '#bbf7d0' : '#fecaca'}` }}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5" style={{ color: doubt.status === 'solved' ? '#16a34a' : '#dc2626' }}>
            {doubt.status === 'solved' ? <CheckCircle2 className="h-5 w-5" /> : <HelpCircle className="h-5 w-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{doubt.question}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {doubt.subject && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--text-tertiary)' }}>{doubt.subject}</span>}
              {doubt.source && <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>📖 {doubt.source}</span>}
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{new Date(doubt.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}</span>
            </div>
            {doubt.status === 'solved' && doubt.resolution && (
              <div className="mt-2 rounded-xl p-3" style={{ background: '#f0fdf4' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: '#166534' }}>✅ Resolution</p>
                <p className="text-sm" style={{ color: '#15803d' }}>{doubt.resolution}</p>
              </div>
            )}
          </div>
          <div className="flex gap-1 flex-shrink-0">
            {doubt.status === 'unsolved' && (
              <button onClick={() => setExpanded(e => !e)} className="h-8 px-2 rounded-lg text-xs font-semibold" style={{ background: '#dcfce7', color: '#16a34a' }}>
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            )}
            <button onClick={() => onDelete(doubt.id)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-red-50 text-red-400">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {expanded && doubt.status === 'unsolved' && (
        <div className="px-4 pb-4 space-y-2">
          <textarea value={resText} onChange={e => setResText(e.target.value)} rows={3}
            placeholder="Write the resolution — how did you understand this? What was the answer?"
            className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none resize-none"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
          <button onClick={() => { if(resText.trim()) onResolve(doubt.id, resText.trim()); }}
            disabled={!resText.trim()}
            className="w-full py-2.5 rounded-xl font-semibold text-sm text-white disabled:opacity-50"
            style={{ background: '#16a34a' }}>Mark as Solved</button>
        </div>
      )}
    </div>
  );
}

export function DoubtBankPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all'|'unsolved'|'solved'>('unsolved');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ question: '', subject: '', source: '' });

  const { data: doubts = [] } = useQuery({ queryKey: ['study-doubts', tenantId], queryFn: () => listDoubts(tenantId), enabled: !!tenantId });

  const addMutation = useMutation({
    mutationFn: () => addDoubt(tenantId, form.question.trim(), form.subject || null, form.source.trim() || null),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['study-doubts'] }); setShowAdd(false); setForm({ question: '', subject: '', source: '' }); },
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, res }: { id: string; res: string }) => resolveDoubt(tenantId, id, res),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study-doubts'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDoubt(tenantId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study-doubts'] }),
  });

  const shown = filter === 'all' ? doubts : doubts.filter(d => d.status === filter);
  const unsolved = doubts.filter(d => d.status === 'unsolved').length;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: '#fee2e2' }}>
            <HelpCircle className="h-5 w-5" style={{ color: '#dc2626' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Doubt Bank</h1>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{unsolved} unsolved · {doubts.length - unsolved} resolved</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white" style={{ background: 'var(--accent)' }}>
          <Plus className="h-4 w-4" /> Add Doubt
        </button>
      </div>

      <div className="flex gap-2">
        {(['unsolved','solved','all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-4 py-2 rounded-xl text-sm font-semibold capitalize"
            style={filter === f ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
            {f} ({f === 'all' ? doubts.length : doubts.filter(d => d.status === f).length})
          </button>
        ))}
      </div>

      {shown.length === 0 && (
        <div className="rounded-2xl p-10 flex flex-col items-center gap-3 text-center" style={{ background: 'var(--surface)', border: '2px dashed var(--surface-border)' }}>
          <p className="text-4xl">{filter === 'solved' ? '🎉' : '🤔'}</p>
          <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{filter === 'solved' ? 'No solved doubts yet' : filter === 'unsolved' ? 'No unsolved doubts!' : 'No doubts yet'}</p>
        </div>
      )}

      <div className="space-y-3">
        {shown.map(d => (
          <DoubtCard key={d.id} doubt={d}
            onResolve={(id, res) => resolveMutation.mutate({ id, res })}
            onDelete={id => deleteMutation.mutate(id)} />
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: 'var(--bg)' }}>
            <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Save a Doubt</h2>
            <textarea value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))} rows={4}
              placeholder="What don't you understand? Write the question or concept that confused you…"
              className="w-full px-4 py-3 rounded-xl text-sm border outline-none resize-none"
              style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
            <div className="flex gap-2">
              <select value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                className="flex-1 px-3 py-3 rounded-xl text-sm border outline-none"
                style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}>
                <option value="">Subject</option>
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                placeholder="Source (e.g. Page 42, NCERT)"
                className="flex-1 px-4 py-3 rounded-xl text-sm border outline-none"
                style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-3 rounded-xl font-semibold text-sm border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Cancel</button>
              <button onClick={() => addMutation.mutate()} disabled={!form.question.trim() || addMutation.isPending}
                className="flex-1 py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-50" style={{ background: 'var(--accent)' }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

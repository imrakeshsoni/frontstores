// [study] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, TrendingUp } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listExamResults, addExamResult, deleteExamResult, getGradeTrends } from '@/lib/db/study';

const SUBJECTS = ['Mathematics','Physics','Chemistry','Biology','History','Geography','English','Economics','Science','Hindi','Other'];

function pctColor(pct: number) {
  if (pct >= 80) return { color: '#16a34a', bg: '#dcfce7' };
  if (pct >= 60) return { color: '#d97706', bg: '#fef3c7' };
  return { color: '#dc2626', bg: '#fee2e2' };
}

export function ExamResultsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [activeSubject, setActiveSubject] = useState('');
  const [form, setForm] = useState({ subject: '', test_name: '', marks_obtained: '', max_marks: '100', test_date: new Date().toISOString().slice(0,10), notes: '' });

  const { data: results = [] } = useQuery({ queryKey: ['study-results', tenantId], queryFn: () => listExamResults(tenantId), enabled: !!tenantId });
  const { data: trends = [] } = useQuery({
    queryKey: ['study-trends', tenantId, activeSubject],
    queryFn: () => getGradeTrends(tenantId, activeSubject),
    enabled: !!tenantId && !!activeSubject,
  });

  const addMutation = useMutation({
    mutationFn: () => addExamResult(tenantId, {
      subject: form.subject, test_name: form.test_name.trim(),
      marks_obtained: parseFloat(form.marks_obtained), max_marks: parseFloat(form.max_marks),
      test_date: form.test_date, notes: form.notes.trim() || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['study-results'] }); qc.invalidateQueries({ queryKey: ['study-trends'] }); setShowAdd(false); setForm({ subject:'',test_name:'',marks_obtained:'',max_marks:'100',test_date:new Date().toISOString().slice(0,10),notes:'' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteExamResult(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['study-results'] }); qc.invalidateQueries({ queryKey: ['study-trends'] }); },
  });

  const subjects = [...new Set(results.map(r => r.subject))].sort();
  const shown = activeSubject ? results.filter(r => r.subject === activeSubject) : results;

  // Subject averages
  const subjectAverages = subjects.map(s => {
    const rs = results.filter(r => r.subject === s);
    const avg = rs.reduce((sum, r) => sum + (r.marks_obtained / r.max_marks) * 100, 0) / rs.length;
    return { subject: s, avg: Math.round(avg), count: rs.length };
  }).sort((a,b) => b.avg - a.avg);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: '#dcfce7' }}>
            <TrendingUp className="h-5 w-5" style={{ color: '#16a34a' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Exam Results</h1>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Track marks, see grade trends</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white" style={{ background: 'var(--accent)' }}>
          <Plus className="h-4 w-4" /> Add Result
        </button>
      </div>

      {/* Subject averages */}
      {subjectAverages.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {subjectAverages.map(s => {
            const c = pctColor(s.avg);
            return (
              <button key={s.subject} onClick={() => setActiveSubject(prev => prev === s.subject ? '' : s.subject)}
                className="rounded-2xl p-4 text-left transition-all"
                style={{ background: activeSubject === s.subject ? c.bg : 'var(--surface)', border: `2px solid ${activeSubject === s.subject ? c.color : 'var(--surface-border)'}` }}>
                <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>{s.subject}</p>
                <p className="text-2xl font-black mt-1" style={{ color: c.color }}>{s.avg}%</p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{s.count} test{s.count > 1 ? 's' : ''}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Trend chart for selected subject */}
      {activeSubject && trends.length > 1 && (
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <p className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>📈 {activeSubject} — Trend</p>
          <div className="relative h-32">
            <div className="absolute inset-0 flex items-end gap-2">
              {trends.map((t, i) => {
                const c = pctColor(t.pct);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1" style={{ minWidth: 0 }}>
                    <span className="text-xs font-bold" style={{ color: c.color }}>{t.pct}%</span>
                    <div className="w-full rounded-t-lg transition-all" style={{ height: `${t.pct}%`, background: c.color, minHeight: 4 }} />
                    <span className="text-xs truncate w-full text-center" style={{ color: 'var(--text-tertiary)', fontSize: 9 }}>{t.test.substring(0,8)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Subject filter */}
      {subjects.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => setActiveSubject('')}
            className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold"
            style={!activeSubject ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
            All
          </button>
          {subjects.map(s => (
            <button key={s} onClick={() => setActiveSubject(prev => prev === s ? '' : s)}
              className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold"
              style={activeSubject === s ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {results.length === 0 && (
        <div className="rounded-2xl p-10 flex flex-col items-center gap-3 text-center" style={{ background: 'var(--surface)', border: '2px dashed var(--surface-border)' }}>
          <p className="text-4xl">📊</p>
          <p className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>No results yet</p>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Log your exam marks to track performance trends</p>
        </div>
      )}

      <div className="space-y-3">
        {shown.map(r => {
          const pct = Math.round((r.marks_obtained / r.max_marks) * 100);
          const c = pctColor(pct);
          return (
            <div key={r.id} className="flex items-center gap-4 rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
              <div className="h-14 w-14 rounded-xl flex flex-col items-center justify-center flex-shrink-0" style={{ background: c.bg }}>
                <p className="text-xl font-black" style={{ color: c.color }}>{pct}%</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate" style={{ color: 'var(--text-primary)' }}>{r.test_name}</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{r.subject} · {r.marks_obtained}/{r.max_marks}</p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{new Date(r.test_date).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}</p>
              </div>
              <button onClick={() => deleteMutation.mutate(r.id)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-red-50 text-red-400 flex-shrink-0">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-3" style={{ background: 'var(--bg)' }}>
            <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Add Result</h2>
            <input value={form.test_name} onChange={e => setForm(f => ({...f, test_name: e.target.value}))} placeholder="Test / Exam name"
              className="w-full px-4 py-3 rounded-xl text-sm border outline-none" style={{ background:'var(--surface)',borderColor:'var(--surface-border)',color:'var(--text-primary)' }} />
            <select value={form.subject} onChange={e => setForm(f => ({...f, subject: e.target.value}))}
              className="w-full px-4 py-3 rounded-xl text-sm border outline-none" style={{ background:'var(--surface)',borderColor:'var(--surface-border)',color:'var(--text-primary)' }}>
              <option value="">Subject</option>
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="flex gap-2">
              <input type="number" value={form.marks_obtained} onChange={e => setForm(f => ({...f, marks_obtained: e.target.value}))} placeholder="Marks obtained"
                className="flex-1 px-4 py-3 rounded-xl text-sm border outline-none" style={{ background:'var(--surface)',borderColor:'var(--surface-border)',color:'var(--text-primary)' }} />
              <input type="number" value={form.max_marks} onChange={e => setForm(f => ({...f, max_marks: e.target.value}))} placeholder="Out of"
                className="flex-1 px-4 py-3 rounded-xl text-sm border outline-none" style={{ background:'var(--surface)',borderColor:'var(--surface-border)',color:'var(--text-primary)' }} />
            </div>
            <input type="date" value={form.test_date} onChange={e => setForm(f => ({...f, test_date: e.target.value}))}
              className="w-full px-4 py-3 rounded-xl text-sm border outline-none" style={{ background:'var(--surface)',borderColor:'var(--surface-border)',color:'var(--text-primary)' }} />
            <div className="flex gap-3">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-3 rounded-xl font-semibold text-sm border" style={{ borderColor:'var(--surface-border)',color:'var(--text-secondary)' }}>Cancel</button>
              <button onClick={() => addMutation.mutate()} disabled={!form.test_name.trim() || !form.subject || !form.marks_obtained || addMutation.isPending}
                className="flex-1 py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-50" style={{ background:'var(--accent)' }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

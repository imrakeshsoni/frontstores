// [coaching] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, ClipboardList } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listExams, saveExam, listBatches, getExamResults, saveExamResults, listStudents, type CoachingExam } from '@/lib/db/coaching';

const EMPTY: Partial<CoachingExam> & { name: string; title: string } = {
  name: '', title: '', batch_id: null, batch_name: null, subject: null,
  exam_date: null, total_marks: 100, passing_marks: 35, notes: null,
};

export function ExamsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [resultsExam, setResultsExam] = useState<CoachingExam | null>(null);
  const [marks, setMarks] = useState<Record<string, string>>({});

  const { data: exams = [] } = useQuery({ queryKey: ['coaching-exams', tenantId], queryFn: () => listExams(tenantId), enabled: !!tenantId });
  const { data: batches = [] } = useQuery({ queryKey: ['coaching-batches', tenantId], queryFn: () => listBatches(tenantId), enabled: !!tenantId });

  const { data: results = [] } = useQuery({
    queryKey: ['coaching-exam-results', tenantId, resultsExam?.id],
    queryFn: () => getExamResults(tenantId, resultsExam!.id!),
    enabled: !!tenantId && !!resultsExam?.id,
  });

  const { data: batchStudents = [] } = useQuery({
    queryKey: ['coaching-students', tenantId, resultsExam?.batch_id],
    queryFn: () => listStudents(tenantId, resultsExam?.batch_id ?? undefined),
    enabled: !!tenantId && !!resultsExam,
  });

  const save = useMutation({
    mutationFn: (data: typeof EMPTY) => saveExam(tenantId, data as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['coaching-exams'] }); setForm(null); },
  });

  const saveResults = useMutation({
    mutationFn: () => saveExamResults(tenantId, resultsExam!.id!, batchStudents.map(s => ({
      student_id: s.id!, student_name: s.name,
      marks_obtained: marks[s.id!] !== undefined && marks[s.id!] !== '' ? Number(marks[s.id!]) : null,
      grade: null, remarks: null,
    }))),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['coaching-exam-results'] }); setResultsExam(null); },
  });

  const up = (k: keyof typeof EMPTY, v: any) => setForm(f => f ? { ...f, [k]: v } : f);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Exams & Tests</h1>
        <button onClick={() => setForm({ ...EMPTY })} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors">
          <Plus className="h-4 w-4" /> Add Exam
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {exams.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="font-medium">No exams scheduled yet</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {exams.map(e => (
              <div key={e.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors">
                <div>
                  <p className="font-medium text-slate-900">{e.title}</p>
                  <div className="flex gap-3 mt-0.5">
                    {e.subject && <span className="text-xs text-slate-400">{e.subject}</span>}
                    {e.batch_name && <span className="text-xs text-slate-400">📚 {e.batch_name}</span>}
                    {e.exam_date && <span className="text-xs text-slate-400">📅 {new Date(e.exam_date).toLocaleDateString('en-IN')}</span>}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">Total: {e.total_marks} · Passing: {e.passing_marks}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setResultsExam(e); setMarks(Object.fromEntries(results.map(r => [r.student_id, String(r.marks_obtained ?? '')])));  }} className="px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-600 border border-indigo-100 hover:bg-indigo-50">Results</button>
                  <button onClick={() => setForm({ ...e, name: e.title })} className="p-2 rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"><Edit2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Exam form */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">{form.id ? 'Edit Exam' : 'Add Exam'}</h2>
            <div className="space-y-3">
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Exam Title *</label><input className="input w-full" value={form.title} onChange={e => up('title', e.target.value)} placeholder="e.g. Unit Test 1" autoFocus /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Subject</label><input className="input w-full" value={form.subject ?? ''} onChange={e => up('subject', e.target.value || null)} placeholder="e.g. Mathematics" /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Batch</label>
                <select className="input w-full" value={form.batch_id ?? ''} onChange={e => { const b = batches.find(b => b.id === e.target.value); up('batch_id', b?.id ?? null); up('batch_name', b?.name ?? null); }}>
                  <option value="">All Batches</option>
                  {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Exam Date</label><input type="date" className="input w-full" value={form.exam_date ?? ''} onChange={e => up('exam_date', e.target.value || null)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Total Marks</label><input type="number" className="input w-full" value={form.total_marks} onChange={e => up('total_marks', Number(e.target.value))} /></div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Passing Marks</label><input type="number" className="input w-full" value={form.passing_marks} onChange={e => up('passing_marks', Number(e.target.value))} /></div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setForm(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => save.mutate(form as any)} disabled={!form.title.trim() || save.isPending} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {save.isPending ? 'Saving…' : 'Save Exam'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results entry */}
      {resultsExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">{resultsExam.title}</h2>
            <p className="text-xs text-slate-400 mb-4">Total: {resultsExam.total_marks} marks · Passing: {resultsExam.passing_marks}</p>
            <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
              {batchStudents.map(s => {
                const r = results.find(r => r.student_id === s.id);
                return (
                  <div key={s.id} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-800 flex-1">{s.name}</span>
                    <input type="number" min={0} max={resultsExam.total_marks} placeholder="Marks" value={marks[s.id!] ?? (r?.marks_obtained !== null && r?.marks_obtained !== undefined ? String(r.marks_obtained) : '')}
                      onChange={e => setMarks(m => ({ ...m, [s.id!]: e.target.value }))}
                      className="input w-24 text-right" />
                    {marks[s.id!] !== undefined && marks[s.id!] !== '' && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${Number(marks[s.id!]) >= resultsExam.passing_marks ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {Number(marks[s.id!]) >= resultsExam.passing_marks ? 'Pass' : 'Fail'}
                      </span>
                    )}
                  </div>
                );
              })}
              {batchStudents.length === 0 && <p className="text-slate-400 text-sm text-center py-8">No students in this batch</p>}
            </div>
            <div className="flex gap-3 pt-4 border-t border-slate-100 mt-4">
              <button onClick={() => setResultsExam(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => saveResults.mutate()} disabled={saveResults.isPending} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {saveResults.isPending ? 'Saving…' : 'Save Results'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

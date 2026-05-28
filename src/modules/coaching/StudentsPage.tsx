// [coaching] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit2, Trash2, Phone, BookOpen } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listStudents, listBatches, saveStudent, deleteStudent, type CoachingStudent } from '@/lib/db/coaching';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

const EMPTY: Partial<CoachingStudent> & { name: string } = {
  name: '', phone: null, parent_phone: null, email: null, address: null,
  batch_id: null, course: null, class_grade: null, fee_amount: 0, fee_due_day: 1, is_active: true, notes: null,
};

export function StudentsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [batchFilter, setBatchFilter] = useState('');

  const { data: students = [] } = useQuery({ queryKey: ['coaching-students', tenantId], queryFn: () => listStudents(tenantId), enabled: !!tenantId });
  const { data: batches = [] } = useQuery({ queryKey: ['coaching-batches', tenantId], queryFn: () => listBatches(tenantId), enabled: !!tenantId });

  const save = useMutation({
    mutationFn: (data: typeof EMPTY) => saveStudent(tenantId, data as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['coaching-students'] }); qc.invalidateQueries({ queryKey: ['coaching-stats'] }); setForm(null); },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteStudent(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['coaching-students'] }); qc.invalidateQueries({ queryKey: ['coaching-stats'] }); },
  });

  const up = (k: keyof typeof EMPTY, v: any) => setForm(f => f ? { ...f, [k]: v } : f);

  const filtered = students.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q || s.name.toLowerCase().includes(q) || (s.phone ?? '').includes(q);
    const matchBatch = !batchFilter || s.batch_id === batchFilter;
    return matchSearch && matchBatch;
  });

  const batchName = (id: string | null) => batches.find(b => b.id === id)?.name ?? '—';

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Students</h1>
        <button onClick={() => setForm({ ...EMPTY })} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors">
          <Plus className="h-4 w-4" /> Add Student
        </button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or phone…" className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
        <select value={batchFilter} onChange={e => setBatchFilter(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none">
          <option value="">All Batches</option>
          {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-4xl mb-2">🎓</p>
            <p className="font-medium">No students yet</p>
            <p className="text-sm mt-1">Add your first student to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map(s => (
              <div key={s.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-sm flex-shrink-0">
                    {s.name[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{s.name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {s.phone && <span className="flex items-center gap-1 text-xs text-slate-400"><Phone className="h-3 w-3" />{s.phone}</span>}
                      {s.batch_id && <span className="flex items-center gap-1 text-xs text-slate-400"><BookOpen className="h-3 w-3" />{batchName(s.batch_id)}</span>}
                      {s.class_grade && <span className="text-xs text-slate-400">{s.class_grade}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Monthly Fee</p>
                    <p className="text-sm font-semibold text-slate-800">{fmt(s.fee_amount)}</p>
                    {s.balance_due > 0 && <p className="text-xs font-medium text-red-500">Due: {fmt(s.balance_due)}</p>}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setForm({ ...s })} className="p-2 rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"><Edit2 className="h-4 w-4" /></button>
                    <button onClick={() => { if (confirm(`Remove ${s.name}?`)) del.mutate(s.id!); }} className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">{form.id ? 'Edit Student' : 'Add Student'}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="block text-xs font-medium text-slate-600 mb-1">Name *</label><input className="input w-full" value={form.name} onChange={e => up('name', e.target.value)} placeholder="Student name" autoFocus /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Phone</label><input className="input w-full" value={form.phone ?? ''} onChange={e => up('phone', e.target.value || null)} placeholder="Student phone" /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Parent Phone</label><input className="input w-full" value={form.parent_phone ?? ''} onChange={e => up('parent_phone', e.target.value || null)} placeholder="Parent phone" /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Class / Grade</label><input className="input w-full" value={form.class_grade ?? ''} onChange={e => up('class_grade', e.target.value || null)} placeholder="e.g. Class 10" /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Course</label><input className="input w-full" value={form.course ?? ''} onChange={e => up('course', e.target.value || null)} placeholder="e.g. NEET, JEE" /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Batch</label>
                <select className="input w-full" value={form.batch_id ?? ''} onChange={e => up('batch_id', e.target.value || null)}>
                  <option value="">No Batch</option>
                  {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Monthly Fee (₹)</label><input type="number" className="input w-full" value={form.fee_amount} onChange={e => up('fee_amount', Number(e.target.value))} /></div>
              <div className="col-span-2"><label className="block text-xs font-medium text-slate-600 mb-1">Address</label><input className="input w-full" value={form.address ?? ''} onChange={e => up('address', e.target.value || null)} placeholder="Address" /></div>
              <div className="col-span-2"><label className="block text-xs font-medium text-slate-600 mb-1">Notes</label><textarea className="input w-full" rows={2} value={form.notes ?? ''} onChange={e => up('notes', e.target.value || null)} placeholder="Any notes…" /></div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setForm(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => save.mutate(form as any)} disabled={!form.name.trim() || save.isPending} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {save.isPending ? 'Saving…' : 'Save Student'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

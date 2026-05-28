// [coaching] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Phone, BookOpen } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listTeachers, saveTeacher, deleteTeacher, type CoachingTeacher } from '@/lib/db/coaching';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

const EMPTY: Partial<CoachingTeacher> & { name: string } = {
  name: '', phone: null, email: null, subjects: null, salary: 0, is_active: true,
};

export function TeachersPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [form, setForm] = useState<typeof EMPTY | null>(null);

  const { data: teachers = [] } = useQuery({ queryKey: ['coaching-teachers', tenantId], queryFn: () => listTeachers(tenantId), enabled: !!tenantId });

  const save = useMutation({
    mutationFn: (data: typeof EMPTY) => saveTeacher(tenantId, data as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['coaching-teachers'] }); qc.invalidateQueries({ queryKey: ['coaching-stats'] }); setForm(null); },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteTeacher(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['coaching-teachers'] }); qc.invalidateQueries({ queryKey: ['coaching-stats'] }); },
  });

  const up = (k: keyof typeof EMPTY, v: any) => setForm(f => f ? { ...f, [k]: v } : f);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Teachers</h1>
        <button onClick={() => setForm({ ...EMPTY })} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors">
          <Plus className="h-4 w-4" /> Add Teacher
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {teachers.length === 0 ? (
          <div className="col-span-3 text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-100">
            <p className="text-4xl mb-2">👩‍🏫</p>
            <p className="font-medium">No teachers added yet</p>
          </div>
        ) : teachers.map(t => (
          <div key={t.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-semibold">
                  {t.name[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">{t.name}</h3>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${t.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {t.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
            <div className="space-y-1.5 mb-4">
              {t.phone && <p className="flex items-center gap-1.5 text-xs text-slate-500"><Phone className="h-3.5 w-3.5" />{t.phone}</p>}
              {t.subjects && <p className="flex items-center gap-1.5 text-xs text-slate-500"><BookOpen className="h-3.5 w-3.5" />{t.subjects}</p>}
              {t.salary > 0 && <p className="text-xs text-slate-500">💰 Salary: {fmt(t.salary)}/month</p>}
              {t.email && <p className="text-xs text-slate-400 truncate">✉ {t.email}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setForm({ ...t })} className="flex-1 py-1.5 rounded-lg text-xs font-medium text-indigo-600 border border-indigo-100 hover:bg-indigo-50">Edit</button>
              <button onClick={() => { if (confirm(`Remove ${t.name}?`)) del.mutate(t.id!); }} className="py-1.5 px-3 rounded-lg text-xs font-medium text-red-500 border border-red-100 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">{form.id ? 'Edit Teacher' : 'Add Teacher'}</h2>
            <div className="space-y-3">
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Name *</label><input className="input w-full" value={form.name} onChange={e => up('name', e.target.value)} placeholder="Teacher name" autoFocus /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Phone</label><input className="input w-full" value={form.phone ?? ''} onChange={e => up('phone', e.target.value || null)} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Email</label><input type="email" className="input w-full" value={form.email ?? ''} onChange={e => up('email', e.target.value || null)} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Subjects</label><input className="input w-full" value={form.subjects ?? ''} onChange={e => up('subjects', e.target.value || null)} placeholder="e.g. Maths, Physics" /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Monthly Salary (₹)</label><input type="number" className="input w-full" value={form.salary} onChange={e => up('salary', Number(e.target.value))} /></div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setForm(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => save.mutate(form as any)} disabled={!form.name.trim() || save.isPending} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {save.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

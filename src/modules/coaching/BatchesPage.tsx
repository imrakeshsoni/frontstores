// [coaching] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Users, Clock } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listBatches, saveBatch, deleteBatch, listTeachers, type CoachingBatch } from '@/lib/db/coaching';

const EMPTY: Partial<CoachingBatch> & { name: string } = {
  name: '', subject: null, teacher_id: null, teacher_name: null,
  days: null, start_time: null, end_time: null, room: null, capacity: 30, is_active: true,
};

export function BatchesPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [form, setForm] = useState<typeof EMPTY | null>(null);

  const { data: batches = [] } = useQuery({ queryKey: ['coaching-batches', tenantId], queryFn: () => listBatches(tenantId), enabled: !!tenantId });
  const { data: teachers = [] } = useQuery({ queryKey: ['coaching-teachers', tenantId], queryFn: () => listTeachers(tenantId), enabled: !!tenantId });

  const save = useMutation({
    mutationFn: (data: typeof EMPTY) => saveBatch(tenantId, data as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['coaching-batches'] }); qc.invalidateQueries({ queryKey: ['coaching-stats'] }); setForm(null); },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteBatch(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['coaching-batches'] }); qc.invalidateQueries({ queryKey: ['coaching-stats'] }); },
  });

  const up = (k: keyof typeof EMPTY, v: any) => setForm(f => f ? { ...f, [k]: v } : f);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Batches</h1>
        <button onClick={() => setForm({ ...EMPTY })} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors">
          <Plus className="h-4 w-4" /> Add Batch
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {batches.length === 0 ? (
          <div className="col-span-3 text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-100">
            <p className="text-4xl mb-2">📚</p>
            <p className="font-medium">No batches yet</p>
          </div>
        ) : batches.map(b => (
          <div key={b.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-slate-900">{b.name}</h3>
                {b.subject && <p className="text-xs text-slate-500 mt-0.5">{b.subject}</p>}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                {b.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="space-y-1.5 mb-4">
              {b.teacher_name && <p className="text-xs text-slate-500">👩‍🏫 {b.teacher_name}</p>}
              {b.days && <p className="text-xs text-slate-500">📅 {b.days}</p>}
              {(b.start_time || b.end_time) && (
                <p className="flex items-center gap-1 text-xs text-slate-500">
                  <Clock className="h-3 w-3" />{b.start_time ?? ''} – {b.end_time ?? ''}
                </p>
              )}
              {b.room && <p className="text-xs text-slate-500">🚪 Room: {b.room}</p>}
              <p className="flex items-center gap-1 text-xs text-slate-500">
                <Users className="h-3 w-3" />{b.student_count ?? 0} / {b.capacity} students
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setForm({ ...b })} className="flex-1 py-1.5 rounded-lg text-xs font-medium text-indigo-600 border border-indigo-100 hover:bg-indigo-50 transition-colors">Edit</button>
              <button onClick={() => { if (confirm(`Delete batch "${b.name}"?`)) del.mutate(b.id!); }} className="py-1.5 px-3 rounded-lg text-xs font-medium text-red-500 border border-red-100 hover:bg-red-50 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">{form.id ? 'Edit Batch' : 'Add Batch'}</h2>
            <div className="space-y-3">
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Batch Name *</label><input className="input w-full" value={form.name} onChange={e => up('name', e.target.value)} placeholder="e.g. Morning Batch A" autoFocus /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Subject</label><input className="input w-full" value={form.subject ?? ''} onChange={e => up('subject', e.target.value || null)} placeholder="e.g. Mathematics" /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Teacher</label>
                <select className="input w-full" value={form.teacher_id ?? ''} onChange={e => {
                  const t = teachers.find(t => t.id === e.target.value);
                  up('teacher_id', t?.id ?? null); up('teacher_name', t?.name ?? null);
                }}>
                  <option value="">No teacher assigned</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Days</label><input className="input w-full" value={form.days ?? ''} onChange={e => up('days', e.target.value || null)} placeholder="e.g. Mon, Wed, Fri" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Start Time</label><input type="time" className="input w-full" value={form.start_time ?? ''} onChange={e => up('start_time', e.target.value || null)} /></div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">End Time</label><input type="time" className="input w-full" value={form.end_time ?? ''} onChange={e => up('end_time', e.target.value || null)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Room</label><input className="input w-full" value={form.room ?? ''} onChange={e => up('room', e.target.value || null)} placeholder="Room no." /></div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Capacity</label><input type="number" className="input w-full" value={form.capacity} onChange={e => up('capacity', Number(e.target.value))} /></div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setForm(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => save.mutate(form as any)} disabled={!form.name.trim() || save.isPending} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {save.isPending ? 'Saving…' : 'Save Batch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

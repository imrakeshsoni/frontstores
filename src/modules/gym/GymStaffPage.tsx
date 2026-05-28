// [gym] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Phone } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listGymStaff, saveGymStaff, deleteGymStaff, type GymStaff } from '@/lib/db/gym';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

const EMPTY: Partial<GymStaff> & { name: string } = { name: '', phone: null, role: 'trainer', salary: 0, is_active: true };

export function GymStaffPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [form, setForm] = useState<typeof EMPTY | null>(null);

  const { data: staff = [] } = useQuery({ queryKey: ['gym-staff', tenantId], queryFn: () => listGymStaff(tenantId), enabled: !!tenantId });

  const save = useMutation({
    mutationFn: (d: typeof EMPTY) => saveGymStaff(tenantId, d as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gym-staff'] }); setForm(null); },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteGymStaff(tenantId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gym-staff'] }),
  });

  const up = (k: keyof typeof EMPTY, v: any) => setForm(f => f ? { ...f, [k]: v } : f);

  const roleEmoji: Record<string, string> = { trainer: '🏋️', receptionist: '👩‍💼', manager: '👔', cleaner: '🧹', other: '👤' };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Staff</h1>
        <button onClick={() => setForm({ ...EMPTY })} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus className="h-4 w-4" /> Add Staff
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {staff.length === 0 ? (
          <div className="col-span-3 text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-100">
            <p className="text-4xl mb-2">👥</p>
            <p className="font-medium">No staff added yet</p>
          </div>
        ) : staff.map(s => (
          <div key={s.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-start gap-3 mb-3">
              <span className="text-2xl">{roleEmoji[s.role] ?? '👤'}</span>
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">{s.name}</h3>
                <span className="text-xs capitalize text-slate-500">{s.role}</span>
              </div>
              <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{s.is_active ? 'Active' : 'Inactive'}</span>
            </div>
            {s.phone && <p className="flex items-center gap-1.5 text-xs text-slate-500 mb-1"><Phone className="h-3.5 w-3.5" />{s.phone}</p>}
            {s.salary > 0 && <p className="text-xs text-slate-500">💰 {fmt(s.salary)}/month</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={() => setForm({ ...s })} className="flex-1 py-1.5 rounded-lg text-xs font-medium text-blue-600 border border-blue-100 hover:bg-blue-50">Edit</button>
              <button onClick={() => { if (confirm(`Remove ${s.name}?`)) del.mutate(s.id!); }} className="py-1.5 px-3 rounded-lg text-xs font-medium text-red-500 border border-red-100 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">{form.id ? 'Edit Staff' : 'Add Staff'}</h2>
            <div className="space-y-3">
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Name *</label><input className="input w-full" value={form.name} onChange={e => up('name', e.target.value)} autoFocus /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Phone</label><input className="input w-full" value={form.phone ?? ''} onChange={e => up('phone', e.target.value || null)} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
                <select className="input w-full" value={form.role} onChange={e => up('role', e.target.value)}>
                  <option value="trainer">Trainer</option>
                  <option value="receptionist">Receptionist</option>
                  <option value="manager">Manager</option>
                  <option value="cleaner">Cleaner</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Monthly Salary (₹)</label><input type="number" className="input w-full" value={form.salary} onChange={e => up('salary', Number(e.target.value))} /></div>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={!!form.is_active} onChange={e => up('is_active', e.target.checked)} className="rounded" /><span className="text-sm text-slate-700">Active</span></label>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setForm(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => save.mutate(form as any)} disabled={!form.name.trim() || save.isPending} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {save.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

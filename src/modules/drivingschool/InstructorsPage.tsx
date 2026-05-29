// [drivingschool] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, AlertTriangle, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { listDSInstructors, saveDSInstructor, deleteDSInstructor, type DSInstructor } from '@/lib/db/drivingschool';

const EMPTY: Partial<DSInstructor> & { name: string } = {
  name: '', phone: '', license_no: '', license_expiry: '', status: 'active',
};

export function InstructorsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [form, setForm] = useState<typeof EMPTY | null>(null);

  const { data: instructors = [] } = useQuery({
    queryKey: ['ds-instructors', tenantId],
    queryFn: () => listDSInstructors(tenantId),
    enabled: !!tenantId,
  });

  const save = useMutation({
    mutationFn: (data: typeof EMPTY) => saveDSInstructor(tenantId, data as DSInstructor & { name: string }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ds-instructors'] }); setForm(null); toast.success('Saved'); },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteDSInstructor(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ds-instructors'] }); toast.success('Instructor removed'); },
  });

  const up = (k: keyof typeof EMPTY, v: string) => setForm(f => f ? { ...f, [k]: v } : f);

  const today = new Date().toISOString().slice(0,10);
  const soon = new Date(Date.now() + 30 * 86400000).toISOString().slice(0,10);
  const expiringLicenses = instructors.filter(i => i.license_expiry && i.license_expiry <= soon);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Instructors</h1>
        <button onClick={() => setForm({ ...EMPTY })} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-medium" style={{ background: '#2563eb' }}>
          <Plus className="h-4 w-4" /> Add Instructor
        </button>
      </div>

      {expiringLicenses.length > 0 && (
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-orange-800">License Expiring Soon</p>
            <p className="text-xs text-orange-700">{expiringLicenses.map(i => `${i.name} (${i.license_expiry})`).join(', ')}</p>
          </div>
        </div>
      )}

      <div className="rounded-2xl border shadow-sm overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        {instructors.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--text-secondary)' }}>
            <p className="text-4xl mb-2">👨‍🏫</p>
            <p className="font-medium">No instructors added yet</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--surface-border)' }}>
            {instructors.map(i => {
              const licExpiry = i.license_expiry;
              const licColor = !licExpiry ? null : licExpiry < today ? { color: '#dc2626', bg: '#fee2e2' } : licExpiry <= soon ? { color: '#d97706', bg: '#fef3c7' } : { color: '#16a34a', bg: '#dcfce7' };
              return (
                <div key={i.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full flex items-center justify-center text-white font-semibold text-sm" style={{ background: '#2563eb' }}>
                      {i.name[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{i.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {i.phone && <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-tertiary)' }}><Phone className="h-3 w-3" />{i.phone}</span>}
                        {i.license_no && <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Lic: {i.license_no}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {licColor && (
                      <div className="text-right">
                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>License expiry</p>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: licColor.color, background: licColor.bg }}>{i.license_expiry}</span>
                      </div>
                    )}
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${i.status === 'active' ? 'text-green-600 bg-green-100' : 'text-slate-500 bg-slate-100'}`}>{i.status}</span>
                    <div className="flex gap-1">
                      <button onClick={() => setForm({ ...i, license_expiry: i.license_expiry??'' })} className="p-2 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"><Edit2 className="h-4 w-4" /></button>
                      <button onClick={() => { if (confirm(`Remove ${i.name}?`)) del.mutate(i.id); }} className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">{form.id ? 'Edit Instructor' : 'Add Instructor'}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="block text-xs font-medium mb-1 text-slate-600">Name *</label><input className="input w-full" value={form.name} onChange={e => up('name', e.target.value)} autoFocus /></div>
              <div><label className="block text-xs font-medium mb-1 text-slate-600">Phone</label><input className="input w-full" value={form.phone} onChange={e => up('phone', e.target.value)} /></div>
              <div><label className="block text-xs font-medium mb-1 text-slate-600">Status</label><select className="input w-full" value={form.status} onChange={e => up('status', e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
              <div><label className="block text-xs font-medium mb-1 text-slate-600">License No.</label><input className="input w-full" value={form.license_no} onChange={e => up('license_no', e.target.value)} /></div>
              <div><label className="block text-xs font-medium mb-1 text-slate-600">License Expiry</label><input type="date" className="input w-full" value={form.license_expiry??''} onChange={e => up('license_expiry', e.target.value)} /></div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setForm(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => save.mutate(form)} disabled={!form.name.trim() || save.isPending} className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50" style={{ background: '#2563eb' }}>
                {save.isPending ? 'Saving…' : 'Save Instructor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

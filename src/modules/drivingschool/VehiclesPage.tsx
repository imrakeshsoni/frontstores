// [drivingschool] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { listDSVehicles, saveDSVehicle, deleteDSVehicle, type DSVehicle } from '@/lib/db/drivingschool';

const EMPTY: Partial<DSVehicle> & { reg_no: string } = {
  reg_no: '', type: 'car', brand: '', model: '',
  fitness_expiry: '', insurance_expiry: '', status: 'active',
};

export function VehiclesPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [form, setForm] = useState<typeof EMPTY | null>(null);

  const { data: vehicles = [] } = useQuery({
    queryKey: ['ds-vehicles', tenantId],
    queryFn: () => listDSVehicles(tenantId),
    enabled: !!tenantId,
  });

  const save = useMutation({
    mutationFn: (data: typeof EMPTY) => saveDSVehicle(tenantId, data as DSVehicle & { reg_no: string }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ds-vehicles'] }); setForm(null); toast.success('Saved'); },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteDSVehicle(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ds-vehicles'] }); toast.success('Vehicle removed'); },
  });

  const up = (k: keyof typeof EMPTY, v: string) => setForm(f => f ? { ...f, [k]: v } : f);

  const today = new Date().toISOString().slice(0,10);
  const soon = new Date(Date.now() + 30 * 86400000).toISOString().slice(0,10);

  function docStatus(date: string | null | undefined) {
    if (!date) return null;
    if (date < today) return { label: 'Expired', color: '#dc2626', bg: '#fee2e2' };
    if (date <= soon) return { label: 'Expiring Soon', color: '#d97706', bg: '#fef3c7' };
    return { label: 'Valid', color: '#16a34a', bg: '#dcfce7' };
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Fleet / Vehicles</h1>
        <button onClick={() => setForm({ ...EMPTY })} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-medium" style={{ background: '#2563eb' }}>
          <Plus className="h-4 w-4" /> Add Vehicle
        </button>
      </div>

      {vehicles.some(v => (v.fitness_expiry && v.fitness_expiry <= soon) || (v.insurance_expiry && v.insurance_expiry <= soon)) && (
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-orange-800">Documents Expiring Soon</p>
            <p className="text-xs text-orange-700">Check fitness and insurance expiry dates below</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {vehicles.length === 0 ? (
          <div className="col-span-3 text-center py-16" style={{ color: 'var(--text-secondary)' }}>
            <p className="text-4xl mb-2">🚗</p>
            <p className="font-medium">No vehicles added yet</p>
          </div>
        ) : vehicles.map(v => {
          const fitnessStatus = docStatus(v.fitness_expiry);
          const insuranceStatus = docStatus(v.insurance_expiry);
          return (
            <div key={v.id} className="rounded-2xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{v.reg_no}</p>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{v.brand} {v.model} · <span className="capitalize">{v.type}</span></p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${v.status === 'active' ? 'text-green-600 bg-green-100' : 'text-slate-500 bg-slate-100'}`}>{v.status}</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span style={{ color: 'var(--text-tertiary)' }}>Fitness Expiry</span>
                  <div className="flex items-center gap-1.5">
                    <span style={{ color: 'var(--text-secondary)' }}>{v.fitness_expiry || '—'}</span>
                    {fitnessStatus && <span className="px-1.5 py-0.5 rounded-full font-medium" style={{ color: fitnessStatus.color, background: fitnessStatus.bg }}>{fitnessStatus.label}</span>}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span style={{ color: 'var(--text-tertiary)' }}>Insurance Expiry</span>
                  <div className="flex items-center gap-1.5">
                    <span style={{ color: 'var(--text-secondary)' }}>{v.insurance_expiry || '—'}</span>
                    {insuranceStatus && <span className="px-1.5 py-0.5 rounded-full font-medium" style={{ color: insuranceStatus.color, background: insuranceStatus.bg }}>{insuranceStatus.label}</span>}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => setForm({ ...v, fitness_expiry: v.fitness_expiry??'', insurance_expiry: v.insurance_expiry??'' })} className="flex-1 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-50 text-blue-600 transition-colors border border-blue-100"><Edit2 className="h-3.5 w-3.5 inline mr-1" />Edit</button>
                <button onClick={() => { if (confirm(`Remove ${v.reg_no}?`)) del.mutate(v.id); }} className="flex-1 py-1.5 rounded-lg text-xs font-medium hover:bg-red-50 text-red-500 transition-colors border border-red-100"><Trash2 className="h-3.5 w-3.5 inline mr-1" />Remove</button>
              </div>
            </div>
          );
        })}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">{form.id ? 'Edit Vehicle' : 'Add Vehicle'}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="block text-xs font-medium mb-1 text-slate-600">Registration No. *</label><input className="input w-full" value={form.reg_no} onChange={e => up('reg_no', e.target.value.toUpperCase())} autoFocus placeholder="MH12AB1234" /></div>
              <div><label className="block text-xs font-medium mb-1 text-slate-600">Type</label><select className="input w-full" value={form.type} onChange={e => up('type', e.target.value)}><option value="car">Car</option><option value="bike">Bike</option><option value="heavy">Heavy Vehicle</option></select></div>
              <div><label className="block text-xs font-medium mb-1 text-slate-600">Status</label><select className="input w-full" value={form.status} onChange={e => up('status', e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option><option value="maintenance">Maintenance</option></select></div>
              <div><label className="block text-xs font-medium mb-1 text-slate-600">Brand</label><input className="input w-full" value={form.brand} onChange={e => up('brand', e.target.value)} /></div>
              <div><label className="block text-xs font-medium mb-1 text-slate-600">Model</label><input className="input w-full" value={form.model} onChange={e => up('model', e.target.value)} /></div>
              <div><label className="block text-xs font-medium mb-1 text-slate-600">Fitness Expiry</label><input type="date" className="input w-full" value={form.fitness_expiry??''} onChange={e => up('fitness_expiry', e.target.value)} /></div>
              <div><label className="block text-xs font-medium mb-1 text-slate-600">Insurance Expiry</label><input type="date" className="input w-full" value={form.insurance_expiry??''} onChange={e => up('insurance_expiry', e.target.value)} /></div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setForm(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => save.mutate(form)} disabled={!form.reg_no.trim() || save.isPending} className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50" style={{ background: '#2563eb' }}>
                {save.isPending ? 'Saving…' : 'Save Vehicle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

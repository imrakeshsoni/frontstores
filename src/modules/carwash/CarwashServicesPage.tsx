// [carwash] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, Zap } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listAllServices, createService, updateService, deleteService, seedDefaultServices, type CarwashService } from '@/lib/db/carwash';

type ServiceForm = {
  name: string; description: string;
  price_hatchback: string; price_sedan: string; price_suv: string; price_luxury: string;
  duration_minutes: string; gst_rate: string; is_active: boolean;
};

const emptyForm: ServiceForm = {
  name: '', description: '', price_hatchback: '', price_sedan: '', price_suv: '', price_luxury: '',
  duration_minutes: '30', gst_rate: '18', is_active: true,
};

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function CarwashServicesPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CarwashService | null>(null);
  const [form, setForm] = useState<ServiceForm>(emptyForm);

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['carwash-services-all', tenantId],
    queryFn: () => listAllServices(tenantId),
    enabled: !!tenantId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['carwash-services-all'] });
    qc.invalidateQueries({ queryKey: ['carwash-services'] });
  };

  const openEdit = (svc: CarwashService) => {
    setEditing(svc);
    setForm({
      name: svc.name, description: svc.description ?? '',
      price_hatchback: String(svc.price_hatchback), price_sedan: String(svc.price_sedan),
      price_suv: String(svc.price_suv), price_luxury: String(svc.price_luxury),
      duration_minutes: String(svc.duration_minutes), gst_rate: String(svc.gst_rate),
      is_active: svc.is_active,
    });
    setShowForm(true);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!form.name.trim()) throw new Error('Service name required');
      const data = {
        name: form.name.trim(), description: form.description || null,
        price_hatchback: Number(form.price_hatchback) || 0, price_sedan: Number(form.price_sedan) || 0,
        price_suv: Number(form.price_suv) || 0, price_luxury: Number(form.price_luxury) || 0,
        duration_minutes: Number(form.duration_minutes) || 30, gst_rate: Number(form.gst_rate) || 18,
        is_active: form.is_active, sort_order: editing?.sort_order ?? 99,
      };
      return editing ? updateService(tenantId, editing.id, data) : createService(tenantId, data);
    },
    onSuccess: () => {
      toast.success(editing ? 'Service updated' : 'Service added');
      setShowForm(false); setEditing(null); setForm(emptyForm);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Save failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteService(tenantId, id),
    onSuccess: () => { toast.success('Service removed'); invalidate(); },
  });

  const seedMutation = useMutation({
    mutationFn: () => seedDefaultServices(tenantId),
    onSuccess: () => { toast.success('Default services added!'); invalidate(); },
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Car Wash</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Services & Pricing</h1>
        </div>
        <div className="flex gap-2">
          {services.length === 0 && (
            <button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm btn-secondary">
              <Zap className="h-4 w-4" /> Add Defaults
            </button>
          )}
          <button onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white"
            style={{ background: 'var(--accent)' }}>
            <Plus className="h-4 w-4" /> Add Service
          </button>
        </div>
      </div>

      {/* Pricing grid */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--surface-border)' }}>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>Service</th>
                <th className="text-center px-3 py-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>🚗 Hatchback</th>
                <th className="text-center px-3 py-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>🚙 Sedan</th>
                <th className="text-center px-3 py-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>🚐 SUV</th>
                <th className="text-center px-3 py-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>🏎️ Luxury</th>
                <th className="text-center px-3 py-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>Time</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 7 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 rounded animate-pulse" style={{ background: 'var(--surface-2)' }} /></td>
                ))}</tr>
              ))}
              {!isLoading && services.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  No services yet. Click "Add Defaults" to get started quickly.
                </td></tr>
              )}
              {services.map(svc => (
                <tr key={svc.id} style={{ borderBottom: '1px solid var(--surface-border)', opacity: svc.is_active ? 1 : 0.5 }}>
                  <td className="px-4 py-3">
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{svc.name}</p>
                    {svc.description && <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{svc.description}</p>}
                  </td>
                  <td className="text-center px-3 py-3 font-semibold" style={{ color: 'var(--accent)' }}>{fmt(svc.price_hatchback)}</td>
                  <td className="text-center px-3 py-3 font-semibold" style={{ color: 'var(--accent)' }}>{fmt(svc.price_sedan)}</td>
                  <td className="text-center px-3 py-3 font-semibold" style={{ color: 'var(--accent)' }}>{fmt(svc.price_suv)}</td>
                  <td className="text-center px-3 py-3 font-semibold" style={{ color: 'var(--accent)' }}>{fmt(svc.price_luxury)}</td>
                  <td className="text-center px-3 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>{svc.duration_minutes}m</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(svc)} className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => deleteMutation.mutate(svc.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="rounded-2xl p-6 w-full max-w-lg space-y-5 max-h-[90vh] overflow-y-auto"
            style={{ background: 'var(--surface)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{editing ? 'Edit Service' : 'Add Service'}</h2>
              <button onClick={() => { setShowForm(false); setEditing(null); }} className="btn-secondary text-sm">Close</button>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Service Name *</label>
              <input value={form.name} onChange={(e) => setForm(c => ({ ...c, name: e.target.value }))}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
                style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Price per Vehicle Type (₹)</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'price_hatchback', label: '🚗 Hatchback' },
                  { key: 'price_sedan',     label: '🚙 Sedan' },
                  { key: 'price_suv',       label: '🚐 SUV' },
                  { key: 'price_luxury',    label: '🏎️ Luxury' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>{label}</label>
                    <input type="number" value={(form as any)[key]} onChange={(e) => setForm(c => ({ ...c, [key]: e.target.value }))}
                      placeholder="0" className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                      style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Duration (min)</label>
                <input type="number" value={form.duration_minutes} onChange={(e) => setForm(c => ({ ...c, duration_minutes: e.target.value }))}
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>GST Rate (%)</label>
                <select value={form.gst_rate} onChange={(e) => setForm(c => ({ ...c, gst_rate: e.target.value }))}
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }}>
                  {[0, 5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm(c => ({ ...c, is_active: e.target.checked }))} />
              <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Active (show in job card)</span>
            </label>

            <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
              className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-60"
              style={{ background: 'var(--accent)' }}>
              {saveMutation.isPending ? 'Saving…' : editing ? 'Update Service' : 'Add Service'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

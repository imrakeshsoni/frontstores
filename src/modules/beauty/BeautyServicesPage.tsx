// [beauty] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, Zap } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import {
  listAllServices, createService, updateService, deleteService, seedDefaultServices,
  type BeautyService,
} from '@/lib/db/beauty';

const CATEGORIES = [
  { value: 'hair',    label: 'Hair', emoji: '💇' },
  { value: 'skin',    label: 'Skin / Facial', emoji: '✨' },
  { value: 'wax',     label: 'Waxing', emoji: '🕯️' },
  { value: 'thread',  label: 'Threading', emoji: '🪡' },
  { value: 'nails',   label: 'Nails', emoji: '💅' },
  { value: 'makeup',  label: 'Makeup', emoji: '💄' },
  { value: 'mehendi', label: 'Mehendi', emoji: '🌿' },
  { value: 'massage', label: 'Massage', emoji: '💆' },
  { value: 'other',   label: 'Other', emoji: '✂️' },
];

type Form = {
  name: string; category: string; description: string;
  price: string; duration_minutes: string; gst_rate: string; is_active: boolean;
};

const emptyForm: Form = {
  name: '', category: 'hair', description: '', price: '', duration_minutes: '30', gst_rate: '18', is_active: true,
};

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }
function catLabel(v: string) { return CATEGORIES.find(c => c.value === v) ?? { label: v, emoji: '✂️' }; }

export function BeautyServicesPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BeautyService | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [filterCat, setFilterCat] = useState<string>('all');

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['beauty-services-all', tenantId],
    queryFn:  () => listAllServices(tenantId),
    enabled:  !!tenantId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['beauty-services'] });

  const openEdit = (svc: BeautyService) => {
    setEditing(svc);
    setForm({ name: svc.name, category: svc.category, description: svc.description ?? '', price: String(svc.price), duration_minutes: String(svc.duration_minutes), gst_rate: String(svc.gst_rate), is_active: svc.is_active });
    setShowForm(true);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!form.name.trim()) throw new Error('Service name required');
      const data = { name: form.name.trim(), category: form.category, description: form.description || null, price: Number(form.price) || 0, duration_minutes: Number(form.duration_minutes) || 30, gst_rate: Number(form.gst_rate) || 18, is_active: form.is_active, sort_order: editing?.sort_order ?? 99 };
      return editing ? updateService(tenantId, editing.id, data) : createService(tenantId, data).then(() => {});
    },
    onSuccess: () => { toast.success(editing ? 'Service updated' : 'Service added'); setShowForm(false); setEditing(null); setForm(emptyForm); invalidate(); },
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

  const filtered = filterCat === 'all' ? services : services.filter(s => s.category === filterCat);
  const grouped = CATEGORIES.reduce<Record<string, BeautyService[]>>((acc, c) => {
    const svcs = filtered.filter(s => s.category === c.value);
    if (svcs.length) acc[c.value] = svcs;
    return acc;
  }, {});

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Beauty Parlor</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Services & Pricing</h1>
        </div>
        <div className="flex gap-2">
          {services.length === 0 && (
            <button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm border"
              style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
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

      {/* Category filter pills */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilterCat('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${filterCat === 'all' ? 'text-white' : ''}`}
          style={filterCat === 'all' ? { background: 'var(--accent)', borderColor: 'var(--accent)' } : { borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
          All ({services.length})
        </button>
        {CATEGORIES.map(c => {
          const cnt = services.filter(s => s.category === c.value).length;
          if (!cnt && filterCat !== c.value) return null;
          return (
            <button key={c.value} onClick={() => setFilterCat(c.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${filterCat === c.value ? 'text-white' : ''}`}
              style={filterCat === c.value ? { background: 'var(--accent)', borderColor: 'var(--accent)' } : { borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
              {c.emoji} {c.label} ({cnt})
            </button>
          );
        })}
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && services.length === 0 && (
        <div className="rounded-2xl p-10 flex flex-col items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <p className="text-4xl">✂️</p>
          <p className="font-semibold" style={{ color: 'var(--text-secondary)' }}>No services yet</p>
          <p className="text-sm text-center" style={{ color: 'var(--text-tertiary)' }}>Click "Add Defaults" to populate 20+ common beauty services instantly</p>
          <button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}
            className="mt-2 flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white"
            style={{ background: 'var(--accent)' }}>
            <Zap className="h-4 w-4" /> Add Default Services
          </button>
        </div>
      )}

      {/* Grouped service list */}
      {Object.entries(grouped).map(([cat, svcs]) => {
        const info = catLabel(cat);
        return (
          <div key={cat} className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--surface-border)' }}>
              <span className="text-base">{info.emoji}</span>
              <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{info.label}</span>
              <span className="text-xs ml-auto" style={{ color: 'var(--text-tertiary)' }}>{svcs.length} services</span>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {svcs.map((svc, idx) => (
                  <tr key={svc.id} style={{ borderBottom: idx < svcs.length - 1 ? '1px solid var(--surface-border)' : 'none', opacity: svc.is_active ? 1 : 0.45 }}>
                    <td className="px-4 py-3">
                      <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{svc.name}</p>
                      {svc.description && <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{svc.description}</p>}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>{fmt(svc.price)}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {svc.duration_minutes}m
                    </td>
                    <td className="px-4 py-3 text-right">
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
        );
      })}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="rounded-2xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto"
            style={{ background: 'var(--surface)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{editing ? 'Edit Service' : 'Add Service'}</h2>
              <button onClick={() => { setShowForm(false); setEditing(null); }} className="text-sm px-3 py-1.5 rounded-lg border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Close</button>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Service Name *</label>
              <input value={form.name} onChange={e => setForm(c => ({ ...c, name: e.target.value }))}
                placeholder="e.g. Hair Cut (Ladies)"
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
                style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Category</label>
              <select value={form.category} onChange={e => setForm(c => ({ ...c, category: e.target.value }))}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Price (₹) *</label>
                <input type="number" value={form.price} onChange={e => setForm(c => ({ ...c, price: e.target.value }))}
                  placeholder="0"
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Duration (min)</label>
                <input type="number" value={form.duration_minutes} onChange={e => setForm(c => ({ ...c, duration_minutes: e.target.value }))}
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>GST Rate</label>
              <select value={form.gst_rate} onChange={e => setForm(c => ({ ...c, gst_rate: e.target.value }))}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }}>
                {[0, 5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Description (optional)</label>
              <input value={form.description} onChange={e => setForm(c => ({ ...c, description: e.target.value }))}
                placeholder="Brief description"
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={e => setForm(c => ({ ...c, is_active: e.target.checked }))} />
              <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Active (show in appointments)</span>
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

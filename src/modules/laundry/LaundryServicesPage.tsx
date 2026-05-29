// [laundry] [all tenants]
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PlusCircle, Pencil, Trash2, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { listLaundryServices, saveLaundryService, deleteLaundryService, type LaundryService } from '@/lib/db/laundry';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

const SERVICE_TYPES = ['wash', 'dry-clean', 'iron', 'wash+iron', 'steam', 'starch'];

const SERVICE_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  wash:       { bg: '#dbeafe', text: '#2563eb' },
  'dry-clean':{ bg: '#ede9fe', text: '#7c3aed' },
  iron:       { bg: '#fef3c7', text: '#d97706' },
  'wash+iron':{ bg: '#dcfce7', text: '#16a34a' },
  steam:      { bg: '#cffafe', text: '#0891b2' },
  starch:     { bg: '#fce7f3', text: '#db2777' },
};

type FormState = { item_name: string; service_type: string; price: number };
const emptyForm: FormState = { item_name: '', service_type: 'wash', price: 0 };

export function LaundryServicesPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const { data: services = [] } = useQuery({
    queryKey: ['laundry-services', tenantId],
    queryFn: () => listLaundryServices(tenantId),
    enabled: !!tenantId,
  });

  function startEdit(svc: LaundryService) {
    setEditing(svc.id);
    setForm({ item_name: svc.item_name, service_type: svc.service_type, price: svc.price });
    setShowForm(false);
  }

  function startNew() {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function cancel() {
    setEditing(null);
    setShowForm(false);
    setForm(emptyForm);
  }

  async function save() {
    if (!form.item_name.trim()) { toast.error('Item name is required'); return; }
    if (form.price <= 0) { toast.error('Price must be greater than 0'); return; }
    setSaving(true);
    try {
      await saveLaundryService(tenantId, { item_name: form.item_name.trim(), service_type: form.service_type, price: form.price }, editing ?? undefined);
      qc.invalidateQueries({ queryKey: ['laundry-services'] });
      toast.success(editing ? 'Service updated' : 'Service added');
      cancel();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function del(id: string) {
    if (!confirm('Delete this service?')) return;
    await deleteLaundryService(tenantId, id);
    qc.invalidateQueries({ queryKey: ['laundry-services'] });
    toast.success('Deleted');
  }

  const grouped = SERVICE_TYPES.reduce<Record<string, LaundryService[]>>((acc, t) => {
    acc[t] = services.filter(s => s.service_type === t);
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Price List</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Manage laundry services and pricing</p>
        </div>
        <button onClick={startNew}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'var(--accent)' }}>
          <PlusCircle className="h-4 w-4" />
          Add Service
        </button>
      </div>

      {/* Add/Edit form */}
      {(showForm || editing !== null) && (
        <div className="rounded-2xl border p-5 space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
          <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{editing ? 'Edit Service' : 'New Service'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Item Name *</label>
              <input value={form.item_name} onChange={e => setForm(f => ({ ...f, item_name: e.target.value }))} placeholder="e.g. Shirt, Pant, Saree"
                className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Service Type</label>
              <select value={form.service_type} onChange={e => setForm(f => ({ ...f, service_type: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}>
                {SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Price (₹) *</label>
              <input type="number" value={form.price || ''} onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))} placeholder="0"
                className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: 'var(--accent)' }}>
              <Save className="h-4 w-4" />
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={cancel} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border"
              style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>
              <X className="h-4 w-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Services grouped by type */}
      {SERVICE_TYPES.map(type => {
        const list = grouped[type];
        if (!list || list.length === 0) return null;
        const colors = SERVICE_TYPE_COLORS[type] ?? { bg: '#f1f5f9', text: '#64748b' };
        return (
          <div key={type}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize" style={{ background: colors.bg, color: colors.text }}>
                {type}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{list.length} item{list.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {list.map(svc => (
                <div key={svc.id} className="flex items-center justify-between p-3 rounded-xl border"
                  style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
                  {editing === svc.id ? null : (
                    <>
                      <div>
                        <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{svc.item_name}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{fmt(svc.price)}</p>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => startEdit(svc)} className="p-1.5 rounded-lg" style={{ color: 'var(--text-tertiary)' }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => del(svc.id)} className="p-1.5 rounded-lg" style={{ color: '#ef4444' }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {services.length === 0 && !showForm && (
        <div className="text-center py-12 rounded-2xl border" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
          <p className="text-4xl mb-3">👕</p>
          <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No services yet</p>
          <p className="text-sm mb-4" style={{ color: 'var(--text-tertiary)' }}>Add your first laundry service with pricing</p>
          <button onClick={startNew} className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>
            Add Service
          </button>
        </div>
      )}
    </div>
  );
}

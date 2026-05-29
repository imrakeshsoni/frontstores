// [pestcontrol] [all tenants]
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PlusCircle, Pencil, Trash2, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { listPCCustomers, savePCCustomer, deletePCCustomer, type PCCustomer } from '@/lib/db/pestcontrol';

const PROPERTY_TYPES = ['residential', 'commercial', 'industrial', 'restaurant', 'hotel', 'warehouse'];
const PROPERTY_COLORS: Record<string, { bg: string; text: string }> = {
  residential:  { bg: '#dcfce7', text: '#16a34a' },
  commercial:   { bg: '#dbeafe', text: '#2563eb' },
  industrial:   { bg: '#fef3c7', text: '#d97706' },
  restaurant:   { bg: '#fee2e2', text: '#dc2626' },
  hotel:        { bg: '#ede9fe', text: '#7c3aed' },
  warehouse:    { bg: '#cffafe', text: '#0891b2' },
};

type FormState = { name: string; phone: string; address: string; property_type: string };
const emptyForm: FormState = { name: '', phone: '', address: '', property_type: 'residential' };

export function PCCustomersPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const { data: customers = [] } = useQuery({
    queryKey: ['pc-customers', tenantId, search],
    queryFn: () => listPCCustomers(tenantId, search),
    enabled: !!tenantId,
  });

  function startEdit(c: PCCustomer) {
    setEditing(c.id);
    setForm({ name: c.name, phone: c.phone, address: c.address, property_type: c.property_type });
    setShowForm(false);
  }

  function cancel() {
    setEditing(null);
    setShowForm(false);
    setForm(emptyForm);
  }

  async function save() {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (!form.address.trim()) { toast.error('Address is required'); return; }
    setSaving(true);
    try {
      await savePCCustomer(tenantId, { name: form.name.trim(), phone: form.phone.trim(), address: form.address.trim(), property_type: form.property_type }, editing ?? undefined);
      qc.invalidateQueries({ queryKey: ['pc-customers'] });
      toast.success(editing ? 'Customer updated' : 'Customer added');
      cancel();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function del(id: string) {
    if (!confirm('Delete this customer?')) return;
    await deletePCCustomer(tenantId, id);
    qc.invalidateQueries({ queryKey: ['pc-customers'] });
    toast.success('Deleted');
  }

  const inp = "w-full px-3 py-2.5 rounded-xl border text-sm outline-none";
  const inpStyle = { background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Customers</h1>
        <button onClick={() => { setShowForm(true); setEditing(null); setForm(emptyForm); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'var(--accent)' }}>
          <PlusCircle className="h-4 w-4" />
          Add Customer
        </button>
      </div>

      {(showForm || editing !== null) && (
        <div className="rounded-2xl border p-5 space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
          <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{editing ? 'Edit Customer' : 'New Customer'}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" className={inp} style={inpStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Phone</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone number" className={inp} style={inpStyle} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Address *</label>
              <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Full address" className={inp} style={inpStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Property Type</label>
              <select value={form.property_type} onChange={e => setForm(f => ({ ...f, property_type: e.target.value }))} className={inp} style={inpStyle}>
                {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: 'var(--accent)' }}>
              <Save className="h-4 w-4" />{saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={cancel} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border"
              style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>
              <X className="h-4 w-4" />Cancel
            </button>
          </div>
        </div>
      )}

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers…"
        className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none"
        style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />

      {customers.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: 'var(--text-tertiary)' }}>{search ? 'No customers found' : 'No customers yet'}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {customers.map(c => {
            const colors = PROPERTY_COLORS[c.property_type] ?? { bg: '#f1f5f9', text: '#64748b' };
            return (
              <div key={c.id} className="rounded-2xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
                    {c.phone && <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{c.phone}</p>}
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{c.address}</p>
                    <span className="inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                      style={{ background: colors.bg, color: colors.text }}>
                      {c.property_type}
                    </span>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <button onClick={() => startEdit(c)} className="p-1.5 rounded-lg" style={{ color: 'var(--text-tertiary)' }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => del(c.id)} className="p-1.5 rounded-lg" style={{ color: '#ef4444' }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

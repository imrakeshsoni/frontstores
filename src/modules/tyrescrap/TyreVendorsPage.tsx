// [tyrescrap] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, X, Phone, MapPin } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listVendors, saveVendor, deleteVendor, TyreVendor } from '@/lib/db/tyrescrap';

const EMPTY = { name: '', phone: '', address: '', notes: '' };

export function TyreVendorsPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [search, setSearch] = useState('');

  const { data: vendors = [] } = useQuery({
    queryKey: ['tyre-vendors', tenantId],
    queryFn:  () => listVendors(tenantId),
    enabled:  !!tenantId,
  });

  const saveMut = useMutation({
    mutationFn: () => saveVendor(tenantId, form, editId ?? undefined),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tyre-vendors'] }); closeForm(); },
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteVendor(tenantId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tyre-vendors'] }),
  });

  function openNew() { setForm({ ...EMPTY }); setEditId(null); setShowForm(true); }
  function openEdit(v: TyreVendor) {
    setForm({ name: v.name, phone: v.phone, address: v.address, notes: v.notes });
    setEditId(v.id); setShowForm(true);
  }
  function closeForm() { setShowForm(false); setEditId(null); }
  function set(k: string, v: string) { setForm((p) => ({ ...p, [k]: v })); }

  const filtered = vendors.filter((v) =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.phone?.includes(search)
  );

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Vendors — Scrap Tyre Suppliers</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{vendors.length} vendors</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow" style={{ background: '#ca8a04' }}>
          <Plus size={16} /> Add Vendor
        </button>
      </div>

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vendor name or phone…"
        className="w-full px-4 py-2.5 rounded-xl border text-sm mb-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />

      {filtered.length === 0 ? (
        <div className="text-center py-16" style={{ color: 'var(--text-tertiary)' }}>No vendors yet</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((v) => (
            <div key={v.id} className="rounded-2xl border p-4 flex items-start justify-between cursor-pointer hover:opacity-80"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }} onClick={() => openEdit(v)}>
              <div className="space-y-1">
                <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>{v.name}</div>
                {v.phone && (
                  <div className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <Phone size={13} /> {v.phone}
                  </div>
                )}
                {v.address && (
                  <div className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                    <MapPin size={13} /> {v.address}
                  </div>
                )}
                {v.notes && <div className="text-xs italic" style={{ color: 'var(--text-tertiary)' }}>{v.notes}</div>}
              </div>
              <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete vendor?')) delMut.mutate(v.id); }}
                className="p-1.5 rounded-lg" style={{ color: '#dc2626' }}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{editId ? 'Edit Vendor' : 'Add Vendor'}</h2>
              <button onClick={closeForm}><X size={20} style={{ color: 'var(--text-secondary)' }} /></button>
            </div>
            {[
              { k: 'name', label: 'Vendor Name *', ph: 'e.g. Ram Scrap' },
              { k: 'phone', label: 'Phone', ph: '98XXXXXXXX' },
              { k: 'address', label: 'Address', ph: 'City / area' },
              { k: 'notes', label: 'Notes', ph: 'Optional' },
            ].map(({ k, label, ph }) => (
              <div key={k}>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
                <input value={form[k as keyof typeof form]} onChange={(e) => set(k, e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} placeholder={ph} />
              </div>
            ))}
            <div className="flex gap-3 pt-1">
              <button onClick={closeForm} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Cancel</button>
              <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.name}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: '#ca8a04' }}>
                {saveMut.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

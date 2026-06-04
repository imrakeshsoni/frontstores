// [tyrescrap] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, X, Phone, MapPin, FileText } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listBuyers, saveBuyer, deleteBuyer, TyreBuyer } from '@/lib/db/tyrescrap';

const EMPTY = { name: '', phone: '', address: '', gst_number: '', notes: '' };

export function TyreBuyersPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [search, setSearch] = useState('');

  const { data: buyers = [] } = useQuery({
    queryKey: ['tyre-buyers', tenantId],
    queryFn:  () => listBuyers(tenantId),
    enabled:  !!tenantId,
  });

  const saveMut = useMutation({
    mutationFn: () => saveBuyer(tenantId, form, editId ?? undefined),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tyre-buyers'] }); closeForm(); },
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteBuyer(tenantId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tyre-buyers'] }),
  });

  function openNew() { setForm({ ...EMPTY }); setEditId(null); setShowForm(true); }
  function openEdit(b: TyreBuyer) {
    setForm({ name: b.name, phone: b.phone, address: b.address, gst_number: b.gst_number, notes: b.notes });
    setEditId(b.id); setShowForm(true);
  }
  function closeForm() { setShowForm(false); setEditId(null); }
  function set(k: string, v: string) { setForm((p) => ({ ...p, [k]: v })); }

  const filtered = buyers.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase()) || b.phone?.includes(search)
  );

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Buyers — Rubber / Tyre Purchasers</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{buyers.length} buyers</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow" style={{ background: '#2563eb' }}>
          <Plus size={16} /> Add Buyer
        </button>
      </div>

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search buyer name or phone…"
        className="w-full px-4 py-2.5 rounded-xl border text-sm mb-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />

      {filtered.length === 0 ? (
        <div className="text-center py-16" style={{ color: 'var(--text-tertiary)' }}>No buyers yet</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((b) => (
            <div key={b.id} className="rounded-2xl border p-4 flex items-start justify-between cursor-pointer hover:opacity-80"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }} onClick={() => openEdit(b)}>
              <div className="space-y-1">
                <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>{b.name}</div>
                {b.phone && (
                  <div className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <Phone size={13} /> {b.phone}
                  </div>
                )}
                {b.gst_number && (
                  <div className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <FileText size={13} /> GST: {b.gst_number}
                  </div>
                )}
                {b.address && (
                  <div className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                    <MapPin size={13} /> {b.address}
                  </div>
                )}
                {b.notes && <div className="text-xs italic" style={{ color: 'var(--text-tertiary)' }}>{b.notes}</div>}
              </div>
              <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete buyer?')) delMut.mutate(b.id); }}
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
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{editId ? 'Edit Buyer' : 'Add Buyer'}</h2>
              <button onClick={closeForm}><X size={20} style={{ color: 'var(--text-secondary)' }} /></button>
            </div>
            {[
              { k: 'name', label: 'Buyer Name *', ph: 'e.g. Shree Rubber Mills' },
              { k: 'phone', label: 'Phone', ph: '98XXXXXXXX' },
              { k: 'gst_number', label: 'GST Number', ph: '27AAAAA0000A1Z5' },
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
                style={{ background: '#2563eb' }}>
                {saveMut.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

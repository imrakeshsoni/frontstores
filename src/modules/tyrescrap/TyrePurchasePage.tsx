// [tyrescrap] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, X } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import {
  listPurchases, savePurchase, deletePurchase, listVendors,
  TYRE_TYPE_LABELS, TYRE_CATEGORY_LABELS, TyrePurchase,
} from '@/lib/db/tyrescrap';

function todayISO() { return new Date().toISOString().slice(0, 10); }
function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

const EMPTY_FORM = {
  vendor_id: '', vendor_name: '', date: todayISO(),
  tyre_type: 'car', category: 'resale',
  quantity_pieces: 0, weight_kg: 0, rate_per_kg: 0, total_amount: 0,
  payment_mode: 'cash', notes: '',
};

export function TyrePurchasePage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const { data: purchases = [] } = useQuery({
    queryKey: ['tyre-purchases', tenantId, filterFrom, filterTo],
    queryFn:  () => listPurchases(tenantId, { from: filterFrom || undefined, to: filterTo || undefined }),
    enabled:  !!tenantId,
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ['tyre-vendors', tenantId],
    queryFn:  () => listVendors(tenantId),
    enabled:  !!tenantId,
  });

  const saveMut = useMutation({
    mutationFn: () => savePurchase(tenantId, form as Omit<TyrePurchase, 'id' | 'tenant_id' | 'created_at'>, editId ?? undefined),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tyre-purchases'] }); qc.invalidateQueries({ queryKey: ['tyrescrap-stats'] }); closeForm(); },
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deletePurchase(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tyre-purchases'] }); qc.invalidateQueries({ queryKey: ['tyrescrap-stats'] }); },
  });

  function openNew() { setForm({ ...EMPTY_FORM }); setEditId(null); setShowForm(true); }
  function openEdit(p: TyrePurchase) {
    setForm({ vendor_id: p.vendor_id, vendor_name: p.vendor_name, date: p.date,
      tyre_type: p.tyre_type, category: p.category, quantity_pieces: p.quantity_pieces,
      weight_kg: p.weight_kg, rate_per_kg: p.rate_per_kg, total_amount: p.total_amount,
      payment_mode: p.payment_mode, notes: p.notes });
    setEditId(p.id); setShowForm(true);
  }
  function closeForm() { setShowForm(false); setEditId(null); }

  function set(k: string, v: unknown) {
    setForm((prev) => {
      const next = { ...prev, [k]: v };
      if (k === 'weight_kg' || k === 'rate_per_kg') {
        next.total_amount = parseFloat(String(next.weight_kg || 0)) * parseFloat(String(next.rate_per_kg || 0));
      }
      return next;
    });
  }

  function onVendorChange(id: string) {
    const v = vendors.find((v) => v.id === id);
    setForm((prev) => ({ ...prev, vendor_id: id, vendor_name: v?.name ?? '' }));
  }

  const totalAmt = purchases.reduce((s, p) => s + p.total_amount, 0);
  const totalKg  = purchases.reduce((s, p) => s + p.weight_kg, 0);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Purchase — Buy Scrap Tyres</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
            {purchases.length} entries · {totalKg.toFixed(0)} kg · {fmt(totalAmt)}
          </p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow" style={{ background: '#16a34a' }}>
          <Plus size={16} /> Add Purchase
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm border" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
        <span className="self-center text-sm" style={{ color: 'var(--text-secondary)' }}>to</span>
        <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm border" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
        {(filterFrom || filterTo) && (
          <button onClick={() => { setFilterFrom(''); setFilterTo(''); }} className="text-sm px-3 py-2 rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Clear</button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--surface-hover)' }}>
              {['Date', 'Vendor', 'Tyre Type', 'Category', 'Pcs', 'Weight (kg)', 'Rate/kg', 'Amount', 'Payment', ''].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {purchases.length === 0 && (
              <tr><td colSpan={10} className="text-center py-12" style={{ color: 'var(--text-tertiary)' }}>No purchases yet</td></tr>
            )}
            {purchases.map((p) => (
              <tr key={p.id} className="border-t cursor-pointer hover:opacity-80" style={{ borderColor: 'var(--border)' }} onClick={() => openEdit(p)}>
                <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>{p.date}</td>
                <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>{p.vendor_name || '—'}</td>
                <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{TYRE_TYPE_LABELS[p.tyre_type as keyof typeof TYRE_TYPE_LABELS] ?? p.tyre_type}</td>
                <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{TYRE_CATEGORY_LABELS[p.category as keyof typeof TYRE_CATEGORY_LABELS] ?? p.category}</td>
                <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{p.quantity_pieces}</td>
                <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{p.weight_kg.toFixed(1)}</td>
                <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>₹{p.rate_per_kg}</td>
                <td className="px-4 py-3 font-semibold" style={{ color: '#16a34a' }}>{fmt(p.total_amount)}</td>
                <td className="px-4 py-3 capitalize" style={{ color: 'var(--text-secondary)' }}>{p.payment_mode}</td>
                <td className="px-4 py-3" onClick={(e) => { e.stopPropagation(); if (confirm('Delete this purchase?')) delMut.mutate(p.id); }}>
                  <Trash2 size={15} style={{ color: '#dc2626' }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{editId ? 'Edit Purchase' : 'Add Purchase'}</h2>
              <button onClick={closeForm}><X size={20} style={{ color: 'var(--text-secondary)' }} /></button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Vendor</label>
                <select value={form.vendor_id} onChange={(e) => onVendorChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  <option value="">— Select vendor / type manually —</option>
                  {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              {!form.vendor_id && (
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Vendor Name (manual)</label>
                  <input value={form.vendor_name} onChange={(e) => set('vendor_name', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} placeholder="Enter vendor name" />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Date</label>
                <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Payment Mode</label>
                <select value={form.payment_mode} onChange={(e) => set('payment_mode', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="credit">Credit (Udhar)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Tyre Type</label>
                <select value={form.tyre_type} onChange={(e) => set('tyre_type', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  {Object.entries(TYRE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Category</label>
                <select value={form.category} onChange={(e) => set('category', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  {Object.entries(TYRE_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Qty (Pieces)</label>
                <input type="number" value={form.quantity_pieces} onChange={(e) => set('quantity_pieces', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} min="0" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Weight (kg)</label>
                <input type="number" value={form.weight_kg} onChange={(e) => set('weight_kg', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} step="0.1" min="0" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Rate per kg (₹)</label>
                <input type="number" value={form.rate_per_kg} onChange={(e) => set('rate_per_kg', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} step="0.5" min="0" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Total Amount (₹)</label>
                <input type="number" value={form.total_amount} onChange={(e) => set('total_amount', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg border text-sm font-semibold" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: '#16a34a' }} step="1" min="0" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Notes</label>
                <input value={form.notes} onChange={(e) => set('notes', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} placeholder="Optional notes" />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={closeForm} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Cancel</button>
              <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.vendor_name || !form.total_amount}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: '#16a34a' }}>
                {saveMut.isPending ? 'Saving…' : 'Save Purchase'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

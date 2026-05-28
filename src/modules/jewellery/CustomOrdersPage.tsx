// [jewellery] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2 } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listCustomOrders, saveCustomOrder, type CustomOrder } from '@/lib/db/jewellery';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:     { label: 'Pending',     color: '#d97706', bg: '#fef3c7' },
  in_progress: { label: 'In Progress', color: '#2563eb', bg: '#dbeafe' },
  ready:       { label: 'Ready',       color: '#16a34a', bg: '#dcfce7' },
  delivered:   { label: 'Delivered',   color: '#6b7280', bg: '#f3f4f6' },
  cancelled:   { label: 'Cancelled',   color: '#dc2626', bg: '#fee2e2' },
};

const EMPTY: Partial<CustomOrder> & { customer_name: string; description: string } = {
  customer_name: '', customer_phone: null, description: '', category: null,
  metal: 'gold', purity: '22k', approx_weight: null, design_notes: null,
  estimated_price: 0, advance_paid: 0, balance_due: 0, status: 'pending', expected_date: null,
};

export function CustomOrdersPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const { data: orders = [] } = useQuery({ queryKey: ['jewellery-custom-orders', tenantId], queryFn: () => listCustomOrders(tenantId), enabled: !!tenantId });

  const save = useMutation({
    mutationFn: (d: typeof EMPTY) => saveCustomOrder(tenantId, d as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['jewellery-custom-orders'] }); qc.invalidateQueries({ queryKey: ['jewellery-stats'] }); setForm(null); },
  });

  const up = (k: keyof typeof EMPTY, v: any) => setForm(f => f ? { ...f, [k]: v } : f);

  const filtered = statusFilter ? orders.filter(o => o.status === statusFilter) : orders;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Custom Orders</h1>
        <button onClick={() => setForm({ ...EMPTY })} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors">
          <Plus className="h-4 w-4" /> New Order
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setStatusFilter('')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!statusFilter ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>All</button>
        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
          <button key={k} onClick={() => setStatusFilter(k)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === k ? 'text-white' : 'bg-white border border-slate-200 hover:bg-slate-50'}`}
            style={statusFilter === k ? { background: v.color } : { color: v.color }}>
            {v.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-100">
            <p className="text-4xl mb-2">✨</p>
            <p className="font-medium">No custom orders</p>
          </div>
        ) : filtered.map(o => {
          const cfg = STATUS_CONFIG[o.status] ?? STATUS_CONFIG.pending;
          return (
            <div key={o.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{o.customer_name}</h3>
                    <span className="text-xs font-medium text-slate-400">#{o.order_number}</span>
                  </div>
                  {o.customer_phone && <p className="text-xs text-slate-400 mt-0.5">{o.customer_phone}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
                  <button onClick={() => setForm({ ...o })} className="p-1.5 rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600"><Edit2 className="h-4 w-4" /></button>
                </div>
              </div>
              <p className="text-sm text-slate-700 mb-2">{o.description}</p>
              <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                {o.metal && <span>🥇 {o.metal} {o.purity}</span>}
                {o.approx_weight && <span>⚖️ ~{o.approx_weight}g</span>}
                {o.expected_date && <span>📅 Due: {new Date(o.expected_date).toLocaleDateString('en-IN')}</span>}
              </div>
              <div className="flex gap-4 mt-3 pt-3 border-t border-slate-50 text-sm">
                <span className="text-slate-500">Est: <strong className="text-slate-800">{fmt(o.estimated_price)}</strong></span>
                <span className="text-slate-500">Advance: <strong className="text-green-600">{fmt(o.advance_paid)}</strong></span>
                {o.balance_due > 0 && <span className="text-slate-500">Balance: <strong className="text-red-500">{fmt(o.balance_due)}</strong></span>}
              </div>
            </div>
          );
        })}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">{form.id ? 'Edit Order' : 'New Custom Order'}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="block text-xs font-medium text-slate-600 mb-1">Customer Name *</label><input className="input w-full" value={form.customer_name} onChange={e => up('customer_name', e.target.value)} autoFocus /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Phone</label><input className="input w-full" value={form.customer_phone ?? ''} onChange={e => up('customer_phone', e.target.value || null)} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Category</label><input className="input w-full" value={form.category ?? ''} onChange={e => up('category', e.target.value || null)} placeholder="e.g. Ring" /></div>
              <div className="col-span-2"><label className="block text-xs font-medium text-slate-600 mb-1">Description *</label><textarea className="input w-full" rows={2} value={form.description} onChange={e => up('description', e.target.value)} placeholder="Describe the jewellery order…" /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Metal</label>
                <select className="input w-full" value={form.metal} onChange={e => up('metal', e.target.value)}>
                  <option value="gold">Gold</option><option value="silver">Silver</option><option value="platinum">Platinum</option>
                </select>
              </div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Purity</label><input className="input w-full" value={form.purity} onChange={e => up('purity', e.target.value)} placeholder="22k, 18k, etc." /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Approx Weight (g)</label><input type="number" step="0.001" className="input w-full" value={form.approx_weight ?? ''} onChange={e => up('approx_weight', e.target.value ? Number(e.target.value) : null)} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Expected Date</label><input type="date" className="input w-full" value={form.expected_date ?? ''} onChange={e => up('expected_date', e.target.value || null)} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Estimated Price (₹)</label><input type="number" className="input w-full" value={form.estimated_price} onChange={e => { const v = Number(e.target.value); up('estimated_price', v); up('balance_due', v - (form.advance_paid ?? 0)); }} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Advance Paid (₹)</label><input type="number" className="input w-full" value={form.advance_paid} onChange={e => { const v = Number(e.target.value); up('advance_paid', v); up('balance_due', (form.estimated_price ?? 0) - v); }} /></div>
              {form.id && <div className="col-span-2"><label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                <select className="input w-full" value={form.status} onChange={e => up('status', e.target.value)}>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>}
              <div className="col-span-2"><label className="block text-xs font-medium text-slate-600 mb-1">Design Notes</label><textarea className="input w-full" rows={2} value={form.design_notes ?? ''} onChange={e => up('design_notes', e.target.value || null)} placeholder="Design reference, special instructions…" /></div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setForm(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => save.mutate(form as any)} disabled={!form.customer_name.trim() || !form.description.trim() || save.isPending} className="flex-1 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50">
                {save.isPending ? 'Saving…' : 'Save Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

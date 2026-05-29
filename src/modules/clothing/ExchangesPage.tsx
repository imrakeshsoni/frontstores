// [clothing] [all tenants]
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, ArrowLeftRight } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { listClExchanges, createClExchange } from '@/lib/db/clothing';
import { now } from '@/lib/db/index';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function ExchangesPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    original_sale_id: '', customer_name: '', customer_phone: '',
    reason: '', returned_item: '', exchange_item: '', amount_diff: '0',
  });

  const { data: exchanges = [] } = useQuery({
    queryKey: ['cl-exchanges', tenantId],
    queryFn: () => listClExchanges(tenantId),
    enabled: !!tenantId,
  });

  function resetForm() {
    setForm({ original_sale_id: '', customer_name: '', customer_phone: '', reason: '', returned_item: '', exchange_item: '', amount_diff: '0' });
    setShowForm(false);
  }

  async function handleSave() {
    if (!form.customer_name) { toast.error('Customer name required'); return; }
    try {
      await createClExchange(tenantId, {
        ...form, amount_diff: Number(form.amount_diff) || 0, date: now(),
      });
      toast.success('Exchange logged');
      qc.invalidateQueries({ queryKey: ['cl-exchanges'] });
      qc.invalidateQueries({ queryKey: ['clothing-stats'] });
      resetForm();
    } catch { toast.error('Failed to save'); }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Exchanges &amp; Returns</h1>
          <p className="text-slate-500 text-sm">{exchanges.length} total records</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: '#db2777' }}>
          <Plus className="h-4 w-4" /> Log Exchange
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-slate-900">New Exchange / Return</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-slate-500 block mb-1">Customer Name *</label>
              <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-slate-500 block mb-1">Phone</label>
              <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.customer_phone} onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-slate-500 block mb-1">Original Bill No.</label>
              <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.original_sale_id} onChange={e => setForm(f => ({ ...f, original_sale_id: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-slate-500 block mb-1">Amount Difference (₹)</label>
              <input type="number" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.amount_diff} onChange={e => setForm(f => ({ ...f, amount_diff: e.target.value }))} /></div>
            <div className="col-span-2"><label className="text-xs font-medium text-slate-500 block mb-1">Returned Item</label>
              <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="e.g. Blue Shirt L size" value={form.returned_item} onChange={e => setForm(f => ({ ...f, returned_item: e.target.value }))} /></div>
            <div className="col-span-2"><label className="text-xs font-medium text-slate-500 block mb-1">Exchange Item</label>
              <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="e.g. Red Shirt XL size" value={form.exchange_item} onChange={e => setForm(f => ({ ...f, exchange_item: e.target.value }))} /></div>
            <div className="col-span-2"><label className="text-xs font-medium text-slate-500 block mb-1">Reason</label>
              <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="px-5 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: '#db2777' }}>Save</button>
            <button onClick={resetForm} className="px-5 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {exchanges.map(ex => (
          <div key={ex.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-50">
                  <ArrowLeftRight className="h-4 w-4 text-pink-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{ex.customer_name}</p>
                  {ex.customer_phone && <p className="text-xs text-slate-400">{ex.customer_phone}</p>}
                  {ex.original_sale_id && <p className="text-xs text-slate-400">Bill: {ex.original_sale_id}</p>}
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-600">
                    {ex.returned_item && <><span className="text-red-400">↩ {ex.returned_item}</span><span className="text-slate-300">→</span></>}
                    {ex.exchange_item && <span className="text-green-600">↪ {ex.exchange_item}</span>}
                  </div>
                  {ex.reason && <p className="text-xs text-slate-400 mt-1">Reason: {ex.reason}</p>}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">{new Date(ex.date).toLocaleDateString('en-IN')}</p>
                {ex.amount_diff !== 0 && (
                  <p className={`text-sm font-semibold ${ex.amount_diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {ex.amount_diff > 0 ? '+' : ''}{fmt(ex.amount_diff)}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
        {exchanges.length === 0 && <p className="text-center text-slate-400 py-12">No exchanges logged yet</p>}
      </div>
    </div>
  );
}

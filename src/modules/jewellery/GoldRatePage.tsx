// [jewellery] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/app/store/app.store';
import { listRates, saveRate, getLatestRate } from '@/lib/db/jewellery';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function GoldRatePage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ date: today, gold_22k: '', gold_24k: '', silver: '', platinum: '' });
  const [saved, setSaved] = useState(false);

  const { data: rates = [] } = useQuery({ queryKey: ['jewellery-rates', tenantId], queryFn: () => listRates(tenantId, 30), enabled: !!tenantId });

  useQuery({
    queryKey: ['jewellery-latest-rate', tenantId],
    queryFn: async () => {
      const r = await getLatestRate(tenantId);
      if (r) setForm({ date: today, gold_22k: String(r.gold_22k || ''), gold_24k: String(r.gold_24k || ''), silver: String(r.silver || ''), platinum: String(r.platinum || '') });
      return r;
    },
    enabled: !!tenantId,
  });

  const save = useMutation({
    mutationFn: () => saveRate(tenantId, {
      rate_date: form.date,
      gold_22k: Number(form.gold_22k) || 0,
      gold_24k: Number(form.gold_24k) || 0,
      silver: Number(form.silver) || 0,
      platinum: form.platinum ? Number(form.platinum) : null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jewellery-rates'] });
      qc.invalidateQueries({ queryKey: ['jewellery-latest-rate'] });
      qc.invalidateQueries({ queryKey: ['jewellery-stats'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const up = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Gold & Metal Rates</h1>

      {/* Update form */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Update Today's Rate</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
            <input type="date" className="input w-full" value={form.date} onChange={e => up('date', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Gold 22K (₹/gram) *</label>
            <input type="number" className="input w-full" value={form.gold_22k} onChange={e => up('gold_22k', e.target.value)} placeholder="e.g. 6800" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Gold 24K (₹/gram) *</label>
            <input type="number" className="input w-full" value={form.gold_24k} onChange={e => up('gold_24k', e.target.value)} placeholder="e.g. 7400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Silver (₹/gram)</label>
            <input type="number" className="input w-full" value={form.silver} onChange={e => up('silver', e.target.value)} placeholder="e.g. 88" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Platinum (₹/gram)</label>
            <input type="number" className="input w-full" value={form.platinum} onChange={e => up('platinum', e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => save.mutate()} disabled={!form.gold_22k || !form.gold_24k || save.isPending} className="px-6 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50">
            {save.isPending ? 'Saving…' : 'Save Rate'}
          </button>
          {saved && <span className="text-sm text-green-600 font-medium">✓ Rate saved!</span>}
        </div>
      </div>

      {/* History */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-50">
          <h2 className="font-semibold text-slate-900 text-sm">Rate History (Last 30 Days)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-500 font-medium">
                <th className="text-left px-5 py-3">Date</th>
                <th className="text-right px-4 py-3">22K</th>
                <th className="text-right px-4 py-3">24K</th>
                <th className="text-right px-4 py-3">Silver</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rates.map(r => (
                <tr key={r.id} className={`hover:bg-slate-50 ${r.rate_date === today ? 'bg-amber-50' : ''}`}>
                  <td className="px-5 py-3 font-medium text-slate-800">
                    {new Date(r.rate_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    {r.rate_date === today && <span className="ml-2 text-xs text-amber-600 font-medium">Today</span>}
                  </td>
                  <td className="text-right px-4 py-3 text-amber-700 font-semibold">{fmt(r.gold_22k)}</td>
                  <td className="text-right px-4 py-3 text-amber-600">{fmt(r.gold_24k)}</td>
                  <td className="text-right px-4 py-3 text-slate-500">{fmt(r.silver)}</td>
                </tr>
              ))}
              {rates.length === 0 && (
                <tr><td colSpan={4} className="text-center py-10 text-slate-400">No rate history yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

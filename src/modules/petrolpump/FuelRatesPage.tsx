// [petrolpump] [all tenants]
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { getCurrentFuelRates, listFuelRates, setFuelRate } from '@/lib/db/petrolpump';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`; }

export function FuelRatesPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();

  const { data: current = [] } = useQuery({
    queryKey: ['pp-fuel-rates', tenantId],
    queryFn: () => getCurrentFuelRates(tenantId),
    enabled: !!tenantId,
  });

  const { data: history = [] } = useQuery({
    queryKey: ['pp-fuel-rates-history', tenantId],
    queryFn: () => listFuelRates(tenantId),
    enabled: !!tenantId,
  });

  const [form, setForm] = useState({ fuel_type: 'petrol', rate: '' });
  const [saving, setSaving] = useState(false);

  async function handleSet() {
    if (!form.rate || parseFloat(form.rate) <= 0) { toast.error('Enter a valid rate'); return; }
    setSaving(true);
    try {
      await setFuelRate(tenantId, form.fuel_type, parseFloat(form.rate));
      toast.success(`${form.fuel_type} rate updated to ₹${form.rate}/L`);
      setForm(f => ({ ...f, rate: '' }));
      qc.invalidateQueries({ queryKey: ['pp-fuel-rates', tenantId] });
      qc.invalidateQueries({ queryKey: ['pp-fuel-rates-history', tenantId] });
    } catch (e) { toast.error(String(e)); }
    finally { setSaving(false); }
  }

  const petrol = current.find(r => r.fuel_type === 'petrol');
  const diesel = current.find(r => r.fuel_type === 'diesel');

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Fuel Rates</h1>

      {/* Current rates */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <p className="text-xs font-medium text-amber-600 mb-1">Petrol Rate</p>
          <p className="text-3xl font-bold text-amber-800">{petrol ? fmt(petrol.rate) : '—'}</p>
          {petrol && <p className="text-xs text-amber-600 mt-1">per litre · since {new Date(petrol.effective_from).toLocaleDateString('en-IN')}</p>}
        </div>
        <div className="bg-cyan-50 border border-cyan-200 rounded-2xl p-5">
          <p className="text-xs font-medium text-cyan-600 mb-1">Diesel Rate</p>
          <p className="text-3xl font-bold text-cyan-800">{diesel ? fmt(diesel.rate) : '—'}</p>
          {diesel && <p className="text-xs text-cyan-600 mt-1">per litre · since {new Date(diesel.effective_from).toLocaleDateString('en-IN')}</p>}
        </div>
      </div>

      {/* Set new rate */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Set New Rate</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fuel Type</label>
            <select value={form.fuel_type} onChange={e => setForm(f => ({ ...f, fuel_type: e.target.value }))}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
              <option value="petrol">Petrol</option>
              <option value="diesel">Diesel</option>
              <option value="cng">CNG</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Rate per Litre (₹) *</label>
            <input type="number" min="0" step="0.01" value={form.rate}
              onChange={e => setForm(f => ({ ...f, rate: e.target.value }))}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="e.g. 95.50"
            />
          </div>
        </div>
        <button onClick={handleSet} disabled={saving}
          className="mt-4 px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm transition-colors disabled:opacity-40">
          {saving ? 'Updating…' : 'Update Rate'}
        </button>
      </div>

      {/* Rate history */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Rate History</h2>
        {history.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-6">No rates set yet</p>
        ) : (
          <div className="space-y-2">
            {history.slice(0, 20).map(r => (
              <div key={r.id} className="flex justify-between items-center text-sm py-2 border-b border-slate-50">
                <span className="font-medium text-slate-800 capitalize">{r.fuel_type}</span>
                <span className="font-bold text-slate-900">{fmt(r.rate)}/L</span>
                <span className="text-xs text-slate-400">{new Date(r.effective_from).toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

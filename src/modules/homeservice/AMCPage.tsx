// [homeservice] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listAmcs, createAmc, type HsAmc } from '@/lib/db/homeservice';

export function AMCPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ customer_name: '', phone: '', address: '', service_type: '', start_date: '', end_date: '', visits_included: '4', amount: '' });

  const { data: contracts = [] } = useQuery({ queryKey: ['hs-amc', tenantId], queryFn: () => listAmcs(tenantId) });

  const saveMutation = useMutation({
    mutationFn: () => createAmc(tenantId, { ...form, visits_included: Number(form.visits_included) || 4, visits_done: 0, amount: Number(form.amount) || 0, status: 'active' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hs-amc'] }); setAdding(false); toast.success('AMC contract saved'); },
  });

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>AMC Contracts</h1>
        <button onClick={() => setAdding(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: 'var(--accent)' }}>
          <Plus className="h-4 w-4" /> New Contract
        </button>
      </div>

      {adding && (
        <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <div className="grid grid-cols-2 gap-3">
            {[['customer_name', 'Customer Name *', 'text'], ['phone', 'Phone', 'text'], ['address', 'Address', 'text'], ['service_type', 'Service Type', 'text'], ['start_date', 'Start Date', 'date'], ['end_date', 'End Date', 'date'], ['visits_included', 'Visits Included', 'number'], ['amount', 'Amount ₹', 'number']].map(([k, l, t]) => (
              <div key={k} className="space-y-1">
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{l}</label>
                <input type={t} value={(form as any)[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
                  style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => saveMutation.mutate()} disabled={!form.customer_name} className="px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-40" style={{ background: 'var(--accent)' }}>Save</button>
            <button onClick={() => setAdding(false)} className="px-4 py-2 rounded-xl text-sm border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {(contracts as HsAmc[]).map((c: HsAmc) => {
          const expiring = c.end_date <= today;
          return (
            <div key={c.id} className="rounded-xl p-4" style={{ background: 'var(--surface)', border: `1px solid ${expiring ? '#fca5a5' : 'var(--surface-border)'}` }}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{c.customer_name}</p>
                    {expiring && <AlertCircle className="h-3.5 w-3.5 text-red-500" />}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{c.service_type} · {c.address}</p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{c.start_date} → {c.end_date} · Visits: {c.visits_done}/{c.visits_included} · ₹{c.amount.toLocaleString('en-IN')}</p>
                </div>
                <div className="text-right">
                  <div className="h-2 w-20 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (c.visits_done / c.visits_included) * 100)}%`, background: 'var(--accent)' }} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {contracts.length === 0 && <p className="text-center py-8 text-sm" style={{ color: 'var(--text-tertiary)' }}>No AMC contracts yet</p>}
      </div>
    </div>
  );
}

// [realestate] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, IndianRupee, X } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listCommissions, saveCommission, deleteCommission, listDeals, type RECommission } from '@/lib/db/realestate';

const STATUS_COLORS: Record<string,string> = { pending:'bg-yellow-100 text-yellow-700', partial:'bg-blue-100 text-blue-700', received:'bg-green-100 text-green-700' };

const EMPTY: Partial<RECommission> & { amount: number; total_amount: number } = {
  deal_id:null, description:null, amount:0, gst_amount:0, total_amount:0,
  status:'pending', received_amount:0, received_date:null, tds_amount:0, payment_mode:null, notes:null,
};

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function CommissionsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [form, setForm] = useState<typeof EMPTY | null>(null);

  const { data: commissions = [] } = useQuery({ queryKey: ['re-commissions', tenantId], queryFn: () => listCommissions(tenantId), enabled: !!tenantId });
  const { data: deals = [] } = useQuery({ queryKey: ['re-deals', tenantId], queryFn: () => listDeals(tenantId), enabled: !!tenantId });

  const save = useMutation({
    mutationFn: (d: typeof EMPTY) => saveCommission(tenantId, d as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['re-commissions'] }); qc.invalidateQueries({ queryKey: ['re-stats'] }); setForm(null); },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteCommission(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['re-commissions'] }); qc.invalidateQueries({ queryKey: ['re-stats'] }); },
  });

  const up = (k: keyof typeof EMPTY, v: any) => setForm(f => {
    if (!f) return f;
    const next = { ...f, [k]: v };
    if (k === 'amount' || k === 'gst_amount') {
      next.total_amount = (next.amount ?? 0) + (next.gst_amount ?? 0);
    }
    return next;
  });

  const filtered = statusFilter ? commissions.filter(c => c.status === statusFilter) : commissions;
  const dealLabel = (id: string | null) => deals.find(d => d.id === id) ? `Deal #${deals.findIndex(d => d.id === id) + 1}` : '—';

  const totalEarned = commissions.reduce((s, c) => s + c.received_amount, 0);
  const totalPending = commissions.filter(c => c.status !== 'received').reduce((s, c) => s + (c.total_amount - c.received_amount), 0);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Commissions</h1>
        <button onClick={() => setForm({ ...EMPTY })} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors">
          <Plus className="h-4 w-4" /> Add Commission
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-slate-500 mb-1">Total Records</p>
          <p className="text-2xl font-bold text-slate-900">{commissions.length}</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-emerald-600 mb-1">Total Received</p>
          <p className="text-2xl font-bold text-emerald-700">{fmt(totalEarned)}</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-amber-600 mb-1">Pending</p>
          <p className="text-2xl font-bold text-amber-700">{fmt(totalPending)}</p>
        </div>
      </div>

      <div className="flex gap-2">
        {['','pending','partial','received'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${statusFilter === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {s || 'All'} ({s ? commissions.filter(c => c.status === s).length : commissions.length})
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(c => (
          <div key={c.id} className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 hover:shadow-md transition-all">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center">
                  <IndianRupee className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{c.description ?? dealLabel(c.deal_id)}</p>
                  <p className="text-xs text-slate-400 capitalize">{c.payment_mode ?? 'Payment mode not set'}</p>
                </div>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status]}`}>{c.status}</span>
            </div>
            <div className="grid grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-400">Amount</p>
                <p className="font-semibold text-slate-900">{fmt(c.amount)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">GST (18%)</p>
                <p className="font-semibold text-slate-700">{fmt(c.gst_amount)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Total</p>
                <p className="font-semibold text-slate-900">{fmt(c.total_amount)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Received</p>
                <p className="font-semibold text-emerald-700">{fmt(c.received_amount)}</p>
              </div>
            </div>
            {c.tds_amount > 0 && <p className="text-xs text-slate-400 mt-1">TDS deducted: {fmt(c.tds_amount)}</p>}
            {c.received_date && <p className="text-xs text-slate-400 mt-1">Received on: {c.received_date}</p>}
            <div className="flex gap-2 mt-3">
              <button onClick={() => setForm({ ...EMPTY, ...c })} className="flex-1 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200">Edit</button>
              <button onClick={() => { if (confirm('Delete?')) del.mutate(c.id); }} className="py-1.5 px-3 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50">Delete</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="text-center py-12 text-slate-400 text-sm">No commissions recorded yet.</div>}
      </div>

      {form && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900">{form.id ? 'Edit Commission' : 'Add Commission'}</h2>
              <button onClick={() => setForm(null)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-medium text-slate-500 mb-1 block">Description</label>
                <input value={form.description ?? ''} onChange={e => up('description', e.target.value || null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" placeholder="e.g. Commission for 3BHK deal in Baner" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Linked Deal</label>
                <select value={form.deal_id ?? ''} onChange={e => up('deal_id', e.target.value || null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none">
                  <option value="">None</option>
                  {deals.map((d, i) => <option key={d.id} value={d.id}>Deal #{i+1} {d.deal_value ? `— ₹${(d.deal_value/100000).toFixed(1)}L` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Status</label>
                <select value={form.status ?? 'pending'} onChange={e => up('status', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none capitalize">
                  {['pending','partial','received'].map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Commission Amount (₹) *</label>
                <input type="number" value={form.amount || ''} onChange={e => up('amount', +e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" placeholder="Base commission" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">GST Amount (₹)</label>
                <input type="number" value={form.gst_amount || ''} onChange={e => up('gst_amount', +e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" placeholder="GST @ 18%" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Total Amount (₹)</label>
                <input type="number" value={form.total_amount || ''} onChange={e => up('total_amount', +e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">TDS Deducted (₹)</label>
                <input type="number" value={form.tds_amount || ''} onChange={e => up('tds_amount', +e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Amount Received (₹)</label>
                <input type="number" value={form.received_amount || ''} onChange={e => up('received_amount', +e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Date Received</label>
                <input type="date" value={form.received_date ?? ''} onChange={e => up('received_date', e.target.value || null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Payment Mode</label>
                <select value={form.payment_mode ?? ''} onChange={e => up('payment_mode', e.target.value || null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none">
                  <option value="">Select</option>
                  {['Cash','NEFT','UPI','Cheque','RTGS'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-slate-500 mb-1 block">Notes</label>
                <textarea value={form.notes ?? ''} onChange={e => up('notes', e.target.value || null)} rows={2} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setForm(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={() => save.mutate(form)} disabled={!form.amount || save.isPending} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                {save.isPending ? 'Saving…' : (form.id ? 'Update' : 'Add')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

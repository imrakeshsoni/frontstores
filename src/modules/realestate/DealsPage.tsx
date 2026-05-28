// [realestate] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Handshake, X } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listDeals, saveDeal, deleteDeal, listLeads, listProperties, listProjects, type REDeal } from '@/lib/db/realestate';

const STATUS_COLORS: Record<string,string> = { in_progress:'bg-blue-100 text-blue-700', closed:'bg-green-100 text-green-700', lost:'bg-red-100 text-red-700', cancelled:'bg-slate-100 text-slate-600' };

const EMPTY: Partial<REDeal> = {
  lead_id:null, property_id:null, project_id:null, deal_type:'resale', status:'in_progress',
  deal_value:null, commission_pct:2, commission_amount:null, co_broker:null, co_broker_split_pct:0,
  token_amount:null, token_date:null, agreement_date:null, registration_date:null,
  possession_date:null, notes:null, closed_at:null,
};

function fmt(n: number | null) { return n ? `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'; }

export function DealsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [form, setForm] = useState<typeof EMPTY | null>(null);

  const { data: deals = [] } = useQuery({ queryKey: ['re-deals', tenantId], queryFn: () => listDeals(tenantId), enabled: !!tenantId });
  const { data: leads = [] } = useQuery({ queryKey: ['re-leads', tenantId], queryFn: () => listLeads(tenantId), enabled: !!tenantId });
  const { data: properties = [] } = useQuery({ queryKey: ['re-properties', tenantId], queryFn: () => listProperties(tenantId), enabled: !!tenantId });
  const { data: projects = [] } = useQuery({ queryKey: ['re-projects', tenantId], queryFn: () => listProjects(tenantId), enabled: !!tenantId });

  const save = useMutation({
    mutationFn: (d: typeof EMPTY) => saveDeal(tenantId, d as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['re-deals'] }); qc.invalidateQueries({ queryKey: ['re-stats'] }); setForm(null); },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteDeal(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['re-deals'] }); qc.invalidateQueries({ queryKey: ['re-stats'] }); },
  });

  const up = (k: keyof typeof EMPTY, v: any) => setForm(f => f ? { ...f, [k]: v } : f);

  const calcCommission = (value: number | null, pct: number) => value ? Math.round(value * pct / 100) : null;

  const filtered = statusFilter ? deals.filter(d => d.status === statusFilter) : deals;
  const leadName = (id: string | null) => leads.find(l => l.id === id)?.name ?? '—';
  const propTitle = (id: string | null) => properties.find(p => p.id === id)?.title ?? null;
  const projName = (id: string | null) => projects.find(p => p.id === id)?.name ?? null;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Deals</h1>
        <button onClick={() => setForm({ ...EMPTY })} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors">
          <Plus className="h-4 w-4" /> Add Deal
        </button>
      </div>

      <div className="flex gap-2">
        {['','in_progress','closed','lost','cancelled'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${statusFilter === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {s ? s.replace('_',' ') : 'All'} {s ? `(${deals.filter(d => d.status === s).length})` : `(${deals.length})`}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(d => (
          <div key={d.id} className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 hover:shadow-md transition-all">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <Handshake className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{leadName(d.lead_id)}</p>
                  <p className="text-xs text-slate-400">{propTitle(d.property_id) ?? projName(d.project_id) ?? `${d.deal_type} deal`}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[d.status]}`}>{d.status.replace('_',' ')}</span>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full capitalize">{d.deal_type}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-400">Deal Value</p>
                <p className="font-semibold text-slate-900">{fmt(d.deal_value)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Commission</p>
                <p className="font-semibold text-emerald-700">{fmt(d.commission_amount)} ({d.commission_pct}%)</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Token</p>
                <p className="font-semibold text-slate-900">{fmt(d.token_amount)}</p>
              </div>
            </div>
            {d.co_broker && (
              <p className="text-xs text-slate-400 mt-2">Co-broker: {d.co_broker} ({d.co_broker_split_pct}% split)</p>
            )}
            <div className="flex gap-2 mt-4">
              <button onClick={() => setForm({ ...EMPTY, ...d })} className="flex-1 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200">Edit</button>
              <button onClick={() => { if (confirm('Delete this deal?')) del.mutate(d.id); }} className="py-1.5 px-3 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50">Delete</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="text-center py-12 text-slate-400 text-sm">No deals found.</div>}
      </div>

      {form && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900">{form.id ? 'Edit Deal' : 'Add Deal'}</h2>
              <button onClick={() => setForm(null)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Client (Lead)</label>
                <select value={form.lead_id ?? ''} onChange={e => up('lead_id', e.target.value || null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none">
                  <option value="">Select client</option>
                  {leads.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Deal Type</label>
                <select value={form.deal_type ?? 'resale'} onChange={e => up('deal_type', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none capitalize">
                  {['resale','new','rental','commercial'].map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Property</label>
                <select value={form.property_id ?? ''} onChange={e => up('property_id', e.target.value || null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none">
                  <option value="">Select property</option>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Project</label>
                <select value={form.project_id ?? ''} onChange={e => up('project_id', e.target.value || null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none">
                  <option value="">Select project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Deal Value (₹)</label>
                <input type="number" value={form.deal_value ?? ''} onChange={e => {
                  const v = e.target.value ? +e.target.value : null;
                  setForm(f => f ? { ...f, deal_value: v, commission_amount: calcCommission(v, f.commission_pct ?? 2) } : f);
                }} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Commission %</label>
                <input type="number" step="0.25" value={form.commission_pct ?? 2} onChange={e => {
                  const pct = +e.target.value;
                  setForm(f => f ? { ...f, commission_pct: pct, commission_amount: calcCommission(f.deal_value ?? null, pct) } : f);
                }} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Commission Amount (₹)</label>
                <input type="number" value={form.commission_amount ?? ''} onChange={e => up('commission_amount', e.target.value ? +e.target.value : null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" placeholder="Auto-calculated" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Status</label>
                <select value={form.status ?? 'in_progress'} onChange={e => up('status', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none">
                  {['in_progress','closed','lost','cancelled'].map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Token Amount (₹)</label>
                <input type="number" value={form.token_amount ?? ''} onChange={e => up('token_amount', e.target.value ? +e.target.value : null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Token Date</label>
                <input type="date" value={form.token_date ?? ''} onChange={e => up('token_date', e.target.value || null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Agreement Date</label>
                <input type="date" value={form.agreement_date ?? ''} onChange={e => up('agreement_date', e.target.value || null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Registration Date</label>
                <input type="date" value={form.registration_date ?? ''} onChange={e => up('registration_date', e.target.value || null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Co-Broker Name</label>
                <input value={form.co_broker ?? ''} onChange={e => up('co_broker', e.target.value || null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" placeholder="Co-broker name" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Co-Broker Split %</label>
                <input type="number" value={form.co_broker_split_pct ?? 0} onChange={e => up('co_broker_split_pct', +e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-slate-500 mb-1 block">Notes</label>
                <textarea value={form.notes ?? ''} onChange={e => up('notes', e.target.value || null)} rows={2} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setForm(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={() => save.mutate(form)} disabled={save.isPending} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                {save.isPending ? 'Saving…' : (form.id ? 'Update' : 'Add Deal')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

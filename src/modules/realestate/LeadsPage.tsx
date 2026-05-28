// [realestate] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Phone, ChevronDown, X } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listLeads, saveLead, deleteLead, type RELead } from '@/lib/db/realestate';

const STAGES = ['new','contacted','site_visit','negotiation','closed','lost'] as const;
const STAGE_LABELS: Record<string,string> = { new:'New', contacted:'Contacted', site_visit:'Site Visit', negotiation:'Negotiation', closed:'Closed', lost:'Lost' };
const STAGE_COLORS: Record<string,string> = { new:'bg-blue-100 text-blue-700', contacted:'bg-yellow-100 text-yellow-700', site_visit:'bg-purple-100 text-purple-700', negotiation:'bg-orange-100 text-orange-700', closed:'bg-green-100 text-green-700', lost:'bg-red-100 text-red-700' };
const SOURCES = ['manual','housing','nobroker','magicbricks','99acres','referral','walkin','cold_call','social_media'];
const LEAD_TYPES = ['buyer','seller','tenant','landlord'];
const PROP_TYPES = ['residential','commercial','plot','villa'];
const BHK_OPTIONS = ['1RK','1BHK','2BHK','3BHK','4BHK','4+BHK','Villa','Plot','Office','Shop'];

const EMPTY: Partial<RELead> & { name: string } = {
  name:'', phone:null, email:null, lead_type:'buyer', property_type:'residential',
  budget_min:null, budget_max:null, bhk:null, preferred_area:null, source:'manual',
  stage:'new', lost_reason:null, assigned_to:null, co_broker:null, notes:null, follow_up_date:null,
};

function fmt(n: number | null) { return n ? `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'; }

export function LeadsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [form, setForm] = useState<typeof EMPTY | null>(null);

  const { data: leads = [] } = useQuery({ queryKey: ['re-leads', tenantId], queryFn: () => listLeads(tenantId), enabled: !!tenantId });

  const save = useMutation({
    mutationFn: (d: typeof EMPTY) => saveLead(tenantId, d as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['re-leads'] }); qc.invalidateQueries({ queryKey: ['re-stats'] }); setForm(null); },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteLead(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['re-leads'] }); qc.invalidateQueries({ queryKey: ['re-stats'] }); },
  });

  const up = (k: keyof typeof EMPTY, v: any) => setForm(f => f ? { ...f, [k]: v } : f);

  const filtered = leads.filter(l => {
    const q = search.toLowerCase();
    const ms = !q || l.name.toLowerCase().includes(q) || (l.phone ?? '').includes(q) || (l.preferred_area ?? '').toLowerCase().includes(q);
    const mf = !stageFilter || l.stage === stageFilter;
    return ms && mf;
  });

  const stageCounts = STAGES.reduce((acc, s) => { acc[s] = leads.filter(l => l.stage === s).length; return acc; }, {} as Record<string,number>);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Leads / CRM</h1>
        <button onClick={() => setForm({ ...EMPTY })} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors">
          <Plus className="h-4 w-4" /> Add Lead
        </button>
      </div>

      {/* Pipeline chips */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setStageFilter('')} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${!stageFilter ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
          All ({leads.length})
        </button>
        {STAGES.map(s => (
          <button key={s} onClick={() => setStageFilter(s === stageFilter ? '' : s)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${stageFilter === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {STAGE_LABELS[s]} ({stageCounts[s]})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, phone, area…" className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
      </div>

      {/* Lead cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(l => (
          <div key={l.id} className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 hover:shadow-md transition-all">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-semibold text-slate-900">{l.name}</p>
                {l.phone && <p className="text-xs text-slate-500 flex items-center gap-1"><Phone className="h-3 w-3" />{l.phone}</p>}
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STAGE_COLORS[l.stage]}`}>{STAGE_LABELS[l.stage]}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {l.bhk && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{l.bhk}</span>}
              {l.property_type && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full capitalize">{l.property_type}</span>}
              {l.lead_type && <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full capitalize">{l.lead_type}</span>}
            </div>
            {(l.budget_min || l.budget_max) && (
              <p className="text-sm text-slate-600 mb-1">Budget: {fmt(l.budget_min)} – {fmt(l.budget_max)}</p>
            )}
            {l.preferred_area && <p className="text-xs text-slate-400 mb-2">Area: {l.preferred_area}</p>}
            {l.source !== 'manual' && <p className="text-xs text-slate-400">Source: {l.source}</p>}
            <div className="flex gap-2 mt-3">
              <button onClick={() => setForm({ ...EMPTY, ...l })} className="flex-1 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors">Edit</button>
              <button onClick={() => { if (confirm('Delete this lead?')) del.mutate(l.id); }} className="py-1.5 px-3 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-colors">Delete</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-400 text-sm">No leads found. Add your first lead to start.</div>
        )}
      </div>

      {/* Form Modal */}
      {form && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900">{form.id ? 'Edit Lead' : 'Add Lead'}</h2>
              <button onClick={() => setForm(null)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Name *</label>
                  <input value={form.name} onChange={e => up('name', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" placeholder="Client name" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Phone</label>
                  <input value={form.phone ?? ''} onChange={e => up('phone', e.target.value || null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" placeholder="Mobile" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Email</label>
                  <input value={form.email ?? ''} onChange={e => up('email', e.target.value || null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" placeholder="Email" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Lead Type</label>
                  <select value={form.lead_type ?? 'buyer'} onChange={e => up('lead_type', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none capitalize">
                    {LEAD_TYPES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Property Type</label>
                  <select value={form.property_type ?? 'residential'} onChange={e => up('property_type', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none capitalize">
                    {PROP_TYPES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">BHK / Size</label>
                  <select value={form.bhk ?? ''} onChange={e => up('bhk', e.target.value || null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none">
                    <option value="">Any</option>
                    {BHK_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Source</label>
                  <select value={form.source ?? 'manual'} onChange={e => up('source', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none capitalize">
                    {SOURCES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Stage</label>
                  <select value={form.stage ?? 'new'} onChange={e => up('stage', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none">
                    {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Budget Min (₹)</label>
                  <input type="number" value={form.budget_min ?? ''} onChange={e => up('budget_min', e.target.value ? +e.target.value : null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" placeholder="e.g. 5000000" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Budget Max (₹)</label>
                  <input type="number" value={form.budget_max ?? ''} onChange={e => up('budget_max', e.target.value ? +e.target.value : null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" placeholder="e.g. 10000000" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Preferred Area / Locality</label>
                  <input value={form.preferred_area ?? ''} onChange={e => up('preferred_area', e.target.value || null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" placeholder="e.g. Baner, Wakad, Kharadi" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Follow-up Date</label>
                  <input type="date" value={form.follow_up_date ?? ''} onChange={e => up('follow_up_date', e.target.value || null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Assigned To</label>
                  <input value={form.assigned_to ?? ''} onChange={e => up('assigned_to', e.target.value || null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" placeholder="Agent name" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Notes</label>
                  <textarea value={form.notes ?? ''} onChange={e => up('notes', e.target.value || null)} rows={2} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none" placeholder="Any additional notes…" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setForm(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={() => form.name.trim() && save.mutate(form)} disabled={!form.name.trim() || save.isPending} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                {save.isPending ? 'Saving…' : (form.id ? 'Update' : 'Add Lead')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

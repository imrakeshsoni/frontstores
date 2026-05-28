// [realestate] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Calendar, X } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listSiteVisits, saveSiteVisit, deleteSiteVisit, listLeads, listProperties, listProjects, type RESiteVisit } from '@/lib/db/realestate';

const STATUS_COLORS: Record<string,string> = { scheduled:'bg-blue-100 text-blue-700', completed:'bg-green-100 text-green-700', no_show:'bg-red-100 text-red-700', cancelled:'bg-slate-100 text-slate-600' };
const INTEREST_COLORS: Record<string,string> = { high:'text-green-600 bg-green-50', medium:'text-yellow-600 bg-yellow-50', low:'text-red-600 bg-red-50' };

const EMPTY: Partial<RESiteVisit> & { lead_id: string; scheduled_at: string } = {
  lead_id:'', property_id:null, project_id:null, scheduled_at:'', status:'scheduled',
  feedback:null, interest_level:null, next_action:null, notes:null,
};

export function SiteVisitsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [form, setForm] = useState<typeof EMPTY | null>(null);

  const { data: visits = [] } = useQuery({ queryKey: ['re-visits', tenantId], queryFn: () => listSiteVisits(tenantId), enabled: !!tenantId });
  const { data: leads = [] } = useQuery({ queryKey: ['re-leads', tenantId], queryFn: () => listLeads(tenantId), enabled: !!tenantId });
  const { data: properties = [] } = useQuery({ queryKey: ['re-properties', tenantId], queryFn: () => listProperties(tenantId), enabled: !!tenantId });
  const { data: projects = [] } = useQuery({ queryKey: ['re-projects', tenantId], queryFn: () => listProjects(tenantId), enabled: !!tenantId });

  const save = useMutation({
    mutationFn: (d: typeof EMPTY) => saveSiteVisit(tenantId, d as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['re-visits'] }); qc.invalidateQueries({ queryKey: ['re-stats'] }); setForm(null); },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteSiteVisit(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['re-visits'] }); qc.invalidateQueries({ queryKey: ['re-stats'] }); },
  });

  const up = (k: keyof typeof EMPTY, v: any) => setForm(f => f ? { ...f, [k]: v } : f);

  const filtered = statusFilter ? visits.filter(v => v.status === statusFilter) : visits;
  const leadName = (id: string) => leads.find(l => l.id === id)?.name ?? '—';
  const propTitle = (id: string | null) => properties.find(p => p.id === id)?.title ?? null;
  const projName = (id: string | null) => projects.find(p => p.id === id)?.name ?? null;

  const today = new Date().toISOString().slice(0, 10);
  const todayVisits = visits.filter(v => v.scheduled_at.startsWith(today));
  const upcoming = visits.filter(v => v.status === 'scheduled' && !v.scheduled_at.startsWith(today));

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Site Visits</h1>
          {todayVisits.length > 0 && <p className="text-sm text-emerald-600 font-medium">{todayVisits.length} visit{todayVisits.length > 1 ? 's' : ''} scheduled today</p>}
        </div>
        <button onClick={() => setForm({ ...EMPTY, scheduled_at: new Date().toISOString().slice(0,16) })} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors">
          <Plus className="h-4 w-4" /> Schedule Visit
        </button>
      </div>

      <div className="flex gap-2">
        {['','scheduled','completed','no_show','cancelled'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${statusFilter === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {s ? s.replace('_',' ') : 'All'} ({s ? visits.filter(v => v.status === s).length : visits.length})
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(v => (
          <div key={v.id} className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 hover:shadow-md transition-all">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{leadName(v.lead_id)}</p>
                  <p className="text-xs text-slate-400">{propTitle(v.property_id) ?? projName(v.project_id) ?? 'Visit'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[v.status]}`}>{v.status.replace('_',' ')}</span>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-600">
              <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{new Date(v.scheduled_at).toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short' })}</span>
              {v.interest_level && <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${INTEREST_COLORS[v.interest_level]}`}>{v.interest_level} interest</span>}
            </div>
            {v.feedback && <p className="text-xs text-slate-500 mt-2 italic">"{v.feedback}"</p>}
            {v.next_action && <p className="text-xs text-emerald-700 mt-1">Next: {v.next_action}</p>}
            <div className="flex gap-2 mt-3">
              <button onClick={() => setForm({ ...EMPTY, ...v })} className="flex-1 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200">Edit / Update</button>
              <button onClick={() => { if (confirm('Delete?')) del.mutate(v.id); }} className="py-1.5 px-3 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50">Delete</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="text-center py-12 text-slate-400 text-sm">No site visits found.</div>}
      </div>

      {form && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900">{form.id ? 'Update Visit' : 'Schedule Site Visit'}</h2>
              <button onClick={() => setForm(null)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Client *</label>
                <select value={form.lead_id} onChange={e => up('lead_id', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none">
                  <option value="">Select client</option>
                  {leads.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Date & Time *</label>
                <input type="datetime-local" value={form.scheduled_at} onChange={e => up('scheduled_at', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
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
                <label className="text-xs font-medium text-slate-500 mb-1 block">Status</label>
                <select value={form.status ?? 'scheduled'} onChange={e => up('status', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none">
                  {['scheduled','completed','no_show','cancelled'].map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Interest Level</label>
                <select value={form.interest_level ?? ''} onChange={e => up('interest_level', e.target.value || null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none capitalize">
                  <option value="">Not set</option>
                  {['high','medium','low'].map(l => <option key={l} value={l} className="capitalize">{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Client Feedback</label>
                <textarea value={form.feedback ?? ''} onChange={e => up('feedback', e.target.value || null)} rows={2} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none" placeholder="What did the client say?" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Next Action</label>
                <input value={form.next_action ?? ''} onChange={e => up('next_action', e.target.value || null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" placeholder="e.g. Send brochure, Follow up in 2 days" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setForm(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={() => form.lead_id && form.scheduled_at && save.mutate(form)} disabled={!form.lead_id || !form.scheduled_at || save.isPending} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                {save.isPending ? 'Saving…' : (form.id ? 'Update' : 'Schedule')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

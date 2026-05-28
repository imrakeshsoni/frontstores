// [realestate] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Building2, X } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listProjects, saveProject, deleteProject, listBuilders, type REProject } from '@/lib/db/realestate';

const STATUS_COLORS: Record<string,string> = { active:'bg-green-100 text-green-700', completed:'bg-slate-100 text-slate-600', on_hold:'bg-yellow-100 text-yellow-700' };

const EMPTY: Partial<REProject> & { name: string } = {
  name:'', builder_id:null, location:null, project_type:'residential', bhk_options:null,
  price_range_min:null, price_range_max:null, commission_pct:0, total_units:null,
  available_units:null, rera_no:null, possession_date:null, amenities:null, status:'active', notes:null,
};

function fmtCr(n: number | null) { return n ? `₹${(n/10000000).toFixed(2)}Cr` : '—'; }

export function ProjectsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [form, setForm] = useState<typeof EMPTY | null>(null);

  const { data: projects = [] } = useQuery({ queryKey: ['re-projects', tenantId], queryFn: () => listProjects(tenantId), enabled: !!tenantId });
  const { data: builders = [] } = useQuery({ queryKey: ['re-builders', tenantId], queryFn: () => listBuilders(tenantId), enabled: !!tenantId });

  const save = useMutation({
    mutationFn: (d: typeof EMPTY) => saveProject(tenantId, d as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['re-projects'] }); setForm(null); },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteProject(tenantId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['re-projects'] }),
  });

  const up = (k: keyof typeof EMPTY, v: any) => setForm(f => f ? { ...f, [k]: v } : f);

  const filtered = projects.filter(p => {
    const q = search.toLowerCase();
    const ms = !q || p.name.toLowerCase().includes(q) || (p.location ?? '').toLowerCase().includes(q);
    const mst = !statusFilter || p.status === statusFilter;
    return ms && mst;
  });

  const builderName = (id: string | null) => builders.find(b => b.id === id)?.name ?? '—';

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Projects</h1>
        <button onClick={() => setForm({ ...EMPTY })} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors">
          <Plus className="h-4 w-4" /> Add Project
        </button>
      </div>

      <div className="flex gap-2">
        {['', 'active', 'completed', 'on_hold'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${statusFilter === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {s ? s.replace('_',' ') : 'All'}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by project name, location…" className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(p => (
          <div key={p.id} className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 hover:shadow-md transition-all">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{p.name}</p>
                  <p className="text-xs text-slate-400">{p.location ?? '—'}</p>
                </div>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status]}`}>{p.status.replace('_',' ')}</span>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Builder</span><span className="font-medium text-slate-800">{builderName(p.builder_id)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Price Range</span><span className="font-medium text-slate-800">{fmtCr(p.price_range_min)} – {fmtCr(p.price_range_max)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Commission</span><span className="font-medium text-emerald-700">{p.commission_pct}%</span>
              </div>
              {p.available_units !== null && (
                <div className="flex justify-between text-slate-600">
                  <span>Units Available</span><span className="font-medium text-slate-800">{p.available_units} / {p.total_units ?? '?'}</span>
                </div>
              )}
              {p.possession_date && <div className="flex justify-between text-slate-600"><span>Possession</span><span className="font-medium text-slate-800">{p.possession_date}</span></div>}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setForm({ ...EMPTY, ...p })} className="flex-1 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200">Edit</button>
              <button onClick={() => { if (confirm('Delete?')) del.mutate(p.id); }} className="py-1.5 px-3 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50">Delete</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="col-span-full text-center py-12 text-slate-400 text-sm">No projects found. Add builder projects you're tied to.</div>}
      </div>

      {form && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900">{form.id ? 'Edit Project' : 'Add Project'}</h2>
              <button onClick={() => setForm(null)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-medium text-slate-500 mb-1 block">Project Name *</label>
                <input value={form.name} onChange={e => up('name', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" placeholder="e.g. Skyline Towers" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Builder</label>
                <select value={form.builder_id ?? ''} onChange={e => up('builder_id', e.target.value || null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none">
                  <option value="">Select builder</option>
                  {builders.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Location</label>
                <input value={form.location ?? ''} onChange={e => up('location', e.target.value || null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" placeholder="Area, City" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Project Type</label>
                <select value={form.project_type ?? 'residential'} onChange={e => up('project_type', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none capitalize">
                  {['residential','commercial','villa','plot','mixed'].map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">BHK Options</label>
                <input value={form.bhk_options ?? ''} onChange={e => up('bhk_options', e.target.value || null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" placeholder="e.g. 2BHK, 3BHK, 4BHK" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Price Min (₹)</label>
                <input type="number" value={form.price_range_min ?? ''} onChange={e => up('price_range_min', e.target.value ? +e.target.value : null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Price Max (₹)</label>
                <input type="number" value={form.price_range_max ?? ''} onChange={e => up('price_range_max', e.target.value ? +e.target.value : null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">My Commission %</label>
                <input type="number" step="0.25" value={form.commission_pct ?? 0} onChange={e => up('commission_pct', +e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Total Units</label>
                <input type="number" value={form.total_units ?? ''} onChange={e => up('total_units', e.target.value ? +e.target.value : null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Available Units</label>
                <input type="number" value={form.available_units ?? ''} onChange={e => up('available_units', e.target.value ? +e.target.value : null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">RERA No.</label>
                <input value={form.rera_no ?? ''} onChange={e => up('rera_no', e.target.value || null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Possession Date</label>
                <input type="date" value={form.possession_date ?? ''} onChange={e => up('possession_date', e.target.value || null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Status</label>
                <select value={form.status ?? 'active'} onChange={e => up('status', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none">
                  {['active','completed','on_hold'].map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-slate-500 mb-1 block">Amenities</label>
                <input value={form.amenities ?? ''} onChange={e => up('amenities', e.target.value || null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" placeholder="Club house, pool, gym…" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-slate-500 mb-1 block">Notes</label>
                <textarea value={form.notes ?? ''} onChange={e => up('notes', e.target.value || null)} rows={2} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setForm(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={() => form.name.trim() && save.mutate(form)} disabled={!form.name.trim() || save.isPending} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                {save.isPending ? 'Saving…' : (form.id ? 'Update' : 'Add Project')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

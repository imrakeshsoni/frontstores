// [realestate] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Home, X } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listProperties, saveProperty, deleteProperty, type REProperty } from '@/lib/db/realestate';

const STATUS_COLORS: Record<string,string> = { available:'bg-green-100 text-green-700', under_offer:'bg-yellow-100 text-yellow-700', sold:'bg-red-100 text-red-700', rented:'bg-blue-100 text-blue-700' };
const STATUS_LABELS: Record<string,string> = { available:'Available', under_offer:'Under Offer', sold:'Sold', rented:'Rented' };
const FURNISHING = ['unfurnished','semi','fully'];
const FACING = ['East','West','North','South','NE','NW','SE','SW'];
const BHK = ['1RK','1BHK','2BHK','3BHK','4BHK','4+BHK','Villa','Plot','Office','Shop'];

const EMPTY: Partial<REProperty> & { title: string } = {
  title:'', property_type:'residential', transaction_type:'sale', bhk:null, area_sqft:null,
  floor_no:null, total_floors:null, facing:null, price:null, price_per_sqft:null,
  rent_per_month:null, deposit_amount:null, locality:null, city:null, landmark:null,
  possession_date:null, age_years:null, furnishing:'unfurnished', parking:null, amenities:null,
  status:'available', seller_name:null, seller_phone:null, seller_commission_pct:2,
  buyer_commission_pct:2, rera_no:null, notes:null,
};

function fmt(n: number | null) { return n ? `₹${(n/100000).toFixed(1)}L` : '—'; }

export function PropertiesPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [txFilter, setTxFilter] = useState('');
  const [form, setForm] = useState<typeof EMPTY | null>(null);

  const { data: properties = [] } = useQuery({ queryKey: ['re-properties', tenantId], queryFn: () => listProperties(tenantId), enabled: !!tenantId });

  const save = useMutation({
    mutationFn: (d: typeof EMPTY) => saveProperty(tenantId, d as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['re-properties'] }); setForm(null); },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteProperty(tenantId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['re-properties'] }),
  });

  const up = (k: keyof typeof EMPTY, v: any) => setForm(f => f ? { ...f, [k]: v } : f);

  const filtered = properties.filter(p => {
    const q = search.toLowerCase();
    const ms = !q || p.title.toLowerCase().includes(q) || (p.locality ?? '').toLowerCase().includes(q) || (p.city ?? '').toLowerCase().includes(q);
    const mst = !statusFilter || p.status === statusFilter;
    const mtx = !txFilter || p.transaction_type === txFilter;
    return ms && mst && mtx;
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Properties</h1>
        <button onClick={() => setForm({ ...EMPTY })} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors">
          <Plus className="h-4 w-4" /> Add Property
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['','sale','rent','lease'].map(t => (
          <button key={t} onClick={() => setTxFilter(t)} className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${txFilter === t ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {t || 'All'}
          </button>
        ))}
        <span className="border-l border-slate-200 mx-1" />
        {['','available','under_offer','sold','rented'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${statusFilter === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {s ? STATUS_LABELS[s] : 'All Status'}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by title, locality, city…" className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(p => (
          <div key={p.id} className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 hover:shadow-md transition-all">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <Home className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm leading-tight">{p.title}</p>
                  <p className="text-xs text-slate-400">{p.locality ?? p.city ?? '—'}</p>
                </div>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status]}`}>{STATUS_LABELS[p.status]}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {p.bhk && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{p.bhk}</span>}
              {p.area_sqft && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{p.area_sqft} sq.ft</span>}
              {p.furnishing !== 'unfurnished' && <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full capitalize">{p.furnishing}</span>}
              <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full capitalize">{p.transaction_type}</span>
            </div>
            <p className="text-lg font-bold text-slate-900">
              {p.transaction_type === 'rent' ? (p.rent_per_month ? `₹${p.rent_per_month.toLocaleString('en-IN')}/mo` : '—') : fmt(p.price)}
            </p>
            {p.seller_name && <p className="text-xs text-slate-400 mt-1">Owner: {p.seller_name}</p>}
            <div className="flex gap-2 mt-3">
              <button onClick={() => setForm({ ...EMPTY, ...p })} className="flex-1 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200">Edit</button>
              <button onClick={() => { if (confirm('Delete?')) del.mutate(p.id); }} className="py-1.5 px-3 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50">Delete</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="col-span-full text-center py-12 text-slate-400 text-sm">No properties found.</div>}
      </div>

      {form && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900">{form.id ? 'Edit Property' : 'Add Property'}</h2>
              <button onClick={() => setForm(null)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-medium text-slate-500 mb-1 block">Title / Description *</label>
                <input value={form.title} onChange={e => up('title', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" placeholder="e.g. 3BHK Flat in Baner" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Transaction</label>
                <select value={form.transaction_type ?? 'sale'} onChange={e => up('transaction_type', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none capitalize">
                  {['sale','rent','lease'].map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Property Type</label>
                <select value={form.property_type ?? 'residential'} onChange={e => up('property_type', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none capitalize">
                  {['residential','commercial','plot','villa','warehouse'].map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">BHK / Type</label>
                <select value={form.bhk ?? ''} onChange={e => up('bhk', e.target.value || null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none">
                  <option value="">Select</option>
                  {BHK.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Area (sq.ft)</label>
                <input type="number" value={form.area_sqft ?? ''} onChange={e => up('area_sqft', e.target.value ? +e.target.value : null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Price (₹) {form.transaction_type === 'rent' ? '— Rent/mo' : ''}</label>
                <input type="number" value={form.transaction_type === 'rent' ? (form.rent_per_month ?? '') : (form.price ?? '')} onChange={e => form.transaction_type === 'rent' ? up('rent_per_month', e.target.value ? +e.target.value : null) : up('price', e.target.value ? +e.target.value : null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>
              {form.transaction_type === 'rent' && (
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Deposit (₹)</label>
                  <input type="number" value={form.deposit_amount ?? ''} onChange={e => up('deposit_amount', e.target.value ? +e.target.value : null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Locality</label>
                <input value={form.locality ?? ''} onChange={e => up('locality', e.target.value || null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" placeholder="Area / Locality" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">City</label>
                <input value={form.city ?? ''} onChange={e => up('city', e.target.value || null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" placeholder="City" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Floor</label>
                <input value={form.floor_no ?? ''} onChange={e => up('floor_no', e.target.value || null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" placeholder="e.g. 3" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Facing</label>
                <select value={form.facing ?? ''} onChange={e => up('facing', e.target.value || null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none">
                  <option value="">Any</option>
                  {FACING.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Furnishing</label>
                <select value={form.furnishing ?? 'unfurnished'} onChange={e => up('furnishing', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none capitalize">
                  {FURNISHING.map(f => <option key={f} value={f} className="capitalize">{f === 'semi' ? 'Semi-furnished' : f === 'fully' ? 'Fully furnished' : 'Unfurnished'}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Status</label>
                <select value={form.status ?? 'available'} onChange={e => up('status', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none">
                  {['available','under_offer','sold','rented'].map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Seller Name</label>
                <input value={form.seller_name ?? ''} onChange={e => up('seller_name', e.target.value || null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" placeholder="Owner name" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Seller Phone</label>
                <input value={form.seller_phone ?? ''} onChange={e => up('seller_phone', e.target.value || null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" placeholder="Owner phone" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Seller Commission %</label>
                <input type="number" value={form.seller_commission_pct ?? 2} onChange={e => up('seller_commission_pct', +e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Buyer Commission %</label>
                <input type="number" value={form.buyer_commission_pct ?? 2} onChange={e => up('buyer_commission_pct', +e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">RERA No.</label>
                <input value={form.rera_no ?? ''} onChange={e => up('rera_no', e.target.value || null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" placeholder="RERA registration" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Age (years)</label>
                <input type="number" value={form.age_years ?? ''} onChange={e => up('age_years', e.target.value ? +e.target.value : null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-slate-500 mb-1 block">Notes</label>
                <textarea value={form.notes ?? ''} onChange={e => up('notes', e.target.value || null)} rows={2} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setForm(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={() => form.title.trim() && save.mutate(form)} disabled={!form.title.trim() || save.isPending} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                {save.isPending ? 'Saving…' : (form.id ? 'Update' : 'Add Property')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

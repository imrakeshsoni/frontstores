// [realestate] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, FileText, CheckCircle, X, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listDeals, listDocuments, saveDocument, deleteDocument, type REDocument } from '@/lib/db/realestate';

const STATUS_COLORS: Record<string,string> = { pending:'bg-yellow-100 text-yellow-700', collected:'bg-blue-100 text-blue-700', verified:'bg-green-100 text-green-700', missing:'bg-red-100 text-red-700' };
const STATUS_ICONS: Record<string,any> = { verified: CheckCircle, missing: AlertCircle };

const STANDARD_DOCS = [
  'Sale Agreement / MOU',
  'Sale Deed',
  'Title Search Report',
  'Encumbrance Certificate (EC)',
  'Property Tax Receipts',
  'Khata / Patta',
  'NOC from Society',
  'OC (Occupancy Certificate)',
  'CC (Completion Certificate)',
  'Building Plan Approval',
  'RERA Certificate',
  'Power of Attorney (if any)',
  'Identity Proof (Aadhaar / PAN)',
  'Bank NOC / Loan Closure Letter',
  'Demand Draft / Cheque',
];

const EMPTY: Partial<REDocument> & { deal_id: string; doc_name: string } = {
  deal_id:'', doc_name:'', status:'pending', notes:null,
};

export function DocumentsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [selectedDeal, setSelectedDeal] = useState('');
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [customDoc, setCustomDoc] = useState('');

  const { data: deals = [] } = useQuery({ queryKey: ['re-deals', tenantId], queryFn: () => listDeals(tenantId), enabled: !!tenantId });
  const { data: docs = [] } = useQuery({
    queryKey: ['re-docs', tenantId, selectedDeal],
    queryFn: () => listDocuments(tenantId, selectedDeal),
    enabled: !!tenantId && !!selectedDeal,
  });

  const save = useMutation({
    mutationFn: (d: typeof EMPTY) => saveDocument(tenantId, d as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['re-docs'] }); setForm(null); },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteDocument(tenantId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['re-docs'] }),
  });

  const updateStatus = (doc: REDocument, status: string) => {
    save.mutate({ ...EMPTY, ...doc, status: status as any });
  };

  const up = (k: keyof typeof EMPTY, v: any) => setForm(f => f ? { ...f, [k]: v } : f);

  const addStandardDoc = (docName: string) => {
    if (docs.find(d => d.doc_name === docName)) return;
    save.mutate({ deal_id: selectedDeal, doc_name: docName, status: 'pending', notes: null });
  };

  const verified = docs.filter(d => d.status === 'verified').length;
  const total = docs.length;

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-xl font-bold text-slate-900">Document Checklist</h1>

      {/* Deal selector */}
      <div>
        <label className="text-xs font-medium text-slate-500 mb-1.5 block">Select Deal</label>
        <select value={selectedDeal} onChange={e => setSelectedDeal(e.target.value)} className="w-full max-w-xs px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300">
          <option value="">Choose a deal…</option>
          {deals.map((d, i) => <option key={d.id} value={d.id}>Deal #{i+1} — {d.deal_value ? `₹${(d.deal_value/100000).toFixed(1)}L` : d.deal_type}</option>)}
        </select>
      </div>

      {selectedDeal && (
        <>
          {total > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-slate-700">Progress: {verified}/{total} verified</p>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${verified === total ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {verified === total ? 'All Verified ✓' : `${total - verified} pending`}
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${total > 0 ? (verified / total) * 100 : 0}%` }} />
              </div>
            </div>
          )}

          {/* Quick add standard docs */}
          <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4">
            <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wide">Quick Add Standard Docs</p>
            <div className="flex flex-wrap gap-2">
              {STANDARD_DOCS.map(d => (
                <button key={d} onClick={() => addStandardDoc(d)} disabled={!!docs.find(x => x.doc_name === d)} className="px-2.5 py-1 rounded-full text-xs font-medium bg-white border border-slate-200 hover:border-emerald-400 hover:text-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  {docs.find(x => x.doc_name === d) ? '✓ ' : '+'}{d}
                </button>
              ))}
            </div>
          </div>

          {/* Custom doc add */}
          <div className="flex gap-2">
            <input value={customDoc} onChange={e => setCustomDoc(e.target.value)} placeholder="Add custom document…" className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" onKeyDown={e => { if (e.key === 'Enter' && customDoc.trim()) { addStandardDoc(customDoc.trim()); setCustomDoc(''); }}} />
            <button onClick={() => { if (customDoc.trim()) { addStandardDoc(customDoc.trim()); setCustomDoc(''); }}} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"><Plus className="h-4 w-4" /></button>
          </div>

          {/* Document list */}
          <div className="space-y-2">
            {docs.map(doc => {
              const Icon = STATUS_ICONS[doc.status] ?? FileText;
              return (
                <div key={doc.id} className="bg-white border border-slate-100 rounded-xl shadow-sm p-3 flex items-center gap-3">
                  <Icon className={`h-5 w-5 flex-shrink-0 ${doc.status === 'verified' ? 'text-green-500' : doc.status === 'missing' ? 'text-red-500' : 'text-slate-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{doc.doc_name}</p>
                    {doc.notes && <p className="text-xs text-slate-400">{doc.notes}</p>}
                  </div>
                  <select value={doc.status} onChange={e => updateStatus(doc, e.target.value)} className="px-2 py-1 rounded-lg text-xs border border-slate-200 focus:outline-none">
                    {['pending','collected','verified','missing'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={() => { if (confirm('Remove?')) del.mutate(doc.id); }} className="p-1 text-slate-300 hover:text-red-500 transition-colors"><X className="h-4 w-4" /></button>
                </div>
              );
            })}
            {docs.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-sm">
                No documents added yet. Use the quick-add buttons above to start.
              </div>
            )}
          </div>
        </>
      )}

      {!selectedDeal && deals.length === 0 && (
        <div className="text-center py-12 text-slate-400 text-sm">
          No deals found. Create a deal first to manage its documents.
        </div>
      )}
    </div>
  );
}

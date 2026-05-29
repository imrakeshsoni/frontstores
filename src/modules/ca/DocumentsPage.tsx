// [ca] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, FileText, Trash2 } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listCADocuments, listCAClients, createCADocument, deleteCADocument } from '@/lib/db/ca';
import { toast } from 'sonner';

const DOC_TYPES = ['PAN Card', 'Aadhar', 'GST Certificate', 'Balance Sheet', 'P&L', 'Bank Statement', 'ITR Copy', 'TDS Certificate', 'Audit Report', 'Other'];

export function CADocumentsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [filterClient, setFilterClient] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ client_id: '', doc_type: '', doc_name: '', financial_year: '', notes: '', received_at: new Date().toISOString().slice(0, 10) });

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['ca-docs', tenantId, filterClient],
    queryFn: () => listCADocuments(tenantId, filterClient || undefined),
    enabled: !!tenantId,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['ca-clients', tenantId, ''],
    queryFn: () => listCAClients(tenantId),
    enabled: !!tenantId,
  });

  const add = useMutation({
    mutationFn: () => createCADocument(tenantId, { ...form, received_at: form.received_at || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ca-docs'] }); setShowAdd(false); toast.success('Document added'); },
    onError: (e) => toast.error(String(e)),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteCADocument(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ca-docs'] }); toast.success('Document removed'); },
  });

  function clientName(id: string) { return clients.find(c => c.id === id)?.name ?? '—'; }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Documents</h1>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-500">
          <Plus className="h-4 w-4" /> Add Document
        </button>
      </div>

      <div>
        <label className="text-xs font-medium text-slate-600 mr-2">Filter by client:</label>
        <select className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none" value={filterClient} onChange={e => setFilterClient(e.target.value)}>
          <option value="">All Clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {isLoading ? <p className="text-slate-400 text-sm text-center py-8">Loading…</p> : (
        <div className="space-y-2">
          {docs.map(d => (
            <div key={d.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
                  <FileText className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{d.doc_name}</p>
                  <p className="text-xs text-slate-400">{clientName(d.client_id)} · {d.doc_type} · FY: {d.financial_year || '—'}</p>
                  {d.notes && <p className="text-xs text-slate-400">{d.notes}</p>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">{d.received_at ? new Date(d.received_at).toLocaleDateString('en-IN') : '—'}</span>
                <button onClick={() => { if (confirm('Remove document?')) del.mutate(d.id); }} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
          {docs.length === 0 && <p className="text-slate-400 text-sm text-center py-8">No documents found</p>}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-3 shadow-xl">
            <h2 className="text-lg font-bold text-slate-800">Add Document</h2>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Client *</label>
              <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none" value={form.client_id} onChange={e => setForm(p => ({ ...p, client_id: e.target.value }))}>
                <option value="">— Select client —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Document Type *</label>
              <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none" value={form.doc_type} onChange={e => setForm(p => ({ ...p, doc_type: e.target.value }))}>
                <option value="">— Select type —</option>
                {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {[
              { key: 'doc_name', label: 'Document Name *', placeholder: 'e.g. PAN Card - Rahul Sharma' },
              { key: 'financial_year', label: 'Financial Year', placeholder: '2024-25' },
              { key: 'received_at', label: 'Received On', type: 'date' },
              { key: 'notes', label: 'Notes', placeholder: 'Optional' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                <input type={f.type ?? 'text'} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  placeholder={f.placeholder} value={(form as Record<string, string>)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600">Cancel</button>
              <button onClick={() => add.mutate()} disabled={!form.client_id || !form.doc_type || !form.doc_name || add.isPending}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 disabled:opacity-40">
                {add.isPending ? 'Saving…' : 'Add Document'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

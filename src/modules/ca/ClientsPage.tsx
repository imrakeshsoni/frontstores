// [ca] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, User, Trash2 } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listCAClients, createCAClient, deleteCAClient, listCATasks } from '@/lib/db/ca';
import { toast } from 'sonner';

const CLIENT_TYPES = ['individual', 'company', 'partnership', 'llp'];

export function CAClientsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', pan: '', gstin: '', tan: '', cin: '', aadhaar: '', address: '', notes: '', client_type: 'individual' });

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['ca-clients', tenantId, search],
    queryFn: () => listCAClients(tenantId, search),
    enabled: !!tenantId,
  });

  const { data: allTasks = [] } = useQuery({
    queryKey: ['ca-tasks', tenantId],
    queryFn: () => listCATasks(tenantId),
    enabled: !!tenantId,
  });

  const add = useMutation({
    mutationFn: () => createCAClient(tenantId, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ca-clients'] }); setShowAdd(false); setForm({ name: '', phone: '', email: '', pan: '', gstin: '', tan: '', cin: '', aadhaar: '', address: '', notes: '', client_type: 'individual' }); toast.success('Client added'); },
    onError: (e) => toast.error(String(e)),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteCAClient(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ca-clients'] }); toast.success('Client removed'); },
  });

  function pendingTasksForClient(clientId: string) {
    return allTasks.filter(t => t.client_id === clientId && t.status !== 'completed').length;
  }
  function outstandingFees(clientId: string) {
    return allTasks.filter(t => t.client_id === clientId && t.status !== 'completed').reduce((s, t) => s + (t.fees - t.fees_paid), 0);
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-500 transition-colors">
          <Plus className="h-4 w-4" /> Add Client
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Search by name, PAN, phone…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? <p className="text-slate-400 text-sm text-center py-8">Loading…</p> : (
        <div className="space-y-2">
          {clients.map(c => (
            <div key={c.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{c.name}</p>
                  <p className="text-xs text-slate-400">{c.pan || '—'} · {c.phone || '—'} · {c.client_type}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right text-xs">
                  <p className="text-slate-500">{pendingTasksForClient(c.id)} pending tasks</p>
                  <p className="text-red-500 font-medium">₹{outstandingFees(c.id).toLocaleString('en-IN')} due</p>
                </div>
                <button onClick={() => { if (confirm('Remove this client?')) del.mutate(c.id); }} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
          {clients.length === 0 && <p className="text-slate-400 text-sm text-center py-8">No clients found</p>}
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <h2 className="text-lg font-bold text-slate-800">Add Client</h2>
            {[
              { key: 'name', label: 'Name *', placeholder: 'Client name' },
              { key: 'phone', label: 'Phone', placeholder: '9xxxxxxxxx' },
              { key: 'email', label: 'Email', placeholder: 'email@example.com' },
              { key: 'pan', label: 'PAN', placeholder: 'ABCDE1234F' },
              { key: 'aadhaar', label: 'Aadhaar', placeholder: 'XXXX XXXX XXXX' },
              { key: 'gstin', label: 'GSTIN', placeholder: '22AAAAA0000A1Z5' },
              { key: 'tan', label: 'TAN', placeholder: 'ABCD12345E' },
              { key: 'cin', label: 'CIN (Company)', placeholder: 'U74999MH2021PTC123456' },
              { key: 'address', label: 'Address', placeholder: 'Full address' },
              { key: 'notes', label: 'Notes', placeholder: 'Optional' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={f.placeholder} value={(form as Record<string, string>)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Client Type</label>
              <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none" value={form.client_type} onChange={e => setForm(p => ({ ...p, client_type: e.target.value }))}>
                {CLIENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => add.mutate()} disabled={!form.name.trim() || add.isPending}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 disabled:opacity-40">
                {add.isPending ? 'Saving…' : 'Add Client'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

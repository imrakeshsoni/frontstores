// [insurance] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, User, Trash2 } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listInsClients, createInsClient, deleteInsClient, listInsPolicies } from '@/lib/db/insurance';
import { toast } from 'sonner';

export function InsClientsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', dob: '', address: '' });

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['ins-clients', tenantId, search],
    queryFn: () => listInsClients(tenantId, search),
    enabled: !!tenantId,
  });

  const { data: allPolicies = [] } = useQuery({
    queryKey: ['ins-policies', tenantId],
    queryFn: () => listInsPolicies(tenantId),
    enabled: !!tenantId,
  });

  const add = useMutation({
    mutationFn: () => createInsClient(tenantId, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ins-clients'] }); setShowAdd(false); setForm({ name: '', phone: '', dob: '', address: '' }); toast.success('Client added'); },
    onError: (e) => toast.error(String(e)),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteInsClient(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ins-clients'] }); toast.success('Client removed'); },
  });

  function policiesForClient(clientId: string) { return allPolicies.filter(p => p.client_id === clientId); }
  function nextRenewal(clientId: string) {
    const policies = policiesForClient(clientId).filter(p => p.next_due_date);
    if (policies.length === 0) return '—';
    const next = policies.sort((a, b) => (a.next_due_date ?? '').localeCompare(b.next_due_date ?? ''))[0];
    return next.next_due_date ? new Date(next.next_due_date).toLocaleDateString('en-IN') : '—';
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-500">
          <Plus className="h-4 w-4" /> Add Client
        </button>
      </div>

      <input className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        placeholder="Search by name or phone…" value={search} onChange={e => setSearch(e.target.value)} />

      {isLoading ? <p className="text-slate-400 text-sm text-center py-8">Loading…</p> : (
        <div className="space-y-2">
          {clients.map(c => (
            <div key={c.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50">
                  <User className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{c.name}</p>
                  <p className="text-xs text-slate-400">{c.phone || '—'} · DOB: {c.dob || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right text-xs">
                  <p className="text-slate-500">{policiesForClient(c.id).length} policies</p>
                  <p className="text-amber-600">Next due: {nextRenewal(c.id)}</p>
                </div>
                <button onClick={() => { if (confirm('Remove client?')) del.mutate(c.id); }} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
          {clients.length === 0 && <p className="text-slate-400 text-sm text-center py-8">No clients found</p>}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-3 shadow-xl">
            <h2 className="text-lg font-bold text-slate-800">Add Client</h2>
            {[
              { key: 'name', label: 'Name *', placeholder: 'Client full name' },
              { key: 'phone', label: 'Phone', placeholder: '9xxxxxxxxx' },
              { key: 'dob', label: 'Date of Birth', type: 'date' },
              { key: 'address', label: 'Address', placeholder: 'Full address' },
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
              <button onClick={() => add.mutate()} disabled={!form.name.trim() || add.isPending}
                className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-500 disabled:opacity-40">
                {add.isPending ? 'Saving…' : 'Add Client'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

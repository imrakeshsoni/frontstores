// [crm] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, CheckCircle2, Circle, Phone, Calendar, Mail, ListTodo } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listCRMFollowUps, createCRMFollowUp, updateCRMFollowUp, deleteCRMFollowUp, listCRMContacts } from '@/lib/db/crm';
import { toast } from 'sonner';

const TYPES = [
  { key: 'call', label: 'Call', icon: Phone },
  { key: 'meeting', label: 'Meeting', icon: Calendar },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'task', label: 'Task', icon: ListTodo },
];

export function CRMFollowUpsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'pending' | 'done' | ''>('pending');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ contact_id: '', title: '', type: 'call', due_at: '', notes: '' });

  const { data: followUps = [], isLoading } = useQuery({
    queryKey: ['crm-followups', tenantId, filter],
    queryFn: () => listCRMFollowUps(tenantId, filter ? { status: filter } : {}),
    enabled: !!tenantId,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['crm-contacts', tenantId, ''],
    queryFn: () => listCRMContacts(tenantId),
    enabled: !!tenantId,
  });

  const contactName = (id: string) => contacts.find(c => c.id === id)?.name ?? 'Unknown';
  const typeIcon = (type: string) => TYPES.find(t => t.key === type)?.icon ?? ListTodo;

  const add = useMutation({
    mutationFn: () => createCRMFollowUp(tenantId, { contact_id: form.contact_id, deal_id: '', title: form.title, type: form.type, due_at: form.due_at || null, status: 'pending', notes: form.notes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-followups'] }); setShowAdd(false); setForm({ contact_id: '', title: '', type: 'call', due_at: '', notes: '' }); toast.success('Follow-up scheduled'); },
    onError: (e) => toast.error(String(e)),
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateCRMFollowUp(tenantId, id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-followups'] }),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteCRMFollowUp(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-followups'] }); toast.success('Follow-up removed'); },
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Follow-ups &amp; Tasks</h1>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-500 transition-colors">
          <Plus className="h-4 w-4" /> Schedule Follow-up
        </button>
      </div>

      <div className="flex gap-2">
        {(['pending', 'done', ''] as const).map(f => (
          <button key={f || 'all'} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${filter === f ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
            {f === '' ? 'All' : f === 'pending' ? 'Pending' : 'Done'}
          </button>
        ))}
      </div>

      {isLoading ? <p className="text-slate-400 text-sm text-center py-8">Loading…</p> : (
        <div className="space-y-2">
          {followUps.map(f => {
            const Icon = typeIcon(f.type);
            const isDone = f.status === 'done';
            return (
              <div key={f.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleStatus.mutate({ id: f.id, status: isDone ? 'pending' : 'done' })} className="text-slate-300 hover:text-green-500 transition-colors">
                    {isDone ? <CheckCircle2 className="h-6 w-6 text-green-500" /> : <Circle className="h-6 w-6" />}
                  </button>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
                    <Icon className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className={`font-semibold ${isDone ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{f.title}</p>
                    <p className="text-xs text-slate-400">{contactName(f.contact_id)} · {f.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {f.due_at && <span className="text-xs font-semibold text-slate-500">{new Date(f.due_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
                  <button onClick={() => { if (confirm('Remove this follow-up?')) del.mutate(f.id); }} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            );
          })}
          {followUps.length === 0 && <p className="text-slate-400 text-sm text-center py-8">No follow-ups found</p>}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <h2 className="text-lg font-bold text-slate-800">Schedule Follow-up</h2>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Contact *</label>
              <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none" value={form.contact_id} onChange={e => setForm(p => ({ ...p, contact_id: e.target.value }))}>
                <option value="">Select contact…</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Title *</label>
              <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Follow up on quote" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
                <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                  {TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Due</label>
                <input type="datetime-local" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.due_at} onChange={e => setForm(p => ({ ...p, due_at: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
              <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Optional" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => add.mutate()} disabled={!form.contact_id || !form.title.trim() || add.isPending}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 disabled:opacity-40">
                {add.isPending ? 'Saving…' : 'Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

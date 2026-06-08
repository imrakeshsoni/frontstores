// [crm] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Phone, MessageCircle, Mail, Users as UsersIcon, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listCRMCommunications, createCRMCommunication, deleteCRMCommunication, listCRMContacts } from '@/lib/db/crm';
import { toast } from 'sonner';

const TYPES = [
  { key: 'call', label: 'Call', icon: Phone },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { key: 'sms', label: 'SMS', icon: MessageCircle },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'meeting', label: 'Meeting', icon: UsersIcon },
];

function nowLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function CRMCommunicationLogPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ contact_id: '', type: 'call', direction: 'outgoing', summary: '', occurred_at: nowLocal() });

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['crm-communications', tenantId],
    queryFn: () => listCRMCommunications(tenantId),
    enabled: !!tenantId,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['crm-contacts', tenantId, ''],
    queryFn: () => listCRMContacts(tenantId),
    enabled: !!tenantId,
  });

  const contactName = (id: string) => contacts.find(c => c.id === id)?.name ?? 'Unknown';
  const typeIcon = (type: string) => TYPES.find(t => t.key === type)?.icon ?? Phone;

  const add = useMutation({
    mutationFn: () => createCRMCommunication(tenantId, { contact_id: form.contact_id, type: form.type, direction: form.direction, summary: form.summary, occurred_at: new Date(form.occurred_at).toISOString() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-communications'] }); setShowAdd(false); setForm({ contact_id: '', type: 'call', direction: 'outgoing', summary: '', occurred_at: nowLocal() }); toast.success('Logged'); },
    onError: (e) => toast.error(String(e)),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteCRMCommunication(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-communications'] }); toast.success('Entry removed'); },
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Communication Log</h1>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-500 transition-colors">
          <Plus className="h-4 w-4" /> Log Communication
        </button>
      </div>

      {isLoading ? <p className="text-slate-400 text-sm text-center py-8">Loading…</p> : (
        <div className="space-y-2">
          {logs.map(l => {
            const Icon = typeIcon(l.type);
            const Dir = l.direction === 'incoming' ? ArrowDownLeft : ArrowUpRight;
            return (
              <div key={l.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                    <Icon className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-slate-800">{contactName(l.contact_id)}</p>
                      <Dir className={`h-3.5 w-3.5 ${l.direction === 'incoming' ? 'text-green-500' : 'text-blue-500'}`} />
                    </div>
                    <p className="text-xs text-slate-400">{l.type} · {l.direction} {l.summary ? `· ${l.summary}` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-500">{new Date(l.occurred_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  <button onClick={() => { if (confirm('Remove this entry?')) del.mutate(l.id); }} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            );
          })}
          {logs.length === 0 && <p className="text-slate-400 text-sm text-center py-8">No communication logged yet</p>}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <h2 className="text-lg font-bold text-slate-800">Log Communication</h2>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Contact *</label>
              <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none" value={form.contact_id} onChange={e => setForm(p => ({ ...p, contact_id: e.target.value }))}>
                <option value="">Select contact…</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
                <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                  {TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Direction</label>
                <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none" value={form.direction} onChange={e => setForm(p => ({ ...p, direction: e.target.value }))}>
                  <option value="outgoing">Outgoing</option>
                  <option value="incoming">Incoming</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">When</label>
              <input type="datetime-local" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.occurred_at} onChange={e => setForm(p => ({ ...p, occurred_at: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Summary</label>
              <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="What was discussed…" value={form.summary} onChange={e => setForm(p => ({ ...p, summary: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => add.mutate()} disabled={!form.contact_id || add.isPending}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 disabled:opacity-40">
                {add.isPending ? 'Saving…' : 'Log'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

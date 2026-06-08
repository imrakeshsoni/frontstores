// [crm] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, User, Trash2 } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listCRMContacts, createCRMContact, updateCRMContact, deleteCRMContact } from '@/lib/db/crm';
import { toast } from 'sonner';

const STAGES = ['lead', 'contacted', 'qualified', 'customer', 'lost'];
const STAGE_COLORS: Record<string, string> = {
  lead: '#64748b', contacted: '#2563eb', qualified: '#7c3aed', customer: '#16a34a', lost: '#dc2626',
};

export function CRMContactsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', company: '', source: '', stage: 'lead', tags: '', notes: '' });

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['crm-contacts', tenantId, search],
    queryFn: () => listCRMContacts(tenantId, search),
    enabled: !!tenantId,
  });

  const add = useMutation({
    mutationFn: () => createCRMContact(tenantId, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-contacts'] }); setShowAdd(false); setForm({ name: '', phone: '', email: '', company: '', source: '', stage: 'lead', tags: '', notes: '' }); toast.success('Contact added'); },
    onError: (e) => toast.error(String(e)),
  });

  const setStage = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => updateCRMContact(tenantId, id, { stage }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-contacts'] }),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteCRMContact(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-contacts'] }); toast.success('Contact removed'); },
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Contacts &amp; Leads</h1>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-500 transition-colors">
          <Plus className="h-4 w-4" /> Add Contact
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Search by name, phone, company…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? <p className="text-slate-400 text-sm text-center py-8">Loading…</p> : (
        <div className="space-y-2">
          {contacts.map(c => (
            <div key={c.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{c.name}</p>
                  <p className="text-xs text-slate-400">{c.company || '—'} · {c.phone || '—'} · {c.email || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <select value={c.stage} onChange={e => setStage.mutate({ id: c.id, stage: e.target.value })}
                  className="text-xs font-semibold rounded-lg px-2.5 py-1.5 border-0 outline-none cursor-pointer"
                  style={{ background: `${STAGE_COLORS[c.stage] ?? '#64748b'}1a`, color: STAGE_COLORS[c.stage] ?? '#64748b' }}>
                  {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button onClick={() => { if (confirm('Remove this contact?')) del.mutate(c.id); }} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
          {contacts.length === 0 && <p className="text-slate-400 text-sm text-center py-8">No contacts found</p>}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-800">Add Contact</h2>
            {[
              { key: 'name', label: 'Name *', placeholder: 'Contact name' },
              { key: 'phone', label: 'Phone', placeholder: '9xxxxxxxxx' },
              { key: 'email', label: 'Email', placeholder: 'email@example.com' },
              { key: 'company', label: 'Company', placeholder: 'Company name' },
              { key: 'source', label: 'Source', placeholder: 'Referral, website, ad…' },
              { key: 'tags', label: 'Tags', placeholder: 'comma, separated, tags' },
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
              <label className="block text-xs font-medium text-slate-600 mb-1">Stage</label>
              <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none" value={form.stage} onChange={e => setForm(p => ({ ...p, stage: e.target.value }))}>
                {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => add.mutate()} disabled={!form.name.trim() || add.isPending}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 disabled:opacity-40">
                {add.isPending ? 'Saving…' : 'Add Contact'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

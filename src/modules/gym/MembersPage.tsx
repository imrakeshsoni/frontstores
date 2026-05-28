// [gym] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit2, Trash2, Phone } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listMembers, listPlans, saveMember, deleteMember, type GymMember } from '@/lib/db/gym';

function daysLeft(end: string | null) {
  if (!end) return null;
  const diff = Math.ceil((new Date(end).getTime() - Date.now()) / 86400000);
  return diff;
}

const EMPTY: Partial<GymMember> & { name: string } = {
  name: '', phone: null, email: null, address: null, dob: null, gender: null,
  goal: null, blood_group: null, emergency_contact: null, emergency_phone: null,
  plan_id: null, plan_name: null, membership_start: null, membership_end: null,
  amount_paid: 0, balance_due: 0, is_active: true, notes: null,
};

export function MembersPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'expiring' | 'expired'>('all');
  const [form, setForm] = useState<typeof EMPTY | null>(null);

  const { data: members = [] } = useQuery({ queryKey: ['gym-members', tenantId], queryFn: () => listMembers(tenantId), enabled: !!tenantId });
  const { data: plans = [] } = useQuery({ queryKey: ['gym-plans', tenantId], queryFn: () => listPlans(tenantId), enabled: !!tenantId });

  const save = useMutation({
    mutationFn: (data: typeof EMPTY) => saveMember(tenantId, data as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gym-members'] }); qc.invalidateQueries({ queryKey: ['gym-stats'] }); setForm(null); },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteMember(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gym-members'] }); qc.invalidateQueries({ queryKey: ['gym-stats'] }); },
  });

  const up = (k: keyof typeof EMPTY, v: any) => setForm(f => f ? { ...f, [k]: v } : f);

  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const filtered = members.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = !q || m.name.toLowerCase().includes(q) || (m.phone ?? '').includes(q);
    const days = daysLeft(m.membership_end);
    const matchFilter =
      filter === 'all' ? true :
      filter === 'active' ? (m.is_active && (days ?? 0) > 0) :
      filter === 'expiring' ? ((days ?? 0) >= 0 && (days ?? 99) <= 7) :
      filter === 'expired' ? (days !== null && days < 0) : true;
    return matchSearch && matchFilter;
  });

  const memberStatusColor = (m: GymMember) => {
    const days = daysLeft(m.membership_end);
    if (days === null) return { color: '#64748b', bg: '#f1f5f9', label: 'No plan' };
    if (days < 0) return { color: '#dc2626', bg: '#fee2e2', label: 'Expired' };
    if (days <= 7) return { color: '#d97706', bg: '#fef3c7', label: `${days}d left` };
    return { color: '#16a34a', bg: '#dcfce7', label: 'Active' };
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Members</h1>
        <button onClick={() => setForm({ ...EMPTY })} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus className="h-4 w-4" /> Add Member
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search members…" className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
        <div className="flex rounded-xl border border-slate-200 overflow-hidden text-xs font-medium">
          {(['all', 'active', 'expiring', 'expired'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-2 capitalize transition-colors ${filter === f ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-4xl mb-2">💪</p>
            <p className="font-medium">No members found</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map(m => {
              const status = memberStatusColor(m);
              return (
                <div key={m.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm flex-shrink-0">
                      {m.name[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 text-sm">{m.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {m.phone && <span className="flex items-center gap-1 text-xs text-slate-400"><Phone className="h-3 w-3" />{m.phone}</span>}
                        {m.plan_name && <span className="text-xs text-slate-400">{m.plan_name}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: status.color, background: status.bg }}>{status.label}</span>
                    <div className="flex gap-1">
                      <button onClick={() => setForm({ ...m })} className="p-2 rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"><Edit2 className="h-4 w-4" /></button>
                      <button onClick={() => { if (confirm(`Remove ${m.name}?`)) del.mutate(m.id!); }} className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">{form.id ? 'Edit Member' : 'Add Member'}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="block text-xs font-medium text-slate-600 mb-1">Name *</label><input className="input w-full" value={form.name} onChange={e => up('name', e.target.value)} autoFocus /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Phone</label><input className="input w-full" value={form.phone ?? ''} onChange={e => up('phone', e.target.value || null)} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Gender</label>
                <select className="input w-full" value={form.gender ?? ''} onChange={e => up('gender', e.target.value || null)}>
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Date of Birth</label><input type="date" className="input w-full" value={form.dob ?? ''} onChange={e => up('dob', e.target.value || null)} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Blood Group</label>
                <select className="input w-full" value={form.blood_group ?? ''} onChange={e => up('blood_group', e.target.value || null)}>
                  <option value="">Unknown</option>
                  {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Goal</label><input className="input w-full" value={form.goal ?? ''} onChange={e => up('goal', e.target.value || null)} placeholder="e.g. Weight loss" /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Plan</label>
                <select className="input w-full" value={form.plan_id ?? ''} onChange={e => { const p = plans.find(p => p.id === e.target.value); up('plan_id', p?.id ?? null); up('plan_name', p?.name ?? null); }}>
                  <option value="">No plan</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name} ({p.duration_days}d)</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Member Since</label><input type="date" className="input w-full" value={form.membership_start ?? ''} onChange={e => up('membership_start', e.target.value || null)} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Valid Until</label><input type="date" className="input w-full" value={form.membership_end ?? ''} onChange={e => up('membership_end', e.target.value || null)} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Emergency Contact</label><input className="input w-full" value={form.emergency_contact ?? ''} onChange={e => up('emergency_contact', e.target.value || null)} placeholder="Name" /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Emergency Phone</label><input className="input w-full" value={form.emergency_phone ?? ''} onChange={e => up('emergency_phone', e.target.value || null)} /></div>
              <div className="col-span-2"><label className="block text-xs font-medium text-slate-600 mb-1">Notes</label><textarea className="input w-full" rows={2} value={form.notes ?? ''} onChange={e => up('notes', e.target.value || null)} /></div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setForm(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => save.mutate(form as any)} disabled={!form.name.trim() || save.isPending} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {save.isPending ? 'Saving…' : 'Save Member'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

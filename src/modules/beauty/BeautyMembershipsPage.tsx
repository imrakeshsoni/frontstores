// [beauty] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, CreditCard } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listMemberships, createMembership, updateMembership, deleteMembership, type BeautyMembership } from '@/lib/db/beauty';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

type Form = {
  customer_name: string; customer_phone: string; package_name: string;
  total_sessions: string; used_sessions: string; amount_paid: string;
  valid_until: string; is_active: boolean;
};

const emptyForm: Form = {
  customer_name: '', customer_phone: '', package_name: '',
  total_sessions: '10', used_sessions: '0', amount_paid: '',
  valid_until: '', is_active: true,
};

const PRESET_PACKAGES = [
  { name: 'Monthly Unlimited Hair', sessions: 12, price: 1500 },
  { name: 'Facial Package (6 sessions)', sessions: 6, price: 2500 },
  { name: 'Wax Package (10 sessions)', sessions: 10, price: 3000 },
  { name: 'Bridal Package', sessions: 5, price: 8000 },
  { name: 'Gold Membership', sessions: 20, price: 5000 },
];

export function BeautyMembershipsPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BeautyMembership | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [search, setSearch] = useState('');

  const { data: memberships = [], isLoading } = useQuery({
    queryKey: ['beauty-memberships', tenantId],
    queryFn:  () => listMemberships(tenantId),
    enabled:  !!tenantId,
  });

  const openEdit = (m: BeautyMembership) => {
    setEditing(m);
    setForm({
      customer_name: m.customer_name, customer_phone: m.customer_phone ?? '',
      package_name: m.package_name, total_sessions: String(m.total_sessions),
      used_sessions: String(m.used_sessions), amount_paid: String(m.amount_paid),
      valid_until: m.valid_until ?? '', is_active: m.is_active,
    });
    setShowForm(true);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!form.customer_name.trim()) throw new Error('Customer name required');
      if (!form.package_name.trim()) throw new Error('Package name required');
      const data = {
        customer_name: form.customer_name.trim(), customer_phone: form.customer_phone || null,
        customer_id: null, package_name: form.package_name.trim(),
        total_sessions: Number(form.total_sessions) || 10,
        used_sessions: Number(form.used_sessions) || 0,
        amount_paid: Number(form.amount_paid) || 0,
        valid_until: form.valid_until || null, is_active: form.is_active,
      };
      return editing ? updateMembership(tenantId, editing.id, data) : createMembership(tenantId, data).then(() => {});
    },
    onSuccess: () => {
      toast.success(editing ? 'Membership updated' : 'Membership created');
      setShowForm(false); setEditing(null); setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ['beauty-memberships'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Save failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMembership(tenantId, id),
    onSuccess: () => { toast.success('Membership removed'); qc.invalidateQueries({ queryKey: ['beauty-memberships'] }); },
  });

  const filtered = memberships.filter(m =>
    m.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    (m.customer_phone ?? '').includes(search) ||
    m.package_name.toLowerCase().includes(search.toLowerCase())
  );

  const active   = filtered.filter(m => m.is_active);
  const inactive = filtered.filter(m => !m.is_active);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Beauty Parlor</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Memberships</h1>
        </div>
        <button onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white"
          style={{ background: 'var(--accent)' }}>
          <Plus className="h-4 w-4" /> New Membership
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Members', value: String(memberships.filter(m => m.is_active).length), bg: '#dcfce7', color: '#16a34a' },
          { label: 'Total Revenue', value: fmt(memberships.reduce((s, m) => s + m.amount_paid, 0)), bg: '#ede9fe', color: '#7c3aed' },
          { label: 'Sessions Used', value: String(memberships.reduce((s, m) => s + m.used_sessions, 0)), bg: '#fef3c7', color: '#d97706' },
          { label: 'Sessions Left', value: String(memberships.filter(m => m.is_active).reduce((s, m) => s + (m.total_sessions - m.used_sessions), 0)), bg: '#dbeafe', color: '#2563eb' },
        ].map(c => (
          <div key={c.label} className="rounded-2xl p-4 flex items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: c.bg, color: c.color }}>
              <CreditCard size={18} />
            </div>
            <div><p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{c.label}</p><p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{c.value}</p></div>
          </div>
        ))}
      </div>

      {/* Search */}
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by customer name, phone, or package…"
        className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none"
        style={{ borderColor: 'var(--surface-border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />

      {/* List */}
      {isLoading && Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: 'var(--surface)' }} />)}

      {!isLoading && filtered.length === 0 && (
        <div className="rounded-2xl p-10 flex flex-col items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <p className="text-4xl">💳</p>
          <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>No memberships yet</p>
          <button onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true); }}
            className="mt-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white" style={{ background: 'var(--accent)' }}>
            Create First Membership
          </button>
        </div>
      )}

      {[{ label: 'Active', list: active }, { label: 'Expired / Inactive', list: inactive }].map(({ label, list }) =>
        list.length > 0 && (
          <div key={label} className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <div className="px-4 py-2.5" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--surface-border)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{label} ({list.length})</p>
            </div>
            {list.map((m, idx) => {
              const remaining = m.total_sessions - m.used_sessions;
              const pct = m.total_sessions > 0 ? (m.used_sessions / m.total_sessions) * 100 : 0;
              return (
                <div key={m.id} className="px-4 py-4" style={{ borderBottom: idx < list.length - 1 ? '1px solid var(--surface-border)' : 'none' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{m.customer_name}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: m.is_active ? '#dcfce7' : '#f3f4f6', color: m.is_active ? '#16a34a' : '#6b7280' }}>
                          {m.package_name}
                        </span>
                      </div>
                      {m.customer_phone && <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{m.customer_phone}</p>}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                          <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: pct >= 100 ? '#ef4444' : 'var(--accent)' }} />
                        </div>
                        <span className="text-xs font-medium whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                          {m.used_sessions}/{m.total_sessions} sessions · {remaining} left
                        </span>
                      </div>
                      <div className="flex gap-4 mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        <span>Paid: {fmt(m.amount_paid)}</span>
                        {m.valid_until && <span>Valid till: {m.valid_until}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => deleteMutation.mutate(m.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="rounded-2xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{editing ? 'Edit Membership' : 'New Membership'}</h2>
              <button onClick={() => { setShowForm(false); setEditing(null); }} className="text-sm px-3 py-1.5 rounded-lg border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Close</button>
            </div>

            {/* Preset packages */}
            {!editing && (
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-tertiary)' }}>Quick Presets</p>
                <div className="flex flex-wrap gap-2">
                  {PRESET_PACKAGES.map(p => (
                    <button key={p.name} onClick={() => setForm(c => ({ ...c, package_name: p.name, total_sessions: String(p.sessions), amount_paid: String(p.price) }))}
                      className="px-3 py-1 rounded-full text-xs font-medium border"
                      style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {[
              { key: 'customer_name', label: 'Customer Name *', placeholder: 'Full name' },
              { key: 'customer_phone', label: 'Phone', placeholder: 'Mobile number' },
              { key: 'package_name', label: 'Package Name *', placeholder: 'e.g. Gold Membership' },
              { key: 'amount_paid', label: 'Amount Paid (₹)', placeholder: '0' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{label}</label>
                <input value={(form as any)[key]} onChange={e => setForm(c => ({ ...c, [key]: e.target.value }))} placeholder={placeholder}
                  type={key === 'amount_paid' ? 'number' : 'text'}
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
              </div>
            ))}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Total Sessions</label>
                <input type="number" value={form.total_sessions} onChange={e => setForm(c => ({ ...c, total_sessions: e.target.value }))}
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Used Sessions</label>
                <input type="number" value={form.used_sessions} onChange={e => setForm(c => ({ ...c, used_sessions: e.target.value }))}
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Valid Until</label>
              <input type="date" value={form.valid_until} onChange={e => setForm(c => ({ ...c, valid_until: e.target.value }))}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={e => setForm(c => ({ ...c, is_active: e.target.checked }))} />
              <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Active</span>
            </label>

            <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
              className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-60"
              style={{ background: 'var(--accent)' }}>
              {saveMutation.isPending ? 'Saving…' : editing ? 'Update' : 'Create Membership'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

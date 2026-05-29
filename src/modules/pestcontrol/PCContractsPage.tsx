// [pestcontrol] [all tenants]
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PlusCircle, Pencil, Trash2, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { listPCContracts, savePCContract, deletePCContract, listPCCustomers, type PCContract } from '@/lib/db/pestcontrol';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active:    { bg: '#dcfce7', text: '#16a34a' },
  expired:   { bg: '#fee2e2', text: '#dc2626' },
  cancelled: { bg: '#f1f5f9', text: '#64748b' },
};

type FormState = Omit<PCContract, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>;

export function PCContractsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>({
    customer_id: '', contract_type: 'AMC', start_date: '', end_date: '',
    services_total: 4, services_done: 0, amount: 0, status: 'active',
  });
  const [saving, setSaving] = useState(false);

  const { data: contracts = [] } = useQuery({
    queryKey: ['pc-contracts', tenantId, statusFilter],
    queryFn: () => listPCContracts(tenantId, statusFilter),
    enabled: !!tenantId,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['pc-customers', tenantId, ''],
    queryFn: () => listPCCustomers(tenantId),
    enabled: !!tenantId,
  });

  function startEdit(c: typeof contracts[0]) {
    setEditing(c.id);
    setForm({ customer_id: c.customer_id, contract_type: c.contract_type, start_date: c.start_date, end_date: c.end_date, services_total: c.services_total, services_done: c.services_done, amount: c.amount, status: c.status });
    setShowForm(false);
  }

  function cancel() { setEditing(null); setShowForm(false); }

  async function save() {
    if (!form.customer_id) { toast.error('Select a customer'); return; }
    if (!form.start_date || !form.end_date) { toast.error('Start and end dates required'); return; }
    setSaving(true);
    try {
      await savePCContract(tenantId, form, editing ?? undefined);
      qc.invalidateQueries({ queryKey: ['pc-contracts'] });
      toast.success(editing ? 'Contract updated' : 'Contract added');
      cancel();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function del(id: string) {
    if (!confirm('Delete this contract?')) return;
    await deletePCContract(tenantId, id);
    qc.invalidateQueries({ queryKey: ['pc-contracts'] });
    toast.success('Deleted');
  }

  const inp = "w-full px-3 py-2.5 rounded-xl border text-sm outline-none";
  const inpStyle = { background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>AMC Contracts</h1>
        <button onClick={() => { setShowForm(true); setEditing(null); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'var(--accent)' }}>
          <PlusCircle className="h-4 w-4" />
          New Contract
        </button>
      </div>

      <div className="flex gap-2">
        {['all', 'active', 'expired', 'cancelled'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className="px-3 py-1.5 rounded-full text-xs font-medium capitalize"
            style={statusFilter === s ? { background: 'var(--accent)', color: 'white' } : { background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
            {s}
          </button>
        ))}
      </div>

      {(showForm || editing !== null) && (
        <div className="rounded-2xl border p-5 space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
          <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{editing ? 'Edit Contract' : 'New Contract'}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Customer *</label>
              <select value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))} className={inp} style={inpStyle}>
                <option value="">Select customer…</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Contract Type</label>
              <select value={form.contract_type} onChange={e => setForm(f => ({ ...f, contract_type: e.target.value }))} className={inp} style={inpStyle}>
                <option value="AMC">AMC (Annual Maintenance)</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Monthly">Monthly</option>
                <option value="One-time">One-time</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Amount (₹)</label>
              <input type="number" value={form.amount || ''} onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))} placeholder="0" className={inp} style={inpStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Start Date *</label>
              <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className={inp} style={inpStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>End Date *</label>
              <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className={inp} style={inpStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Total Services</label>
              <input type="number" value={form.services_total || ''} onChange={e => setForm(f => ({ ...f, services_total: Number(e.target.value) }))} placeholder="4" className={inp} style={inpStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Services Done</label>
              <input type="number" value={form.services_done || ''} onChange={e => setForm(f => ({ ...f, services_done: Number(e.target.value) }))} placeholder="0" className={inp} style={inpStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp} style={inpStyle}>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: 'var(--accent)' }}>
              <Save className="h-4 w-4" />{saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={cancel} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border"
              style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>
              <X className="h-4 w-4" />Cancel
            </button>
          </div>
        </div>
      )}

      {contracts.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: 'var(--text-tertiary)' }}>No contracts found</p>
      ) : (
        <div className="space-y-3">
          {contracts.map(c => {
            const colors = STATUS_COLORS[c.status] ?? { bg: '#f1f5f9', text: '#64748b' };
            const serviceProgress = c.services_total > 0 ? Math.round((c.services_done / c.services_total) * 100) : 0;
            return (
              <div key={c.id} className="rounded-2xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{c.customer_name}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: colors.bg, color: colors.text }}>{c.status}</span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{c.customer_phone} · {c.customer_address}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                      {c.contract_type} · {new Date(c.start_date).toLocaleDateString('en-IN')} – {new Date(c.end_date).toLocaleDateString('en-IN')}
                    </p>
                    {/* Progress */}
                    <div className="mt-2">
                      <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
                        <span>Services: {c.services_done}/{c.services_total}</span>
                        <span>{serviceProgress}%</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${serviceProgress}%`, background: colors.text }} />
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{fmt(c.amount)}</p>
                    <div className="flex gap-1 mt-2 justify-end">
                      <button onClick={() => startEdit(c)} className="p-1.5 rounded-lg" style={{ color: 'var(--text-tertiary)' }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => del(c.id)} className="p-1.5 rounded-lg" style={{ color: '#ef4444' }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

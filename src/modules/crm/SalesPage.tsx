// [crm] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, X, ShoppingCart, Phone, Mail } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { toast } from 'sonner';
import {
  listCRMSales, createCRMSale, updateCRMSale, deleteCRMSale,
  listCRMPayments, createCRMPayment, getCRMSalesStats,
  type CRMSale, type CRMSaleItem,
} from '@/lib/db/crmSales';
import { listCRMContacts, listCRMFollowUps, createCRMFollowUp, updateCRMFollowUp } from '@/lib/db/crm';
import { RC, StageBar, RecordHeader, RecordTabs, RecordBody, SidebarCard, Panel } from './components/RecordLayout';

const C = RC;

const DOC_TYPES = [
  { key: 'quote', label: 'Quotes' },
  { key: 'order', label: 'Orders' },
  { key: 'invoice', label: 'Invoices' },
];

const SALE_STAGES = [
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'paid', label: 'Paid' },
];

const STATUS_META: Record<string, { bg: string; color: string; label: string }> = {
  draft:     { bg: '#f1f5f9', color: '#64748b', label: 'Draft' },
  sent:      { bg: '#dbeafe', color: '#1d4ed8', label: 'Sent' },
  accepted:  { bg: '#e0f2fe', color: '#0369a1', label: 'Accepted' },
  paid:      { bg: '#dcfce7', color: '#15803d', label: 'Paid' },
  partial:   { bg: '#fef3c7', color: '#92400e', label: 'Partially Paid' },
  cancelled: { bg: '#fee2e2', color: '#b91c1c', label: 'Cancelled' },
};

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

const emptyItem: CRMSaleItem = { description: '', qty: 1, rate: 0 };

export function CRMSalesPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [tab, setTab] = useState<'quote' | 'order' | 'invoice'>('quote');
  const [showAdd, setShowAdd] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [form, setForm] = useState({ contact_id: '', title: '', notes: '', due_date: '', discount: '0', tax: '0' });
  const [items, setItems] = useState<CRMSaleItem[]>([{ ...emptyItem }]);

  const { data: sales = [] } = useQuery({
    queryKey: ['crm-sales', tenantId, tab],
    queryFn: () => listCRMSales(tenantId, { docType: tab }),
    enabled: !!tenantId,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['crm-contacts', tenantId, ''],
    queryFn: () => listCRMContacts(tenantId),
    enabled: !!tenantId,
  });

  const { data: stats } = useQuery({
    queryKey: ['crm-sales-stats', tenantId],
    queryFn: () => getCRMSalesStats(tenantId),
    enabled: !!tenantId,
  });

  const contactName = (id: string) => contacts.find(c => c.id === id)?.name ?? '—';

  const subtotal = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0);
  const total = Math.max(0, subtotal - (Number(form.discount) || 0) + (Number(form.tax) || 0));

  const resetForm = () => {
    setForm({ contact_id: '', title: '', notes: '', due_date: '', discount: '0', tax: '0' });
    setItems([{ ...emptyItem }]);
  };

  const add = useMutation({
    mutationFn: () => createCRMSale(tenantId, {
      contact_id: form.contact_id, doc_type: tab, title: form.title,
      items: JSON.stringify(items.filter(i => i.description.trim())),
      subtotal, discount: Number(form.discount) || 0, tax: Number(form.tax) || 0, total,
      status: 'draft', due_date: form.due_date || null, notes: form.notes,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-sales'] });
      qc.invalidateQueries({ queryKey: ['crm-sales-stats'] });
      setShowAdd(false); resetForm();
      toast.success(`${DOC_TYPES.find(d => d.key === tab)?.label.slice(0, -1)} created`);
    },
    onError: (e) => toast.error(String(e)),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteCRMSale(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-sales'] }); toast.success('Removed'); },
  });

  if (viewId) {
    const sale = sales.find(s => s.id === viewId);
    if (sale) {
      return <SaleDetail sale={sale} contact={contacts.find(c => c.id === sale.contact_id)} onBack={() => setViewId(null)} />;
    }
  }

  return (
    <div style={{ background: C.bg, minHeight: '100%', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <div style={{ padding: '28px 30px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.04em', color: C.text, margin: 0 }}>Sales</h1>
          <p style={{ fontSize: '11px', color: C.muted, marginTop: '4px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 500 }}>
            Quotes, orders &amp; invoices
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: C.nav, color: '#fff', border: 'none', borderRadius: '4px', padding: '10px 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          <Plus size={15} /> New {DOC_TYPES.find(d => d.key === tab)?.label.slice(0, -1)}
        </button>
      </div>

      <div style={{ padding: '24px 30px' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'Quotes', value: stats?.totalQuotes ?? 0, color: C.nav },
            { label: 'Orders', value: stats?.totalOrders ?? 0, color: '#7c3aed' },
            { label: 'Invoiced', value: fmt(stats?.totalRevenue ?? 0), color: '#2563eb' },
            { label: 'Received', value: fmt(stats?.totalReceived ?? 0), color: '#16a34a' },
            { label: 'Due', value: fmt(stats?.totalDue ?? 0), color: '#d97706' },
          ].map(card => (
            <div key={card.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '4px', borderTop: `3px solid ${card.color}`, padding: '16px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.muted, marginBottom: '8px' }}>{card.label}</div>
              <div style={{ fontSize: '22px', fontWeight: 900, color: card.color }}>{card.value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {DOC_TYPES.map(d => (
            <button key={d.key} onClick={() => setTab(d.key as 'quote' | 'order' | 'invoice')}
              style={{ padding: '8px 16px', borderRadius: '4px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                border: `1px solid ${tab === d.key ? C.nav : C.border}`,
                background: tab === d.key ? C.nav : C.surface, color: tab === d.key ? '#fff' : C.muted }}>
              {d.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '4px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          {sales.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: C.muted }}>
              <p style={{ fontSize: '14px', fontWeight: 600 }}>No {DOC_TYPES.find(d => d.key === tab)?.label.toLowerCase()} yet</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Doc #', 'Title', 'Contact', 'Total', 'Status', 'Due', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', fontSize: '10px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'left', borderBottom: `1px solid ${C.border}`, fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sales.map((s, i) => {
                  const sm = STATUS_META[s.status] ?? STATUS_META.draft;
                  return (
                    <tr key={s.id} onClick={() => setViewId(s.id)} style={{ borderBottom: i < sales.length - 1 ? `1px solid ${C.border}` : 'none', cursor: 'pointer' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: '13px', color: C.accent }}>{s.doc_no}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: C.text }}>{s.title || '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: C.muted }}>{contactName(s.contact_id)}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 800, fontSize: '13px', color: C.text }}>{fmt(s.total)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: sm.bg, color: sm.color, borderRadius: '2px', padding: '3px 8px', fontSize: '11px', fontWeight: 600 }}>{sm.label}</span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: C.muted }}>{s.due_date ? new Date(s.due_date).toLocaleDateString('en-IN') : '—'}</td>
                      <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => { if (confirm('Remove?')) del.mutate(s.id); }} style={{ padding: '5px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '6px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: C.text, margin: 0 }}>New {DOC_TYPES.find(d => d.key === tab)?.label.slice(0, -1)}</h2>
              <button onClick={() => { setShowAdd(false); resetForm(); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted }}><X size={18} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: C.muted, marginBottom: '4px' }}>Contact</label>
                <select value={form.contact_id} onChange={e => setForm(p => ({ ...p, contact_id: e.target.value }))} style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: '4px', padding: '8px', fontSize: '13px', fontFamily: 'inherit' }}>
                  <option value="">Select contact…</option>
                  {contacts.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: C.muted, marginBottom: '4px' }}>Title</label>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Software setup"
                  style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: '4px', padding: '8px', fontSize: '13px', fontFamily: 'inherit' }} />
              </div>
            </div>

            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: C.muted, marginBottom: '4px' }}>Items</label>
            <div style={{ border: `1px solid ${C.border}`, borderRadius: '4px', overflow: 'hidden', marginBottom: '10px' }}>
              {items.map((it, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 80px 30px', gap: '6px', padding: '8px', borderBottom: idx < items.length - 1 ? `1px solid ${C.border}` : 'none', alignItems: 'center' }}>
                  <input value={it.description} onChange={e => setItems(p => p.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))} placeholder="Description"
                    style={{ border: `1px solid ${C.border}`, borderRadius: '4px', padding: '6px', fontSize: '12px', fontFamily: 'inherit' }} />
                  <input type="number" value={it.qty} onChange={e => setItems(p => p.map((x, i) => i === idx ? { ...x, qty: Number(e.target.value) } : x))} placeholder="Qty"
                    style={{ border: `1px solid ${C.border}`, borderRadius: '4px', padding: '6px', fontSize: '12px', fontFamily: 'inherit' }} />
                  <input type="number" value={it.rate} onChange={e => setItems(p => p.map((x, i) => i === idx ? { ...x, rate: Number(e.target.value) } : x))} placeholder="Rate"
                    style={{ border: `1px solid ${C.border}`, borderRadius: '4px', padding: '6px', fontSize: '12px', fontFamily: 'inherit' }} />
                  <button onClick={() => setItems(p => p.filter((_, i) => i !== idx))} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={14} /></button>
                </div>
              ))}
              <button onClick={() => setItems(p => [...p, { ...emptyItem }])} style={{ width: '100%', padding: '8px', background: '#f8f5f0', border: 'none', borderTop: `1px solid ${C.border}`, fontSize: '12px', fontWeight: 600, color: C.accent, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add item</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: C.muted, marginBottom: '4px' }}>Discount</label>
                <input type="number" value={form.discount} onChange={e => setForm(p => ({ ...p, discount: e.target.value }))}
                  style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: '4px', padding: '8px', fontSize: '13px', fontFamily: 'inherit' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: C.muted, marginBottom: '4px' }}>Tax</label>
                <input type="number" value={form.tax} onChange={e => setForm(p => ({ ...p, tax: e.target.value }))}
                  style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: '4px', padding: '8px', fontSize: '13px', fontFamily: 'inherit' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: C.muted, marginBottom: '4px' }}>Due Date</label>
                <input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
                  style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: '4px', padding: '8px', fontSize: '13px', fontFamily: 'inherit' }} />
              </div>
            </div>

            <div style={{ textAlign: 'right', marginBottom: '14px', fontSize: '14px', fontWeight: 800, color: C.text }}>
              Total: {fmt(total)}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { setShowAdd(false); resetForm(); }} style={{ flex: 1, padding: '10px', borderRadius: '4px', border: `1px solid ${C.border}`, background: '#fff', fontSize: '13px', fontWeight: 600, color: C.muted, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={() => add.mutate()} disabled={add.isPending}
                style={{ flex: 1, padding: '10px', borderRadius: '4px', border: 'none', background: C.nav, fontSize: '13px', fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', opacity: add.isPending ? 0.5 : 1 }}>
                {add.isPending ? 'Saving…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Detail (record) view ──────────────────────────────────────────────────────

function SaleDetail({ sale, contact, onBack }: {
  sale: CRMSale;
  contact?: { id: string; name: string; phone: string; email: string; company: string };
  onBack: () => void;
}) {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('Activity');
  const [taskTitle, setTaskTitle] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');

  const items: CRMSaleItem[] = (() => { try { return JSON.parse(sale.items || '[]'); } catch { return []; } })();

  const { data: payments = [] } = useQuery({
    queryKey: ['crm-payments', tenantId, sale.id],
    queryFn: () => listCRMPayments(tenantId, sale.id),
    enabled: !!tenantId,
  });

  const { data: followUps = [] } = useQuery({
    queryKey: ['crm-followups-contact', tenantId, sale.contact_id],
    queryFn: () => listCRMFollowUps(tenantId, { contactId: sale.contact_id }),
    enabled: !!tenantId && !!sale.contact_id,
  });

  const setStatus = useMutation({
    mutationFn: (status: string) => updateCRMSale(tenantId, sale.id, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-sales'] }); qc.invalidateQueries({ queryKey: ['crm-sales-stats'] }); },
  });

  const cancel = useMutation({
    mutationFn: () => updateCRMSale(tenantId, sale.id, { status: 'cancelled' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-sales'] }); toast.success('Cancelled'); },
  });

  const addTask = useMutation({
    mutationFn: () => createCRMFollowUp(tenantId, { contact_id: sale.contact_id, deal_id: '', title: taskTitle, type: 'task', due_at: null, status: 'pending', notes: `Re: ${sale.doc_no}` }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-followups-contact'] }); setTaskTitle(''); },
  });

  const toggleTask = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateCRMFollowUp(tenantId, id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-followups-contact'] }),
  });

  const addPayment = useMutation({
    mutationFn: () => createCRMPayment(tenantId, { sale_id: sale.id, amount: Number(payAmount) || 0, method: payMethod, paid_at: new Date().toISOString(), notes: '' }),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ['crm-payments'] });
      qc.invalidateQueries({ queryKey: ['crm-sales-stats'] });
      const paidTotal = payments.reduce((s, p) => s + p.amount, 0) + (Number(payAmount) || 0);
      const newStatus = paidTotal >= (sale.total || 0) ? 'paid' : 'partial';
      await updateCRMSale(tenantId, sale.id, { status: newStatus });
      qc.invalidateQueries({ queryKey: ['crm-sales'] });
      setPayAmount('');
      toast.success('Payment recorded');
    },
  });

  const sm = STATUS_META[sale.status] ?? STATUS_META.draft;
  const received = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div style={{ background: C.bg, minHeight: '100%', fontFamily: "'Inter', -apple-system, sans-serif", padding: '24px 30px' }}>
      <RecordHeader
        icon={<ShoppingCart size={20} color="#b45309" />}
        eyebrow={`${sale.doc_type.toUpperCase()} · ${sale.doc_no}`}
        title={sale.title || sale.doc_no}
        fields={[
          { label: 'Contact', value: contact?.name ?? '—' },
          { label: 'Total', value: fmt(sale.total) },
          { label: 'Due Date', value: sale.due_date ? new Date(sale.due_date).toLocaleDateString('en-IN') : '—' },
          { label: 'Status', value: <span style={{ background: sm.bg, color: sm.color, borderRadius: '2px', padding: '3px 8px', fontSize: '11px', fontWeight: 700 }}>{sm.label}</span> },
        ]}
        actions={sale.status !== 'cancelled' && (
          <button onClick={() => { if (confirm('Cancel this record?')) cancel.mutate(); }}
            style={{ padding: '8px 14px', borderRadius: '4px', border: `1px solid ${C.border}`, background: '#fff', fontSize: '12px', fontWeight: 700, color: '#b91c1c', cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancel
          </button>
        )}
        onBack={onBack}
      />

      {sale.status === 'cancelled' ? (
        <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '4px', padding: '10px 16px', marginBottom: '16px', fontSize: '12px', fontWeight: 700, color: '#b91c1c' }}>
          This record has been cancelled.
        </div>
      ) : (
        <StageBar stages={SALE_STAGES} current={sale.status === 'partial' ? 'accepted' : sale.status} onSelect={(k) => setStatus.mutate(k)} />
      )}

      <RecordBody
        main={
          <div>
            <RecordTabs tabs={['Activity', 'Details']} active={activeTab} onChange={setActiveTab} />
            {activeTab === 'Activity' ? (
              <Panel>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <input value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="New task / note…"
                    style={{ flex: 1, border: `1px solid ${C.border}`, borderRadius: '4px', padding: '8px', fontSize: '13px', fontFamily: 'inherit' }} />
                  <button onClick={() => taskTitle.trim() && addTask.mutate()} disabled={!taskTitle.trim()}
                    style={{ padding: '8px 16px', borderRadius: '4px', border: 'none', background: C.nav, color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: taskTitle.trim() ? 1 : 0.5 }}>Add</button>
                </div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Next Steps</div>
                {followUps.length === 0 ? (
                  <p style={{ fontSize: '13px', color: C.muted }}>No activity yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {followUps.map(f => (
                      <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                        <input type="checkbox" checked={f.status === 'done'} onChange={() => toggleTask.mutate({ id: f.id, status: f.status === 'done' ? 'pending' : 'done' })} />
                        <span style={{ fontSize: '13px', textDecoration: f.status === 'done' ? 'line-through' : 'none', color: f.status === 'done' ? C.muted : C.text }}>{f.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            ) : (
              <Panel>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '14px' }}>
                  <thead>
                    <tr>
                      {['Description', 'Qty', 'Rate', 'Amount'].map(h => (
                        <th key={h} style={{ padding: '8px 0', fontSize: '10px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'left', borderBottom: `1px solid ${C.border}`, fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, i) => (
                      <tr key={i}>
                        <td style={{ padding: '8px 0', fontSize: '13px', borderBottom: `1px solid ${C.border}` }}>{it.description}</td>
                        <td style={{ padding: '8px 0', fontSize: '13px', borderBottom: `1px solid ${C.border}` }}>{it.qty}</td>
                        <td style={{ padding: '8px 0', fontSize: '13px', borderBottom: `1px solid ${C.border}` }}>{fmt(it.rate)}</td>
                        <td style={{ padding: '8px 0', fontSize: '13px', fontWeight: 700, borderBottom: `1px solid ${C.border}` }}>{fmt(it.qty * it.rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ marginLeft: 'auto', width: '220px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span style={{ color: C.muted }}>Subtotal</span><span>{fmt(sale.subtotal)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span style={{ color: C.muted }}>Discount</span><span>-{fmt(sale.discount)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span style={{ color: C.muted }}>Tax</span><span>+{fmt(sale.tax)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: `1px solid ${C.border}`, fontWeight: 800, fontSize: '14px' }}><span>Total</span><span>{fmt(sale.total)}</span></div>
                </div>
                {sale.notes && <p style={{ marginTop: '14px', fontSize: '13px', color: C.muted }}>{sale.notes}</p>}
              </Panel>
            )}
          </div>
        }
        sidebar={
          <>
            <SidebarCard title="Contact">
              {contact ? (
                <>
                  <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>{contact.name}</div>
                  {contact.company && <div style={{ fontSize: '12px', color: C.muted, marginBottom: '6px' }}>{contact.company}</div>}
                  {contact.phone && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: C.muted, marginBottom: '4px' }}><Phone size={12} /> {contact.phone}</div>}
                  {contact.email && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: C.muted }}><Mail size={12} /> {contact.email}</div>}
                </>
              ) : <p style={{ fontSize: '12px', color: C.muted }}>No contact linked</p>}
            </SidebarCard>

            {sale.doc_type === 'invoice' && (
              <SidebarCard title="Payments">
                <div style={{ marginBottom: '10px', fontSize: '12px', color: C.muted }}>
                  Received <strong style={{ color: '#16a34a' }}>{fmt(received)}</strong> of {fmt(sale.total)}
                </div>
                {payments.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '12px' }}>
                    <span>{new Date(p.paid_at).toLocaleDateString('en-IN')} · {p.method}</span>
                    <span style={{ fontWeight: 700 }}>{fmt(p.amount)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                  <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="Amount"
                    style={{ flex: 1, border: `1px solid ${C.border}`, borderRadius: '4px', padding: '6px', fontSize: '12px', fontFamily: 'inherit' }} />
                  <select value={payMethod} onChange={e => setPayMethod(e.target.value)} style={{ border: `1px solid ${C.border}`, borderRadius: '4px', padding: '6px', fontSize: '12px', fontFamily: 'inherit' }}>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank">Bank</option>
                    <option value="card">Card</option>
                  </select>
                </div>
                <button onClick={() => addPayment.mutate()} disabled={!payAmount || addPayment.isPending}
                  style={{ width: '100%', marginTop: '8px', padding: '8px', borderRadius: '4px', border: 'none', background: C.nav, fontSize: '12px', fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', opacity: (!payAmount || addPayment.isPending) ? 0.5 : 1 }}>
                  Record Payment
                </button>
              </SidebarCard>
            )}
          </>
        }
      />
    </div>
  );
}

// [crm] [all tenants] — Sales: Quote → Order → Invoice → Payment, end to end
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, FileText, ArrowRight, IndianRupee, MessageSquare, Wallet } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { toast } from 'sonner';
import {
  listCRMSales, createCRMSale, updateCRMSale, deleteCRMSale,
  listCRMPayments, createCRMPayment, getCRMSalesStats,
  type CRMSale, type CRMSaleItem,
} from '@/lib/db/crmSales';
import { listCRMContacts } from '@/lib/db/crm';
import { sendWhatsApp } from '@/lib/whatsapp';
import {
  CRMPage, PageHead, Segments, StatCard, Panel, EmptyState, Badge, Btn, Modal, Drawer,
  Field, FormGrid, inp, StageChevrons, Confetti, C, fmtINR, fmtDate, th, td,
} from './components/kit';
import { SF_TENANT_ID } from './components/lightning';
import { SalesforceSalesPage } from './SalesforceSalesPage';

const DOC_LABEL: Record<string, string> = { quote: 'Quote', order: 'Order', invoice: 'Invoice' };
const NEXT_DOC: Record<string, 'order' | 'invoice' | null> = { quote: 'order', order: 'invoice', invoice: null };

const STATUS_META: Record<string, { bg: string; color: string; label: string }> = {
  draft:     { bg: C.slateBg, color: C.slate,   label: 'Draft' },
  sent:      { bg: C.blueBg,  color: C.blue, label: 'Sent' },
  accepted:  { bg: C.blueBg, color: C.blue, label: 'Accepted' },
  partial:   { bg: C.amberBg, color: C.amber, label: 'Partially Paid' },
  paid:      { bg: C.greenBg, color: C.green, label: 'Paid' },
  cancelled: { bg: C.redBg,   color: C.red, label: 'Cancelled' },
};

const STAGES = [
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'paid', label: 'Paid' },
];

const emptyItem: CRMSaleItem = { description: '', qty: 1, rate: 0 };
const emptyForm = { contact_id: '', title: '', notes: '', due_date: '', discount: '0', tax: '0' };

function parseItems(json: string): CRMSaleItem[] {
  try { const a = JSON.parse(json); return Array.isArray(a) ? a : []; } catch { return []; }
}

// [crm] [tenant: FrontStores.com] — Salesforce-style Sales Cloud for this tenant; Aurora UI for everyone else
export function CRMSalesPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  if (tenantId === SF_TENANT_ID) return <SalesforceSalesPage />;
  return <AuroraSalesPage />;
}

function AuroraSalesPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const shopName = useAppStore(s => s.config?.shop_name ?? '');
  const qc = useQueryClient();
  const [tab, setTab] = useState<'quote' | 'order' | 'invoice'>('quote');
  const [showForm, setShowForm] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState({ amount: '', method: 'upi', notes: '' });
  const [form, setForm] = useState(emptyForm);
  const [items, setItems] = useState<CRMSaleItem[]>([{ ...emptyItem }]);
  const [celebrate, setCelebrate] = useState(false);

  const { data: sales = [] } = useQuery({ queryKey: ['crm-sales', tenantId, tab], queryFn: () => listCRMSales(tenantId, { docType: tab }), enabled: !!tenantId });
  const { data: allSales = [] } = useQuery({ queryKey: ['crm-sales', tenantId, 'all'], queryFn: () => listCRMSales(tenantId), enabled: !!tenantId });
  const { data: contacts = [] } = useQuery({ queryKey: ['crm-contacts', tenantId, ''], queryFn: () => listCRMContacts(tenantId), enabled: !!tenantId });
  const { data: stats } = useQuery({ queryKey: ['crm-sales-stats', tenantId], queryFn: () => getCRMSalesStats(tenantId), enabled: !!tenantId });

  const viewDoc = allSales.find(s => s.id === viewId) ?? null;
  const { data: payments = [] } = useQuery({
    queryKey: ['crm-payments', tenantId, viewId],
    queryFn: () => listCRMPayments(tenantId, viewId!),
    enabled: !!tenantId && !!viewId,
  });

  const contact = (id: string) => contacts.find(c => c.id === id);
  const contactName = (id: string) => contact(id)?.name ?? '—';
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['crm-sales'] }); qc.invalidateQueries({ queryKey: ['crm-sales-stats'] }); };

  const subtotal = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0);
  const total = Math.max(0, subtotal - (Number(form.discount) || 0) + (Number(form.tax) || 0));

  const paidAmount = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const balanceDue = viewDoc ? Math.max(0, (viewDoc.total || 0) - paidAmount) : 0;

  const create = useMutation({
    mutationFn: () => createCRMSale(tenantId, {
      contact_id: form.contact_id, doc_type: tab, title: form.title,
      items: JSON.stringify(items.filter(it => it.description.trim())),
      subtotal, discount: Number(form.discount) || 0, tax: Number(form.tax) || 0, total,
      due_date: form.due_date || null, notes: form.notes,
    }),
    onSuccess: () => { invalidate(); setShowForm(false); setForm(emptyForm); setItems([{ ...emptyItem }]); toast.success(`${DOC_LABEL[tab]} created 📄`); },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateCRMSale(tenantId, id, { status }),
    onSuccess: () => invalidate(),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCRMSale(tenantId, id),
    onSuccess: () => { invalidate(); setViewId(null); toast.success('Document deleted'); },
  });

  // Quote → Order → Invoice conversion: copies everything, marks source accepted
  const convert = useMutation({
    mutationFn: async (doc: CRMSale) => {
      const next = NEXT_DOC[doc.doc_type];
      if (!next) throw new Error('Cannot convert further');
      const newId = await createCRMSale(tenantId, {
        contact_id: doc.contact_id, account_id: doc.account_id, doc_type: next,
        title: doc.title, items: doc.items, subtotal: doc.subtotal,
        discount: doc.discount, tax: doc.tax, total: doc.total,
        due_date: doc.due_date, owner: doc.owner,
        notes: `Converted from ${doc.doc_no}${doc.notes ? `\n${doc.notes}` : ''}`,
      });
      await updateCRMSale(tenantId, doc.id, { status: 'accepted' });
      return { newId, next };
    },
    onSuccess: ({ next }) => {
      invalidate(); setViewId(null);
      setTab(next);
      toast.success(`Converted to ${DOC_LABEL[next]} ✅`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const recordPayment = useMutation({
    mutationFn: async () => {
      const amt = Number(payForm.amount) || 0;
      if (amt <= 0) throw new Error('Enter a valid amount');
      await createCRMPayment(tenantId, { sale_id: viewDoc!.id, amount: amt, method: payForm.method, paid_at: new Date().toISOString(), notes: payForm.notes });
      const newPaid = paidAmount + amt;
      const fullyPaid = newPaid >= (viewDoc!.total || 0);
      await updateCRMSale(tenantId, viewDoc!.id, { status: fullyPaid ? 'paid' : 'partial' });
      return fullyPaid;
    },
    onSuccess: (fullyPaid) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['crm-payments'] });
      setPayOpen(false); setPayForm({ amount: '', method: 'upi', notes: '' });
      if (fullyPaid) { setCelebrate(true); setTimeout(() => setCelebrate(false), 2400); toast.success('Invoice fully paid! 🎉'); }
      else toast.success('Payment recorded');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const shareWA = async (doc: CRMSale) => {
    const ct = contact(doc.contact_id);
    if (!ct?.phone) return toast.error('Contact has no phone number');
    const docItems = parseItems(doc.items);
    const lines = docItems.map(it => `• ${it.description} — ${it.qty} × ${fmtINR(it.rate)} = ${fmtINR(it.qty * it.rate)}`).join('\n');
    const text = `*${DOC_LABEL[doc.doc_type]} ${doc.doc_no}*${doc.title ? ` — ${doc.title}` : ''}\nFrom: ${shopName}\n\n${lines}\n\n` +
      (doc.discount ? `Discount: -${fmtINR(doc.discount)}\n` : '') +
      (doc.tax ? `Tax: +${fmtINR(doc.tax)}\n` : '') +
      `*Total: ${fmtINR(doc.total)}*` +
      (doc.due_date ? `\nDue: ${fmtDate(doc.due_date)}` : '');
    try {
      await sendWhatsApp(ct.phone, text);
      if (doc.status === 'draft') setStatus.mutate({ id: doc.id, status: 'sent' });
      toast.success('Shared on WhatsApp');
    } catch (e: any) { toast.error(e.message); }
  };

  const counts = (t: string) => allSales.filter(s => s.doc_type === t).length;

  return (
    <CRMPage>
      {celebrate && <Confetti />}
      <PageHead title="Sales" subtitle="Quotes, orders and invoices — one flow from first quote to final payment."
        actions={<Btn onClick={() => { setForm(emptyForm); setItems([{ ...emptyItem }]); setShowForm(true); }}><Plus size={14} /> New {DOC_LABEL[tab]}</Btn>} />

      {/* Stats */}
      <div className="crm-fade-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '18px' }}>
        <StatCard label="Revenue (Invoiced)" value={fmtINR(stats?.totalRevenue ?? 0)} icon={<IndianRupee size={15} />} tint={C.green} tintBg={C.greenBg} />
        <StatCard label="Received" value={fmtINR(stats?.totalReceived ?? 0)} icon={<Wallet size={15} />} tint={C.blue} tintBg={C.blueBg} />
        <StatCard label="Outstanding" value={fmtINR(stats?.totalDue ?? 0)} icon={<FileText size={15} />} tint={C.red} tintBg={C.redBg} />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <Segments value={tab} onChange={k => setTab(k as typeof tab)}
          options={[
            { key: 'quote', label: 'Quotes', count: counts('quote') },
            { key: 'order', label: 'Orders', count: counts('order') },
            { key: 'invoice', label: 'Invoices', count: counts('invoice') },
          ]} />
      </div>

      <Panel>
        {sales.length === 0 ? (
          <EmptyState emoji="🧾" title={`No ${DOC_LABEL[tab].toLowerCase()}s yet`}
            hint={tab === 'quote' ? 'Start the sales flow by creating a quote for a contact.' : `Convert a ${tab === 'order' ? 'quote' : 'order'} or create one directly.`}
            action={<Btn small onClick={() => { setForm(emptyForm); setItems([{ ...emptyItem }]); setShowForm(true); }}><Plus size={13} /> New {DOC_LABEL[tab]}</Btn>} />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>No.</th><th style={th}>Contact</th><th style={th}>Title</th><th style={th}>Total</th><th style={th}>Status</th><th style={th}>Due</th></tr></thead>
            <tbody>
              {sales.map(s => {
                const sm = STATUS_META[s.status] ?? STATUS_META.draft;
                return (
                  <tr key={s.id} className="crm-row" style={{ cursor: 'pointer' }} onClick={() => setViewId(s.id)}>
                    <td style={{ ...td, fontWeight: 800, fontFamily: 'monospace', fontSize: '12px' }}>{s.doc_no}</td>
                    <td style={td}>{contactName(s.contact_id)}</td>
                    <td style={{ ...td, color: C.muted }}>{s.title || '—'}</td>
                    <td style={{ ...td, fontWeight: 800 }}>{fmtINR(s.total)}</td>
                    <td style={td}><Badge bg={sm.bg} color={sm.color}>{sm.label}</Badge></td>
                    <td style={{ ...td, fontSize: '12px', color: C.muted }}>{fmtDate(s.due_date)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>

      {/* New doc modal */}
      {showForm && (
        <Modal title={`New ${DOC_LABEL[tab]}`} onClose={() => setShowForm(false)} width={640}
          footer={<>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', fontSize: '14px', fontWeight: 800, color: C.text }}>Total: {fmtINR(total)}</div>
            <Btn variant="ghost" onClick={() => setShowForm(false)}>Cancel</Btn>
            <Btn onClick={() => {
              if (!form.contact_id) return toast.error('Pick a contact');
              if (!items.some(it => it.description.trim())) return toast.error('Add at least one line item');
              create.mutate();
            }} disabled={create.isPending}>Create {DOC_LABEL[tab]}</Btn>
          </>}>
          <FormGrid>
            <Field label="Contact *">
              <select style={inp()} value={form.contact_id} onChange={e => setForm(p => ({ ...p, contact_id: e.target.value }))}>
                <option value="">— select —</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</option>)}
              </select>
            </Field>
            <Field label="Title"><input style={inp()} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. CRM annual subscription" /></Field>
          </FormGrid>

          {/* Line items */}
          <div style={{ margin: '16px 0' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Line Items</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 110px 100px 30px', gap: '6px', fontSize: '10px', fontWeight: 800, color: C.faint, textTransform: 'uppercase', marginBottom: '4px', padding: '0 2px' }}>
              <span>Description</span><span>Qty</span><span>Rate</span><span style={{ textAlign: 'right' }}>Amount</span><span />
            </div>
            {items.map((it, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 110px 100px 30px', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
                <input style={inp()} value={it.description} placeholder="Item or service…"
                  onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
                <input type="number" style={inp()} value={it.qty}
                  onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, qty: Number(e.target.value) } : x))} />
                <input type="number" style={inp()} value={it.rate}
                  onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, rate: Number(e.target.value) } : x))} />
                <div style={{ textAlign: 'right', fontSize: '13px', fontWeight: 700, color: C.text }}>{fmtINR((it.qty || 0) * (it.rate || 0))}</div>
                <button onClick={() => setItems(p => p.length > 1 ? p.filter((_, j) => j !== i) : p)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.faint, display: 'flex' }}><Trash2 size={13} /></button>
              </div>
            ))}
            <Btn variant="subtle" small onClick={() => setItems(p => [...p, { ...emptyItem }])}><Plus size={12} /> Add Item</Btn>
          </div>

          <FormGrid>
            <Field label="Discount (₹)"><input type="number" style={inp()} value={form.discount} onChange={e => setForm(p => ({ ...p, discount: e.target.value }))} /></Field>
            <Field label="Tax (₹)"><input type="number" style={inp()} value={form.tax} onChange={e => setForm(p => ({ ...p, tax: e.target.value }))} /></Field>
            <Field label="Due Date"><input type="date" style={inp()} value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} /></Field>
            <Field label="Notes"><input style={inp()} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></Field>
          </FormGrid>
        </Modal>
      )}

      {/* Document detail drawer */}
      {viewDoc && (
        <Drawer eyebrow={`${DOC_LABEL[viewDoc.doc_type]} · ${viewDoc.doc_no}`} title={viewDoc.title || contactName(viewDoc.contact_id)} onClose={() => setViewId(null)} width={520}
          footer={<>
            <Btn variant="danger" small onClick={() => { if (confirm('Delete this document?')) remove.mutate(viewDoc.id); }}><Trash2 size={12} /> Delete</Btn>
            <div style={{ flex: 1 }} />
            <Btn variant="subtle" small onClick={() => shareWA(viewDoc)}><MessageSquare size={12} /> Send on WhatsApp</Btn>
            {NEXT_DOC[viewDoc.doc_type] && (
              <Btn variant="success" small onClick={() => convert.mutate(viewDoc)} disabled={convert.isPending}>
                <ArrowRight size={12} /> Convert to {DOC_LABEL[NEXT_DOC[viewDoc.doc_type]!]}
              </Btn>
            )}
            {viewDoc.doc_type === 'invoice' && balanceDue > 0 && (
              <Btn small onClick={() => { setPayForm({ amount: String(balanceDue), method: 'upi', notes: '' }); setPayOpen(true); }}>
                <Wallet size={12} /> Record Payment
              </Btn>
            )}
          </>}>
          <div style={{ marginBottom: '16px' }}>
            <StageChevrons stages={STAGES} current={viewDoc.status === 'partial' ? 'accepted' : viewDoc.status}
              onSelect={k => setStatus.mutate({ id: viewDoc.id, status: k })} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            {[['Contact', contactName(viewDoc.contact_id)], ['Due Date', fmtDate(viewDoc.due_date)], ['Created', fmtDate(viewDoc.updated_at)]].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 800, marginBottom: '3px' }}>{k}</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Items */}
          <div style={{ background: C.surface2, borderRadius: '10px', padding: '12px 14px', marginBottom: '14px' }}>
            {parseItems(viewDoc.items).map((it, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0' }}>
                <span style={{ color: C.text }}>{it.description} <span style={{ color: C.muted }}>× {it.qty}</span></span>
                <span style={{ fontWeight: 700 }}>{fmtINR(it.qty * it.rate)}</span>
              </div>
            ))}
            <div style={{ borderTop: `1px solid ${C.border}`, marginTop: '8px', paddingTop: '8px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: C.muted }}><span>Subtotal</span><span>{fmtINR(viewDoc.subtotal)}</span></div>
              {viewDoc.discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: C.muted }}><span>Discount</span><span>-{fmtINR(viewDoc.discount)}</span></div>}
              {viewDoc.tax > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: C.muted }}><span>Tax</span><span>+{fmtINR(viewDoc.tax)}</span></div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '15px', marginTop: '4px' }}><span>Total</span><span>{fmtINR(viewDoc.total)}</span></div>
            </div>
          </div>

          {/* Payments (invoices) */}
          {viewDoc.doc_type === 'invoice' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: C.text, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Payments</span>
                <span style={{ fontSize: '12px', fontWeight: 800, color: balanceDue > 0 ? C.red : C.green }}>
                  {balanceDue > 0 ? `${fmtINR(balanceDue)} due` : 'Fully paid ✅'}
                </span>
              </div>
              {payments.length === 0 ? (
                <div style={{ fontSize: '12px', color: C.faint, marginBottom: '8px' }}>No payments recorded yet.</div>
              ) : payments.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.greenBg, borderRadius: '8px', padding: '8px 12px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', color: C.green, fontWeight: 700 }}>{fmtINR(p.amount)} · {p.method}</span>
                  <span style={{ fontSize: '11px', color: C.green }}>{fmtDate(p.paid_at)}</span>
                </div>
              ))}
            </>
          )}

          {viewDoc.notes && (
            <div style={{ marginTop: '12px', fontSize: '12px', color: C.muted, whiteSpace: 'pre-wrap', background: C.surface2, borderRadius: '8px', padding: '10px 12px' }}>{viewDoc.notes}</div>
          )}
        </Drawer>
      )}

      {/* Record payment modal */}
      {payOpen && viewDoc && (
        <Modal title={`Record Payment — ${viewDoc.doc_no}`} onClose={() => setPayOpen(false)} width={420}
          footer={<>
            <Btn variant="ghost" onClick={() => setPayOpen(false)}>Cancel</Btn>
            <Btn variant="success" onClick={() => recordPayment.mutate()} disabled={recordPayment.isPending}><Wallet size={13} /> Save Payment</Btn>
          </>}>
          <FormGrid>
            <Field label={`Amount (₹) — due ${fmtINR(balanceDue)}`}><input type="number" style={inp()} value={payForm.amount} onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))} autoFocus /></Field>
            <Field label="Method">
              <select style={inp()} value={payForm.method} onChange={e => setPayForm(p => ({ ...p, method: e.target.value }))}>
                <option value="upi">UPI</option><option value="cash">Cash</option><option value="bank">Bank Transfer</option><option value="card">Card</option><option value="cheque">Cheque</option>
              </select>
            </Field>
            <Field label="Notes" span2><input style={inp()} value={payForm.notes} onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))} /></Field>
          </FormGrid>
        </Modal>
      )}
    </CRMPage>
  );
}

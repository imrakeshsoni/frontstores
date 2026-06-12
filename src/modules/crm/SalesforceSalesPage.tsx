// [crm] [tenant: FrontStores.com] — Salesforce-style Sales Cloud:
// Opportunities (stages + path + kanban/list + activity timeline) → Quotes → Orders → Invoices → Payments
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, BriefcaseBusiness, FileText, ArrowRight, IndianRupee, MessageSquare, Wallet,
  LayoutGrid, List, Phone, Mail, CalendarClock, CheckSquare, Square, TrendingUp, Trophy, Target, Check,
} from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { toast } from 'sonner';
import {
  listCRMDeals, createCRMDeal, updateCRMDeal, deleteCRMDeal,
  listCRMContacts, listCRMTeamMembers, createDealCommissions, listCRMAccounts,
  listCRMFollowUps, createCRMFollowUp, updateCRMFollowUp,
  listCRMCommunications, createCRMCommunication,
  type CRMDeal,
} from '@/lib/db/crm';
import {
  listCRMSales, createCRMSale, updateCRMSale, deleteCRMSale,
  listCRMPayments, createCRMPayment,
  type CRMSale, type CRMSaleItem,
} from '@/lib/db/crmSales';
import { sendWhatsApp } from '@/lib/whatsapp';
import { Confetti, Avatar, fmtINR, fmtDate, timeAgo } from './components/kit';
import {
  SF, SF_ICONS, SFPage, SFObjectHeader, SFCard, SFBtn, SFBadge, SFTabs, SFPath, SFStat,
  SFHighlights, SFHL, SFModal, SFField, SFFormGrid, SFEmpty, SFSplit, SFListRow, sfInp, sfTh, sfTd, type SFTone,
} from './components/lightning';

// ── Salesforce standard opportunity stages ────────────────────────────────────
const STAGES = [
  { key: 'prospecting',    label: 'Prospecting',    prob: 10 },
  { key: 'qualification',  label: 'Qualification',  prob: 25 },
  { key: 'demo',           label: 'Demo',           prob: 45 }, // demo done, all customer questions answered
  { key: 'proposal',       label: 'Proposal/Quote', prob: 65 },
  { key: 'negotiation',    label: 'Negotiation',    prob: 85 },
];
const STAGE_KEYS = STAGES.map(s => s.key);

// Older deals for this tenant may carry the Aurora pipeline keys — map to nearest stage
const LEGACY_STAGE: Record<string, string> = {
  new: 'prospecting', contacted: 'qualification', qualified: 'qualification',
  needs_analysis: 'demo', negotiation: 'negotiation', proposal: 'proposal',
};
const normStage = (s: string) => (s === 'won' || s === 'lost') ? s : (STAGE_KEYS.includes(s) ? s : (LEGACY_STAGE[s] ?? 'prospecting'));
const stageLabel = (s: string) => s === 'won' ? 'Closed Won' : s === 'lost' ? 'Closed Lost' : (STAGES.find(x => x.key === normStage(s))?.label ?? s);
const stageProb = (s: string) => s === 'won' ? 100 : s === 'lost' ? 0 : (STAGES.find(x => x.key === normStage(s))?.prob ?? 10);

const DOC_LABEL: Record<string, string> = { quote: 'Quote', order: 'Order', invoice: 'Invoice' };
const NEXT_DOC: Record<string, 'order' | 'invoice' | null> = { quote: 'order', order: 'invoice', invoice: null };
const DOC_STAGES = [
  { key: 'draft', label: 'Draft' }, { key: 'sent', label: 'Sent' },
  { key: 'accepted', label: 'Accepted' }, { key: 'paid', label: 'Paid' },
];
const DOC_TONE: Record<string, SFTone> = { draft: 'gray', sent: 'blue', accepted: 'teal', partial: 'amber', paid: 'green', cancelled: 'red' };

const emptyOpp = { title: '', contact_id: '', value: '', expected_close_date: '', stage: 'prospecting', owner: '', referred_by: '', next_step: '', notes: '' };
const emptyItem: CRMSaleItem = { description: '', qty: 1, rate: 0 };
const emptyQuote = { title: '', due_date: '', discount: '0', tax: '0', notes: '' };

function parseItems(json: string): CRMSaleItem[] {
  try { const a = JSON.parse(json); return Array.isArray(a) ? a : []; } catch { return []; }
}

export function SalesforceSalesPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const ownerName = useAppStore(s => s.config?.owner_name ?? '');
  const shopName = useAppStore(s => s.config?.shop_name ?? '');
  const qc = useQueryClient();

  // ?t=quote|order|invoice — the Salesforce top tab bar deep-links each object here
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('t');
  const [tab, setTab] = useState<'opportunities' | 'quote' | 'order' | 'invoice'>(
    urlTab === 'quote' || urlTab === 'order' || urlTab === 'invoice' ? urlTab : 'opportunities'
  );
  useEffect(() => {
    if (urlTab === 'quote' || urlTab === 'order' || urlTab === 'invoice') setTab(urlTab);
    else if (urlTab === null) setTab('opportunities');
  }, [urlTab]);
  const [view, setView] = useState<'kanban' | 'list'>('list'); // 'list' = split view (default), 'kanban' = board
  const [showNewOpp, setShowNewOpp] = useState(false);
  const [oppForm, setOppForm] = useState(emptyOpp);
  const [oppId, setOppId] = useState<string | null>(null);
  const [pathSel, setPathSel] = useState<string | null>(null);
  const [oppTab, setOppTab] = useState<'activity' | 'details' | 'quotes'>('activity');
  const [closeModal, setCloseModal] = useState(false);
  const [closeAs, setCloseAs] = useState<'won' | 'lost'>('won');
  const [lostReason, setLostReason] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  // Activity composer
  const [actType, setActType] = useState<'call' | 'task' | 'meeting' | 'email'>('call');
  const [actText, setActText] = useState('');
  const [actDue, setActDue] = useState('');
  // Details editor
  const [detForm, setDetForm] = useState<typeof emptyOpp | null>(null);
  // Sales docs
  const [docId, setDocId] = useState<string | null>(null);
  const [showQuoteForm, setShowQuoteForm] = useState<null | { dealId: string; contactId: string; docType: 'quote' | 'order' | 'invoice' }>(null);
  const [quoteForm, setQuoteForm] = useState(emptyQuote);
  const [items, setItems] = useState<CRMSaleItem[]>([{ ...emptyItem }]);
  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState({ amount: '', method: 'upi', notes: '' });

  const { data: deals = [] } = useQuery({ queryKey: ['crm-deals', tenantId], queryFn: () => listCRMDeals(tenantId), enabled: !!tenantId });
  const { data: contacts = [] } = useQuery({ queryKey: ['crm-contacts', tenantId, ''], queryFn: () => listCRMContacts(tenantId), enabled: !!tenantId });
  const { data: team = [] } = useQuery({ queryKey: ['crm-team', tenantId], queryFn: () => listCRMTeamMembers(tenantId), enabled: !!tenantId });
  const { data: allSales = [] } = useQuery({ queryKey: ['crm-sales', tenantId, 'all'], queryFn: () => listCRMSales(tenantId), enabled: !!tenantId });
  const { data: followups = [] } = useQuery({ queryKey: ['crm-followups', tenantId], queryFn: () => listCRMFollowUps(tenantId), enabled: !!tenantId });
  const { data: comms = [] } = useQuery({ queryKey: ['crm-comms', tenantId], queryFn: () => listCRMCommunications(tenantId), enabled: !!tenantId });

  // Split view: when nothing is explicitly selected, the first record is shown
  const opp = deals.find(d => d.id === oppId) ?? (view === 'list' ? deals[0] ?? null : null);
  const viewDoc = allSales.find(s => s.id === docId)
    ?? (tab !== 'opportunities' ? allSales.find(s => s.doc_type === tab) ?? null : null);
  const { data: payments = [] } = useQuery({
    queryKey: ['crm-payments', tenantId, viewDoc?.id],
    queryFn: () => listCRMPayments(tenantId, viewDoc!.id),
    enabled: !!tenantId && !!viewDoc,
  });

  const { data: accountsList = [] } = useQuery({ queryKey: ['crm-accounts', tenantId, ''], queryFn: () => listCRMAccounts(tenantId), enabled: !!tenantId });

  const contact = (id: string) => contacts.find(c => c.id === id);
  const contactName = (id: string) => contact(id)?.name ?? '—';
  const accountName = (id: string) => contact(id)?.company || contactName(id);
  // Real Salesforce-style link: resolve the opportunity's account by id, fall back to the contact's company
  const accountLabel = (d: { account_id?: string; contact_id: string }) =>
    accountsList.find(a => a.id === d.account_id)?.name || accountName(d.contact_id);
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['crm-deals'] });
    qc.invalidateQueries({ queryKey: ['crm-sales'] });
    qc.invalidateQueries({ queryKey: ['crm-stats'] });
  };

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const open = deals.filter(d => d.stage !== 'won' && d.stage !== 'lost');
  const won = deals.filter(d => d.stage === 'won');
  const lost = deals.filter(d => d.stage === 'lost');
  const pipelineValue = open.reduce((s, d) => s + (d.value || 0), 0);
  const forecast = open.reduce((s, d) => s + (d.value || 0) * stageProb(d.stage) / 100, 0);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const wonThisMonth = won.filter(d => (d.updated_at || '').slice(0, 7) === thisMonth).reduce((s, d) => s + (d.value || 0), 0);
  const winRate = won.length + lost.length > 0 ? Math.round(won.length * 100 / (won.length + lost.length)) : 0;

  // ── Mutations ───────────────────────────────────────────────────────────────
  const createOpp = useMutation({
    mutationFn: () => createCRMDeal(tenantId, {
      contact_id: oppForm.contact_id, title: oppForm.title, value: Number(oppForm.value) || 0,
      stage: oppForm.stage, expected_close_date: oppForm.expected_close_date || null,
      notes: oppForm.notes, owner: oppForm.owner, referred_by: oppForm.referred_by, next_step: oppForm.next_step,
      account_id: contact(oppForm.contact_id)?.account_id ?? '', // inherit the contact's Account link
    }),
    onSuccess: () => { invalidate(); setShowNewOpp(false); setOppForm(emptyOpp); toast.success('Opportunity created'); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Customer stays engaged at every step — WhatsApp update on each stage change (except Lost)
  const notifyCustomer = (deal: CRMDeal, stage: string) => {
    const ct = contact(deal.contact_id);
    if (!ct?.phone || stage === 'lost') return;
    const msg = stage === 'won'
      ? `🎉 Wonderful news from ${shopName}! Your order "${deal.title}" is confirmed. Thank you for choosing us — we'll be in touch with next steps shortly.`
      : `Update from ${shopName} 📋\nYour file "${deal.title}" has moved to the *${stageLabel(stage)}* stage. We'll keep you posted at every step!`;
    sendWhatsApp(ct.phone, msg)
      .then(() => toast.success('Customer notified on WhatsApp ✓'))
      .catch(() => {});
  };

  const setStage = useMutation({
    mutationFn: async ({ deal, stage }: { deal: CRMDeal; stage: string }) => {
      await updateCRMDeal(tenantId, deal.id, { stage });
      if (stage === 'won' && deal.stage !== 'won') {
        await createDealCommissions(tenantId, { id: deal.id, title: deal.title, value: deal.value, owner: deal.owner, referred_by: deal.referred_by }, ownerName);
      }
      notifyCustomer(deal, stage);
    },
    onSuccess: (_, { stage, deal }) => {
      invalidate(); setPathSel(null);
      qc.invalidateQueries({ queryKey: ['crm-commissions'] });
      if (stage === 'won') {
        setCelebrate(true); setTimeout(() => setCelebrate(false), 2400);
        toast.success(`Opportunity Closed Won — ${fmtINR(deal.value)} 🎉`);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeOpp = useMutation({
    mutationFn: (id: string) => deleteCRMDeal(tenantId, id),
    onSuccess: () => { invalidate(); setOppId(null); toast.success('Opportunity deleted'); },
  });

  const saveDetails = useMutation({
    mutationFn: () => updateCRMDeal(tenantId, opp!.id, {
      title: detForm!.title, contact_id: detForm!.contact_id, value: Number(detForm!.value) || 0,
      expected_close_date: detForm!.expected_close_date || null, owner: detForm!.owner,
      next_step: detForm!.next_step, notes: detForm!.notes,
      account_id: contact(detForm!.contact_id)?.account_id ?? '', // keep the Account link in sync with the contact
    }),
    onSuccess: () => { invalidate(); setDetForm(null); toast.success('Opportunity updated'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const logActivity = useMutation({
    mutationFn: async () => {
      if (!actText.trim()) throw new Error('Enter a subject');
      if (actType === 'task') {
        await createCRMFollowUp(tenantId, {
          contact_id: opp!.contact_id, deal_id: opp!.id, title: actText,
          type: 'task', due_at: actDue || null, status: 'pending', notes: '',
        });
      } else {
        await createCRMCommunication(tenantId, {
          contact_id: opp!.contact_id, type: actType, direction: 'outgoing',
          summary: `[${opp!.title}] ${actText}`, occurred_at: new Date().toISOString(),
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-followups'] });
      qc.invalidateQueries({ queryKey: ['crm-comms'] });
      setActText(''); setActDue('');
      toast.success(actType === 'task' ? 'Task created' : 'Activity logged');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleTask = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateCRMFollowUp(tenantId, id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-followups'] }),
  });

  // Sales docs (quotes/orders/invoices)
  const createDoc = useMutation({
    mutationFn: () => {
      const ctx = showQuoteForm!;
      const docItems = items.filter(it => it.description.trim());
      if (docItems.length === 0) throw new Error('Add at least one line item');
      const subtotal = docItems.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0);
      const total = Math.max(0, subtotal - (Number(quoteForm.discount) || 0) + (Number(quoteForm.tax) || 0));
      return createCRMSale(tenantId, {
        contact_id: ctx.contactId, deal_id: ctx.dealId, doc_type: ctx.docType,
        title: quoteForm.title, items: JSON.stringify(docItems),
        subtotal, discount: Number(quoteForm.discount) || 0, tax: Number(quoteForm.tax) || 0, total,
        due_date: quoteForm.due_date || null, notes: quoteForm.notes,
      });
    },
    onSuccess: () => {
      invalidate(); setShowQuoteForm(null); setQuoteForm(emptyQuote); setItems([{ ...emptyItem }]);
      toast.success('Created');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setDocStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateCRMSale(tenantId, id, { status }),
    onSuccess: () => invalidate(),
  });

  const removeDoc = useMutation({
    mutationFn: (id: string) => deleteCRMSale(tenantId, id),
    onSuccess: () => { invalidate(); setDocId(null); toast.success('Deleted'); },
  });

  const convertDoc = useMutation({
    mutationFn: async (doc: CRMSale) => {
      const next = NEXT_DOC[doc.doc_type];
      if (!next) throw new Error('Cannot convert further');
      await createCRMSale(tenantId, {
        contact_id: doc.contact_id, account_id: doc.account_id, deal_id: doc.deal_id, doc_type: next,
        title: doc.title, items: doc.items, subtotal: doc.subtotal,
        discount: doc.discount, tax: doc.tax, total: doc.total,
        due_date: doc.due_date, owner: doc.owner,
        notes: `Converted from ${doc.doc_no}${doc.notes ? `\n${doc.notes}` : ''}`,
      });
      await updateCRMSale(tenantId, doc.id, { status: 'accepted' });
      return next;
    },
    onSuccess: (next) => { invalidate(); setDocId(null); toast.success(`Converted to ${DOC_LABEL[next]}`); },
    onError: (e: Error) => toast.error(e.message),
  });

  const paidAmount = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const balanceDue = viewDoc ? Math.max(0, (viewDoc.total || 0) - paidAmount) : 0;

  const recordPayment = useMutation({
    mutationFn: async () => {
      const amt = Number(payForm.amount) || 0;
      if (amt <= 0) throw new Error('Enter a valid amount');
      await createCRMPayment(tenantId, { sale_id: viewDoc!.id, amount: amt, method: payForm.method, paid_at: new Date().toISOString(), notes: payForm.notes });
      const fullyPaid = paidAmount + amt >= (viewDoc!.total || 0);
      await updateCRMSale(tenantId, viewDoc!.id, { status: fullyPaid ? 'paid' : 'partial' });
      return fullyPaid;
    },
    onSuccess: (fullyPaid) => {
      invalidate(); qc.invalidateQueries({ queryKey: ['crm-payments'] });
      setPayOpen(false); setPayForm({ amount: '', method: 'upi', notes: '' });
      if (fullyPaid) { setCelebrate(true); setTimeout(() => setCelebrate(false), 2400); toast.success('Invoice fully paid! 🎉'); }
      else toast.success('Payment recorded');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const shareWA = async (doc: CRMSale) => {
    const ct = contact(doc.contact_id);
    if (!ct?.phone) return toast.error('Contact has no phone number');
    const lines = parseItems(doc.items).map(it => `• ${it.description} — ${it.qty} × ${fmtINR(it.rate)} = ${fmtINR(it.qty * it.rate)}`).join('\n');
    const text = `*${DOC_LABEL[doc.doc_type]} ${doc.doc_no}*${doc.title ? ` — ${doc.title}` : ''}\nFrom: ${shopName}\n\n${lines}\n\n` +
      (doc.discount ? `Discount: -${fmtINR(doc.discount)}\n` : '') +
      (doc.tax ? `Tax: +${fmtINR(doc.tax)}\n` : '') +
      `*Total: ${fmtINR(doc.total)}*` +
      (doc.due_date ? `\nDue: ${fmtDate(doc.due_date)}` : '') +
      (doc.doc_type === 'quote'
        ? `\n\n✅ To accept this quotation, simply reply *"I AGREE"* here on WhatsApp, or write to us at frontstores.com@gmail.com`
        : '');
    try {
      await sendWhatsApp(ct.phone, text);
      if (doc.status === 'draft') setDocStatus.mutate({ id: doc.id, status: 'sent' });
      toast.success('Shared on WhatsApp');
    } catch (e: any) { toast.error(e.message); }
  };

  // ── Opportunity path actions ────────────────────────────────────────────────
  const curStage = opp ? normStage(opp.stage) : 'prospecting';
  const isClosed = opp?.stage === 'won' || opp?.stage === 'lost';
  const curIdx = STAGE_KEYS.indexOf(curStage);

  const pathAction = () => {
    if (!opp) return;
    if (pathSel && pathSel !== curStage) { setStage.mutate({ deal: opp, stage: pathSel }); return; }
    if (curIdx >= STAGES.length - 1) { setCloseAs('won'); setLostReason(''); setCloseModal(true); return; }
    setStage.mutate({ deal: opp, stage: STAGE_KEYS[curIdx + 1] });
  };
  const pathActionLabel = pathSel && pathSel !== curStage
    ? 'Mark as Current Stage'
    : curIdx >= STAGES.length - 1 ? 'Close Opportunity' : 'Mark Stage as Complete';

  // ── Activity timeline data for selected opportunity ─────────────────────────
  const oppTasks = useMemo(() => followups.filter(f => f.deal_id === opp?.id), [followups, opp?.id]);
  const oppComms = useMemo(() => comms.filter(c => c.contact_id === opp?.contact_id), [comms, opp?.contact_id]);
  const pendingTasks = oppTasks.filter(t => t.status === 'pending');
  const pastActivity = useMemo(() => ([
    ...oppComms.map(c => ({ id: c.id, kind: c.type, text: c.summary, at: c.occurred_at })),
    ...oppTasks.filter(t => t.status !== 'pending').map(t => ({ id: t.id, kind: 'task-done', text: t.title, at: t.updated_at })),
  ].sort((a, b) => (b.at || '').localeCompare(a.at || ''))), [oppComms, oppTasks]);

  const oppDocs = useMemo(() => allSales.filter(s => s.deal_id === opp?.id), [allSales, opp?.id]);
  const docsFor = (t: string) => allSales.filter(s => s.doc_type === t);
  const oppById = (id: string) => deals.find(d => d.id === id);

  const kanbanCols = [...STAGES.map(s => ({ key: s.key, label: s.label })), { key: 'won', label: 'Closed Won' }, { key: 'lost', label: 'Closed Lost' }];

  // Quote form auto-filled from the opportunity: title, amount as first line item, due = close date
  const openQuoteFromOpp = (d: CRMDeal) => {
    setQuoteForm({
      title: d.title, due_date: d.expected_close_date?.slice(0, 10) ?? '',
      discount: '0', tax: '0', notes: d.next_step ? `Next step: ${d.next_step}` : '',
    });
    setItems([{ description: d.title, qty: 1, rate: d.value || 0 }]);
    setShowQuoteForm({ dealId: d.id, contactId: d.contact_id, docType: 'quote' });
  };

  return (
    <SFPage>
      {celebrate && <Confetti />}

      {/* ── Object header ── */}
      <SFObjectHeader
        icon={<BriefcaseBusiness size={18} />} iconColor={SF_ICONS.opportunity}
        objectLabel="Opportunities" title="All Opportunities"
        sub={`${open.length} open · ${fmtINR(pipelineValue)} in pipeline · sorted by last updated`}
        actions={<>
          {tab === 'opportunities' && (
            <div style={{ display: 'flex', border: `1px solid ${SF.borderStrong}`, borderRadius: '6px', overflow: 'hidden' }}>
              {([['kanban', <LayoutGrid size={14} key="k" />], ['list', <List size={14} key="l" />]] as const).map(([k, ic]) => (
                <button key={k} onClick={() => setView(k)} title={k}
                  style={{ padding: '6px 11px', border: 'none', cursor: 'pointer', background: view === k ? SF.brandSoft : SF.card, color: view === k ? SF.brand : SF.muted, display: 'flex' }}>
                  {ic}
                </button>
              ))}
            </div>
          )}
          {tab === 'opportunities'
            ? <SFBtn variant="brand" onClick={() => { setOppForm(emptyOpp); setShowNewOpp(true); }}><Plus size={14} /> New Opportunity</SFBtn>
            : <SFBtn variant="brand" onClick={() => { setQuoteForm(emptyQuote); setItems([{ ...emptyItem }]); setShowQuoteForm({ dealId: '', contactId: '', docType: tab }); }}><Plus size={14} /> New {DOC_LABEL[tab]}</SFBtn>}
        </>}
      />

      {/* ── KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '14px' }}>
        <SFStat label="Open Pipeline" value={fmtINR(pipelineValue)} sub={`${open.length} open opportunities`} accent={SF_ICONS.opportunity} />
        <SFStat label="Forecast (Weighted)" value={fmtINR(Math.round(forecast))} sub={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><TrendingUp size={11} /> by stage probability</span>} accent={SF.brand} />
        <SFStat label="Closed Won (This Month)" value={fmtINR(wonThisMonth)} sub={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Trophy size={11} /> {won.length} total won</span>} accent={SF.green} />
        <SFStat label="Win Rate" value={`${winRate}%`} sub={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Target size={11} /> {won.length} won / {lost.length} lost</span>} accent={SF.teal} />
      </div>

      {/* ── Tabs ── */}
      <SFTabs style={{ marginBottom: '14px', background: SF.card, borderRadius: '8px 8px 0 0', border: `1px solid ${SF.border}`, borderBottom: `2px solid ${SF.border}`, paddingLeft: '8px' }}
        active={tab} onChange={k => { setTab(k as typeof tab); setSearchParams(k === 'opportunities' ? {} : { t: k }, { replace: true }); }}
        tabs={[
          { key: 'opportunities', label: 'Opportunities', count: deals.length },
          { key: 'quote', label: 'Quotes', count: docsFor('quote').length },
          { key: 'order', label: 'Orders', count: docsFor('order').length },
          { key: 'invoice', label: 'Invoices', count: docsFor('invoice').length },
        ]} />

      {tab === 'opportunities' ? (
        view === 'kanban' ? (
          /* ── Kanban by stage ── */
          <div className="sf-scroll" style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', overflowX: 'auto', paddingBottom: '8px' }}>
            {kanbanCols.map(col => {
              const colDeals = deals.filter(d => normStage(d.stage) === col.key);
              const colVal = colDeals.reduce((s, d) => s + (d.value || 0), 0);
              const isOver = overCol === col.key;
              const tone = col.key === 'won' ? SF.green : col.key === 'lost' ? SF.red : SF.brand;
              return (
                <div key={col.key}
                  onDragOver={e => { e.preventDefault(); setOverCol(col.key); }}
                  onDragLeave={() => setOverCol(null)}
                  onDrop={e => {
                    e.preventDefault(); setOverCol(null);
                    const id = e.dataTransfer.getData('text/plain') || dragId;
                    const d = deals.find(x => x.id === id);
                    if (d && normStage(d.stage) !== col.key) setStage.mutate({ deal: d, stage: col.key });
                    setDragId(null);
                  }}
                  style={{
                    minWidth: '218px', flex: '1 0 218px', background: isOver ? SF.brandSoft : SF.cardHead,
                    border: `1px ${isOver ? 'dashed' : 'solid'} ${isOver ? SF.brand : SF.border}`,
                    borderTop: `3px solid ${tone}`, borderRadius: '8px', padding: '8px', minHeight: '260px',
                  }}>
                  <div style={{ padding: '2px 6px 8px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: SF.heading }}>{col.label} <span style={{ color: SF.muted, fontWeight: 600 }}>({colDeals.length})</span></div>
                    <div style={{ fontSize: '11px', color: SF.muted }}>{fmtINR(colVal)}</div>
                  </div>
                  {colDeals.map(d => (
                    <div key={d.id} draggable
                      onDragStart={e => { setDragId(d.id); e.dataTransfer.setData('text/plain', d.id); }}
                      onDragEnd={() => setDragId(null)}
                      onClick={() => { setView('list'); setOppId(d.id); setPathSel(null); setOppTab('activity'); setDetForm(null); }}
                      className="sf-card-hover"
                      style={{ background: SF.card, border: `1px solid ${SF.border}`, borderRadius: '8px', padding: '10px 12px', marginBottom: '8px', cursor: 'pointer', opacity: dragId === d.id ? 0.4 : 1 }}>
                      <div className="sf-link" style={{ fontSize: '13px', lineHeight: 1.3, marginBottom: '4px' }}>{d.title}</div>
                      <div style={{ fontSize: '11.5px', color: SF.muted, marginBottom: '6px' }}>{accountLabel(d)}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: SF.text }}>{fmtINR(d.value)}</span>
                        <span style={{ fontSize: '11px', color: SF.muted }}>{fmtDate(d.expected_close_date)}</span>
                      </div>
                      {d.owner && <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '6px', fontSize: '11px', color: SF.muted }}><Avatar name={d.owner} size={16} /> {d.owner}</div>}
                    </div>
                  ))}
                  {colDeals.length === 0 && <div style={{ textAlign: 'center', padding: '20px 6px', fontSize: '12px', color: SF.faint }}>No opportunities</div>}
                </div>
              );
            })}
          </div>
        ) : (
          /* ── Split view: opportunity list left, record detail right ── */
          <SFSplit list={
            <SFCard noPad>
              <div className="sf-scroll" style={{ maxHeight: 'calc(100vh - 320px)', overflowY: 'auto' }}>
                {deals.length === 0 ? (
                  <SFEmpty title="No opportunities yet" hint="Create your first opportunity to start tracking your pipeline."
                    action={<SFBtn variant="brand" onClick={() => { setOppForm(emptyOpp); setShowNewOpp(true); }}><Plus size={13} /> New Opportunity</SFBtn>} />
                ) : deals.map(d => (
                  <SFListRow key={d.id} icon={<BriefcaseBusiness size={13} />} iconColor={SF_ICONS.opportunity}
                    title={d.title} sub={`${accountLabel(d)} · ${fmtINR(d.value)}`}
                    right={<SFBadge tone={d.stage === 'won' ? 'green' : d.stage === 'lost' ? 'red' : 'blue'}>{stageLabel(d.stage)}</SFBadge>}
                    selected={opp?.id === d.id}
                    onClick={() => { setOppId(d.id); setPathSel(null); setOppTab('activity'); setDetForm(null); }} />
                ))}
              </div>
            </SFCard>
          }>
            {!opp ? (
              <SFCard><SFEmpty title="Select an opportunity" hint="Pick a record from the list on the left — its details open here." /></SFCard>
            ) : (
              <>
                {/* Record header + actions */}
                <SFCard noPad style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', flexWrap: 'wrap' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '8px', background: SF_ICONS.opportunity, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><BriefcaseBusiness size={16} /></div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '11px', color: SF.muted, fontWeight: 600 }}>Opportunity</div>
                      <div style={{ fontSize: '17px', fontWeight: 700, color: SF.heading, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opp.title}</div>
                    </div>
                    <SFBtn variant="destructive" small onClick={() => { if (confirm('Delete this opportunity?')) removeOpp.mutate(opp.id); }}><Trash2 size={12} /> Delete</SFBtn>
                    {!isClosed && <SFBtn small onClick={() => { setCloseAs('won'); setLostReason(''); setCloseModal(true); }}>Close Opportunity</SFBtn>}
                    <SFBtn variant="brand" small onClick={() => openQuoteFromOpp(opp)}><FileText size={12} /> New Quote</SFBtn>
                  </div>
                </SFCard>

                {/* Highlights */}
                <SFHighlights>
                  <SFHL label="Account">{accountLabel(opp)}</SFHL>
                  <SFHL label="Amount">{fmtINR(opp.value)}</SFHL>
                  <SFHL label="Close Date">{fmtDate(opp.expected_close_date)}</SFHL>
                  <SFHL label="Stage">{stageLabel(opp.stage)}</SFHL>
                  <SFHL label="Probability">{stageProb(opp.stage)}%</SFHL>
                  <SFHL label="Owner">{opp.owner || '—'}</SFHL>
                </SFHighlights>

                {/* Sales Path */}
                <SFCard noPad style={{ marginBottom: '14px' }}>
                  <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 360px', minWidth: '300px' }}>
                      <SFPath stages={STAGES} current={curStage} selected={pathSel} onSelect={k => setPathSel(k === pathSel ? null : k)}
                        closedLabel={isClosed ? (opp.stage === 'won' ? 'Closed Won' : 'Closed Lost') : undefined}
                        closedTone={opp.stage === 'lost' ? 'red' : 'green'} />
                    </div>
                    {isClosed ? (
                      <SFBtn small onClick={() => setStage.mutate({ deal: opp, stage: 'negotiation' })}>Reopen</SFBtn>
                    ) : (
                      <SFBtn variant="brand" small onClick={pathAction} disabled={setStage.isPending}>
                        <Check size={12} /> {pathActionLabel}
                      </SFBtn>
                    )}
                  </div>
                  {opp.next_step && !isClosed && (
                    <div style={{ padding: '8px 14px', borderTop: `1px solid ${SF.border}`, fontSize: '12px', color: SF.muted }}>
                      <b style={{ color: SF.heading }}>Next step:</b> {opp.next_step}
                    </div>
                  )}
                </SFCard>

                {/* Record tabs */}
                <SFTabs style={{ marginBottom: '12px' }} active={oppTab} onChange={k => setOppTab(k as typeof oppTab)}
                  tabs={[
                    { key: 'activity', label: 'Activity', count: pendingTasks.length + pastActivity.length },
                    { key: 'details', label: 'Details' },
                    { key: 'quotes', label: 'Quotes & Orders', count: oppDocs.length },
                  ]} />

                {oppTab === 'activity' && (
                  <>
                    {/* Composer */}
                    <SFCard style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <select className="sf-inp" style={sfInp({ width: '130px' })} value={actType} onChange={e => setActType(e.target.value as typeof actType)}>
                          <option value="call">Log a Call</option>
                          <option value="email">Log Email</option>
                          <option value="meeting">Log Meeting</option>
                          <option value="task">New Task</option>
                        </select>
                        <input className="sf-inp" style={sfInp({ flex: 1, minWidth: '180px' })} value={actText} onChange={e => setActText(e.target.value)}
                          placeholder={actType === 'task' ? 'Task subject…' : 'What happened? e.g. Discussed pricing on call…'}
                          onKeyDown={e => { if (e.key === 'Enter') logActivity.mutate(); }} />
                        {actType === 'task' && <input type="date" className="sf-inp" style={sfInp({ width: '150px' })} value={actDue} onChange={e => setActDue(e.target.value)} />}
                        <SFBtn variant="brand" onClick={() => logActivity.mutate()} disabled={logActivity.isPending}>Save</SFBtn>
                      </div>
                    </SFCard>

                    {/* Upcoming tasks */}
                    {pendingTasks.length > 0 && (
                      <SFCard title="Upcoming & Overdue" icon={<CalendarClock size={13} />} iconColor={SF_ICONS.task} noPad style={{ marginBottom: '12px' }}>
                        {pendingTasks.map(t => (
                          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', borderBottom: `1px solid ${SF.border}` }}>
                            <button onClick={() => toggleTask.mutate({ id: t.id, status: 'done' })} title="Mark complete"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: SF.brand, display: 'flex', padding: 0 }}>
                              <Square size={16} />
                            </button>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: SF.text }}>{t.title}</div>
                              {t.due_at && <div style={{ fontSize: '11px', color: new Date(t.due_at) < new Date() ? SF.red : SF.muted }}>Due {fmtDate(t.due_at)}</div>}
                            </div>
                          </div>
                        ))}
                      </SFCard>
                    )}

                    {/* Timeline */}
                    <SFCard title="Activity Timeline" icon={<Phone size={13} />} iconColor={SF_ICONS.call} noPad>
                      {pastActivity.length === 0 ? (
                        <div style={{ padding: '20px 16px', fontSize: '12.5px', color: SF.faint }}>No past activity. Log a call, email or meeting above.</div>
                      ) : pastActivity.map(a => (
                        <div key={a.id} style={{ display: 'flex', gap: '10px', padding: '10px 16px', borderBottom: `1px solid ${SF.border}` }}>
                          <div style={{ width: 26, height: 26, borderRadius: '6px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: a.kind === 'task-done' ? SF_ICONS.task : a.kind === 'email' ? SF_ICONS.email : SF_ICONS.call }}>
                            {a.kind === 'task-done' ? <CheckSquare size={13} /> : a.kind === 'email' ? <Mail size={13} /> : <Phone size={13} />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', color: SF.text }}>{a.text}</div>
                            <div style={{ fontSize: '11px', color: SF.muted, marginTop: '2px' }}>{timeAgo(a.at)}</div>
                          </div>
                        </div>
                      ))}
                    </SFCard>
                  </>
                )}

                {oppTab === 'details' && (() => {
                  const f = detForm ?? {
                    title: opp.title, contact_id: opp.contact_id, value: String(opp.value ?? ''),
                    expected_close_date: opp.expected_close_date?.slice(0, 10) ?? '', stage: opp.stage,
                    owner: opp.owner ?? '', referred_by: opp.referred_by ?? '', next_step: opp.next_step ?? '', notes: opp.notes ?? '',
                  };
                  const set = (patch: Partial<typeof f>) => setDetForm({ ...f, ...patch });
                  return (
                    <SFCard title="Details" actions={detForm && <SFBtn variant="brand" small onClick={() => saveDetails.mutate()} disabled={saveDetails.isPending}>Save</SFBtn>}>
                      <SFFormGrid>
                        <SFField label="Opportunity Name" span2><input className="sf-inp" style={sfInp()} value={f.title} onChange={e => set({ title: e.target.value })} /></SFField>
                        <SFField label="Contact / Account">
                          <select className="sf-inp" style={sfInp()} value={f.contact_id} onChange={e => set({ contact_id: e.target.value })}>
                            {contacts.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</option>)}
                          </select>
                        </SFField>
                        <SFField label="Amount (₹)"><input type="number" className="sf-inp" style={sfInp()} value={f.value} onChange={e => set({ value: e.target.value })} /></SFField>
                        <SFField label="Close Date"><input type="date" className="sf-inp" style={sfInp()} value={f.expected_close_date} onChange={e => set({ expected_close_date: e.target.value })} /></SFField>
                        <SFField label="Owner">
                          <select className="sf-inp" style={sfInp()} value={f.owner} onChange={e => set({ owner: e.target.value })}>
                            <option value="">— unassigned —</option>
                            {team.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                          </select>
                        </SFField>
                        <SFField label="Next Step" span2><input className="sf-inp" style={sfInp()} value={f.next_step} onChange={e => set({ next_step: e.target.value })} /></SFField>
                        <SFField label="Description" span2><textarea className="sf-inp" style={sfInp({ minHeight: '80px', resize: 'vertical' })} value={f.notes} onChange={e => set({ notes: e.target.value })} /></SFField>
                      </SFFormGrid>
                    </SFCard>
                  );
                })()}

                {oppTab === 'quotes' && (
                  <SFCard title={`Quotes & Orders (${oppDocs.length})`} icon={<FileText size={13} />} iconColor={SF_ICONS.quote} noPad
                    actions={<SFBtn small onClick={() => openQuoteFromOpp(opp)}><Plus size={11} /> New Quote</SFBtn>}>
                    {oppDocs.length === 0 ? (
                      <div style={{ padding: '20px 16px', fontSize: '12.5px', color: SF.faint }}>No quotes yet. Create a quote → convert to order → invoice → record payment.</div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr><th style={sfTh}>No.</th><th style={sfTh}>Type</th><th style={sfTh}>Total</th><th style={sfTh}>Status</th><th style={sfTh}>Updated</th></tr></thead>
                        <tbody>
                          {oppDocs.map(s => (
                            <tr key={s.id} className="sf-row" onClick={() => { setTab(s.doc_type as 'quote' | 'order' | 'invoice'); setDocId(s.id); setSearchParams({ t: s.doc_type }, { replace: true }); }}>
                              <td style={{ ...sfTd, fontFamily: 'monospace', fontSize: '12px' }}><span className="sf-link">{s.doc_no}</span></td>
                              <td style={sfTd}>{DOC_LABEL[s.doc_type]}</td>
                              <td style={{ ...sfTd, fontWeight: 700 }}>{fmtINR(s.total)}</td>
                              <td style={sfTd}><SFBadge tone={DOC_TONE[s.status] ?? 'gray'}>{s.status}</SFBadge></td>
                              <td style={sfTd}>{timeAgo(s.updated_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </SFCard>
                )}
              </>
            )}
          </SFSplit>
        )
      ) : (
        /* ── Quotes / Orders / Invoices: split view — doc list left, detail right ── */
        <SFSplit list={
          <SFCard noPad>
            <div className="sf-scroll" style={{ maxHeight: 'calc(100vh - 320px)', overflowY: 'auto' }}>
              {docsFor(tab).length === 0 ? (
                <SFEmpty title={`No ${DOC_LABEL[tab].toLowerCase()}s yet`}
                  hint={tab === 'quote' ? 'Create a quote from an opportunity or directly here.' : `Convert a ${tab === 'order' ? 'quote' : 'order'} or create one directly.`}
                  action={<SFBtn variant="brand" onClick={() => { setQuoteForm(emptyQuote); setItems([{ ...emptyItem }]); setShowQuoteForm({ dealId: '', contactId: '', docType: tab }); }}><Plus size={13} /> New {DOC_LABEL[tab]}</SFBtn>} />
              ) : docsFor(tab).map(s => (
                <SFListRow key={s.id} icon={<FileText size={13} />} iconColor={SF_ICONS[s.doc_type as keyof typeof SF_ICONS] ?? SF_ICONS.quote}
                  title={`${s.doc_no}${s.title ? ` · ${s.title}` : ''}`} sub={`${contactName(s.contact_id)} · ${fmtINR(s.total)}`}
                  right={<SFBadge tone={DOC_TONE[s.status] ?? 'gray'}>{s.status}</SFBadge>}
                  selected={viewDoc?.id === s.id}
                  onClick={() => setDocId(s.id)} />
              ))}
            </div>
          </SFCard>
        }>
          {!viewDoc ? (
            <SFCard><SFEmpty title={`Select a ${DOC_LABEL[tab].toLowerCase()}`} hint="Pick a record from the list on the left — its details open here." /></SFCard>
          ) : (
            <>
              {/* Record header + actions */}
              <SFCard noPad style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', flexWrap: 'wrap' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '8px', background: SF_ICONS[viewDoc.doc_type as keyof typeof SF_ICONS] ?? SF_ICONS.quote, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FileText size={15} /></div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '11px', color: SF.muted, fontWeight: 600 }}>{DOC_LABEL[viewDoc.doc_type]} · {viewDoc.doc_no}</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: SF.heading, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{viewDoc.title || contactName(viewDoc.contact_id)}</div>
                  </div>
                  <SFBtn variant="destructive" small onClick={() => { if (confirm('Delete this document?')) removeDoc.mutate(viewDoc.id); }}><Trash2 size={12} /> Delete</SFBtn>
                  <SFBtn small onClick={() => shareWA(viewDoc)}><MessageSquare size={12} /> WhatsApp</SFBtn>
                  {NEXT_DOC[viewDoc.doc_type] && (
                    <SFBtn variant="brand" small onClick={() => convertDoc.mutate(viewDoc)} disabled={convertDoc.isPending}>
                      <ArrowRight size={12} /> Convert to {DOC_LABEL[NEXT_DOC[viewDoc.doc_type]!]}
                    </SFBtn>
                  )}
                  {viewDoc.doc_type === 'invoice' && balanceDue > 0 && (
                    <SFBtn variant="success" small onClick={() => { setPayForm({ amount: String(balanceDue), method: 'upi', notes: '' }); setPayOpen(true); }}>
                      <Wallet size={12} /> Record Payment
                    </SFBtn>
                  )}
                </div>
              </SFCard>

              <SFCard noPad style={{ marginBottom: '14px' }}>
                <div style={{ padding: '12px 14px' }}>
                  <SFPath stages={DOC_STAGES} current={viewDoc.status === 'partial' ? 'accepted' : viewDoc.status}
                    onSelect={k => setDocStatus.mutate({ id: viewDoc.id, status: k })} />
                </div>
              </SFCard>

              <SFHighlights>
                <SFHL label="Contact">{contactName(viewDoc.contact_id)}</SFHL>
                <SFHL label="Opportunity">{viewDoc.deal_id ? (oppById(viewDoc.deal_id)?.title ?? '—') : '—'}</SFHL>
                <SFHL label="Due Date">{fmtDate(viewDoc.due_date)}</SFHL>
                <SFHL label="Status"><SFBadge tone={DOC_TONE[viewDoc.status] ?? 'gray'}>{viewDoc.status}</SFBadge></SFHL>
              </SFHighlights>

              <SFCard title="Line Items" noPad style={{ marginBottom: '14px' }}>
                <div style={{ padding: '12px 16px' }}>
                  {parseItems(viewDoc.items).map((it, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0', color: SF.text }}>
                      <span>{it.description} <span style={{ color: SF.muted }}>× {it.qty}</span></span>
                      <span style={{ fontWeight: 700 }}>{fmtINR(it.qty * it.rate)}</span>
                    </div>
                  ))}
                  <div style={{ borderTop: `1px solid ${SF.border}`, marginTop: '8px', paddingTop: '8px', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: SF.muted }}><span>Subtotal</span><span>{fmtINR(viewDoc.subtotal)}</span></div>
                    {viewDoc.discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: SF.muted }}><span>Discount</span><span>-{fmtINR(viewDoc.discount)}</span></div>}
                    {viewDoc.tax > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: SF.muted }}><span>Tax</span><span>+{fmtINR(viewDoc.tax)}</span></div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '15px', marginTop: '4px', color: SF.heading }}><span>Total</span><span>{fmtINR(viewDoc.total)}</span></div>
                  </div>
                </div>
              </SFCard>

              {viewDoc.doc_type === 'invoice' && (
                <SFCard title="Payments" icon={<IndianRupee size={13} />} iconColor={SF_ICONS.invoice} noPad style={{ marginBottom: '14px' }}
                  actions={<span style={{ fontSize: '12px', fontWeight: 700, color: balanceDue > 0 ? SF.red : SF.green }}>{balanceDue > 0 ? `${fmtINR(balanceDue)} due` : 'Fully paid ✓'}</span>}>
                  {payments.length === 0 ? (
                    <div style={{ padding: '16px', fontSize: '12.5px', color: SF.faint }}>No payments recorded yet.</div>
                  ) : payments.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: `1px solid ${SF.border}` }}>
                      <span style={{ fontSize: '13px', color: SF.green, fontWeight: 700 }}>{fmtINR(p.amount)} · {p.method}</span>
                      <span style={{ fontSize: '11.5px', color: SF.muted }}>{fmtDate(p.paid_at)}</span>
                    </div>
                  ))}
                </SFCard>
              )}

              {viewDoc.notes && (
                <SFCard title="Notes"><div style={{ fontSize: '12.5px', color: SF.muted, whiteSpace: 'pre-wrap' }}>{viewDoc.notes}</div></SFCard>
              )}
            </>
          )}
        </SFSplit>
      )}

      {/* ── New Opportunity modal ── */}
      {showNewOpp && (
        <SFModal title="New Opportunity" onClose={() => setShowNewOpp(false)} width={600}
          footer={<>
            <SFBtn onClick={() => setShowNewOpp(false)}>Cancel</SFBtn>
            <SFBtn variant="brand" disabled={createOpp.isPending} onClick={() => {
              if (!oppForm.title.trim()) return toast.error('Opportunity name is required');
              if (!oppForm.contact_id) return toast.error('Pick a contact');
              createOpp.mutate();
            }}>Save</SFBtn>
          </>}>
          <SFFormGrid>
            <SFField label="Opportunity Name" required span2><input className="sf-inp" style={sfInp()} value={oppForm.title} onChange={e => setOppForm(p => ({ ...p, title: e.target.value }))} autoFocus placeholder="e.g. FrontStores CRM — Annual Plan" /></SFField>
            <SFField label="Contact / Account" required>
              <select className="sf-inp" style={sfInp()} value={oppForm.contact_id} onChange={e => setOppForm(p => ({ ...p, contact_id: e.target.value }))}>
                <option value="">— select —</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</option>)}
              </select>
            </SFField>
            <SFField label="Amount (₹)"><input type="number" className="sf-inp" style={sfInp()} value={oppForm.value} onChange={e => setOppForm(p => ({ ...p, value: e.target.value }))} /></SFField>
            <SFField label="Close Date"><input type="date" className="sf-inp" style={sfInp()} value={oppForm.expected_close_date} onChange={e => setOppForm(p => ({ ...p, expected_close_date: e.target.value }))} /></SFField>
            <SFField label="Stage">
              <select className="sf-inp" style={sfInp()} value={oppForm.stage} onChange={e => setOppForm(p => ({ ...p, stage: e.target.value }))}>
                {STAGES.map(s => <option key={s.key} value={s.key}>{s.label} ({s.prob}%)</option>)}
              </select>
            </SFField>
            <SFField label="Owner">
              <select className="sf-inp" style={sfInp()} value={oppForm.owner} onChange={e => setOppForm(p => ({ ...p, owner: e.target.value }))}>
                <option value="">— unassigned —</option>
                {team.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </SFField>
            <SFField label="Next Step"><input className="sf-inp" style={sfInp()} value={oppForm.next_step} onChange={e => setOppForm(p => ({ ...p, next_step: e.target.value }))} placeholder="e.g. Send proposal by Friday" /></SFField>
            <SFField label="Description" span2><textarea className="sf-inp" style={sfInp({ minHeight: '70px', resize: 'vertical' })} value={oppForm.notes} onChange={e => setOppForm(p => ({ ...p, notes: e.target.value }))} /></SFField>
          </SFFormGrid>
        </SFModal>
      )}


      {/* ── Close Opportunity modal (Won / Lost) ── */}
      {closeModal && opp && (
        <SFModal title="Close This Opportunity" onClose={() => setCloseModal(false)} width={440}
          footer={<>
            <SFBtn onClick={() => setCloseModal(false)}>Cancel</SFBtn>
            <SFBtn variant={closeAs === 'won' ? 'success' : 'destructive'} disabled={setStage.isPending} onClick={() => {
              const notes = closeAs === 'lost' && lostReason.trim() ? `Lost reason: ${lostReason}\n${opp.notes ?? ''}` : undefined;
              if (notes !== undefined) updateCRMDeal(tenantId, opp.id, { notes });
              setStage.mutate({ deal: opp, stage: closeAs });
              setCloseModal(false);
            }}>Save</SFBtn>
          </>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
            {(['won', 'lost'] as const).map(k => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', border: `1px solid ${closeAs === k ? SF.brand : SF.borderStrong}`, background: closeAs === k ? SF.brandSoft : SF.card, borderRadius: '8px', cursor: 'pointer' }}>
                <input type="radio" checked={closeAs === k} onChange={() => setCloseAs(k)} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: k === 'won' ? SF.green : SF.red }}>{k === 'won' ? 'Closed Won 🏆' : 'Closed Lost'}</div>
                  <div style={{ fontSize: '11.5px', color: SF.muted }}>{k === 'won' ? `${fmtINR(opp.value)} revenue · commissions auto-created` : 'Opportunity lost to competitor / no decision'}</div>
                </div>
              </label>
            ))}
          </div>
          {closeAs === 'lost' && (
            <SFField label="Lost Reason"><input className="sf-inp" style={sfInp()} value={lostReason} onChange={e => setLostReason(e.target.value)} placeholder="e.g. price, timing, competitor" /></SFField>
          )}
        </SFModal>
      )}

      {/* ── New Quote/Order/Invoice modal ── */}
      {showQuoteForm && (
        <SFModal title={`New ${DOC_LABEL[showQuoteForm.docType]}`} onClose={() => setShowQuoteForm(null)} width={640}
          footer={<>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', fontSize: '14px', fontWeight: 700, color: SF.heading }}>
              Total: {fmtINR(Math.max(0, items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0) - (Number(quoteForm.discount) || 0) + (Number(quoteForm.tax) || 0)))}
            </div>
            <SFBtn onClick={() => setShowQuoteForm(null)}>Cancel</SFBtn>
            <SFBtn variant="brand" disabled={createDoc.isPending} onClick={() => {
              if (!showQuoteForm.contactId) return toast.error('Pick a contact');
              createDoc.mutate();
            }}>Save</SFBtn>
          </>}>
          <SFFormGrid>
            <SFField label="Contact" required>
              <select className="sf-inp" style={sfInp()} value={showQuoteForm.contactId} onChange={e => setShowQuoteForm(p => p && ({ ...p, contactId: e.target.value }))}>
                <option value="">— select —</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</option>)}
              </select>
            </SFField>
            <SFField label="Opportunity">
              <select className="sf-inp" style={sfInp()} value={showQuoteForm.dealId} onChange={e => setShowQuoteForm(p => p && ({ ...p, dealId: e.target.value }))}>
                <option value="">— none —</option>
                {deals.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
            </SFField>
            <SFField label="Title" span2><input className="sf-inp" style={sfInp()} value={quoteForm.title} onChange={e => setQuoteForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. CRM annual subscription" /></SFField>
          </SFFormGrid>

          <div style={{ margin: '14px 0' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: SF.muted, marginBottom: '8px' }}>LINE ITEMS</div>
            {items.map((it, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 110px 100px 30px', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
                <input className="sf-inp" style={sfInp()} value={it.description} placeholder="Item or service…"
                  onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
                <input type="number" className="sf-inp" style={sfInp()} value={it.qty}
                  onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, qty: Number(e.target.value) } : x))} />
                <input type="number" className="sf-inp" style={sfInp()} value={it.rate}
                  onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, rate: Number(e.target.value) } : x))} />
                <div style={{ textAlign: 'right', fontSize: '13px', fontWeight: 700, color: SF.text }}>{fmtINR((it.qty || 0) * (it.rate || 0))}</div>
                <button onClick={() => setItems(p => p.length > 1 ? p.filter((_, j) => j !== i) : p)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: SF.faint, display: 'flex' }}><Trash2 size={13} /></button>
              </div>
            ))}
            <SFBtn small onClick={() => setItems(p => [...p, { ...emptyItem }])}><Plus size={12} /> Add Item</SFBtn>
          </div>

          <SFFormGrid>
            <SFField label="Discount (₹)"><input type="number" className="sf-inp" style={sfInp()} value={quoteForm.discount} onChange={e => setQuoteForm(p => ({ ...p, discount: e.target.value }))} /></SFField>
            <SFField label="Tax (₹)"><input type="number" className="sf-inp" style={sfInp()} value={quoteForm.tax} onChange={e => setQuoteForm(p => ({ ...p, tax: e.target.value }))} /></SFField>
            <SFField label="Due Date"><input type="date" className="sf-inp" style={sfInp()} value={quoteForm.due_date} onChange={e => setQuoteForm(p => ({ ...p, due_date: e.target.value }))} /></SFField>
            <SFField label="Notes"><input className="sf-inp" style={sfInp()} value={quoteForm.notes} onChange={e => setQuoteForm(p => ({ ...p, notes: e.target.value }))} /></SFField>
          </SFFormGrid>
        </SFModal>
      )}


      {/* ── Record payment modal ── */}
      {payOpen && viewDoc && (
        <SFModal title={`Record Payment — ${viewDoc.doc_no}`} onClose={() => setPayOpen(false)} width={420}
          footer={<>
            <SFBtn onClick={() => setPayOpen(false)}>Cancel</SFBtn>
            <SFBtn variant="success" onClick={() => recordPayment.mutate()} disabled={recordPayment.isPending}><Wallet size={13} /> Save Payment</SFBtn>
          </>}>
          <SFFormGrid>
            <SFField label={`Amount (₹) — due ${fmtINR(balanceDue)}`}><input type="number" className="sf-inp" style={sfInp()} value={payForm.amount} onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))} autoFocus /></SFField>
            <SFField label="Method">
              <select className="sf-inp" style={sfInp()} value={payForm.method} onChange={e => setPayForm(p => ({ ...p, method: e.target.value }))}>
                <option value="upi">UPI</option><option value="cash">Cash</option><option value="bank">Bank Transfer</option><option value="card">Card</option><option value="cheque">Cheque</option>
              </select>
            </SFField>
            <SFField label="Notes" span2><input className="sf-inp" style={sfInp()} value={payForm.notes} onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))} /></SFField>
          </SFFormGrid>
        </SFModal>
      )}
    </SFPage>
  );
}

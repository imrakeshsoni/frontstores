// [crm] [all tenants] — Pipeline: drag-and-drop kanban with win celebration + auto-commissions
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, IndianRupee, CalendarDays } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { toast } from 'sonner';
import {
  listCRMDeals, createCRMDeal, updateCRMDeal, deleteCRMDeal,
  listCRMContacts, listCRMTeamMembers, createDealCommissions, type CRMDeal,
} from '@/lib/db/crm';
import {
  CRMPage, PageHead, Panel, Btn, Modal, Field, FormGrid, inp, Confetti, Avatar,
  C, fmtINR, fmtDate, daysUntil,
} from './components/kit';

const STAGES = [
  { key: 'new',         label: 'New',         color: C.slate, bg: C.slateBg },
  { key: 'proposal',    label: 'Proposal',    color: C.blue, bg: C.blueBg },
  { key: 'negotiation', label: 'Negotiation', color: C.amber, bg: C.amberBg },
  { key: 'won',         label: 'Won 🏆',      color: C.green, bg: C.greenBg },
  { key: 'lost',        label: 'Lost',        color: C.red, bg: C.redBg },
];

const emptyForm = { contact_id: '', title: '', value: '', expected_close_date: '', notes: '', stage: 'new', owner: '', referred_by: '' };

export function CRMPipelinePage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const ownerName = useAppStore(s => s.config?.owner_name ?? '');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);

  const { data: deals = [] } = useQuery({ queryKey: ['crm-deals', tenantId], queryFn: () => listCRMDeals(tenantId), enabled: !!tenantId });
  const { data: contacts = [] } = useQuery({ queryKey: ['crm-contacts', tenantId, ''], queryFn: () => listCRMContacts(tenantId), enabled: !!tenantId });
  const { data: team = [] } = useQuery({ queryKey: ['crm-team', tenantId], queryFn: () => listCRMTeamMembers(tenantId), enabled: !!tenantId });

  const contactName = (id: string) => contacts.find(c => c.id === id)?.name ?? '—';
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['crm-deals'] }); qc.invalidateQueries({ queryKey: ['crm-stats'] }); };

  const add = useMutation({
    mutationFn: () => createCRMDeal(tenantId, {
      contact_id: form.contact_id, title: form.title, value: Number(form.value) || 0,
      stage: form.stage, expected_close_date: form.expected_close_date || null,
      notes: form.notes, owner: form.owner, referred_by: form.referred_by,
    }),
    onSuccess: () => { invalidate(); setShowForm(false); setForm(emptyForm); toast.success('Deal added to pipeline 🚀'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const moveStage = useMutation({
    mutationFn: async ({ deal, stage }: { deal: CRMDeal; stage: string }) => {
      await updateCRMDeal(tenantId, deal.id, { stage });
      if (stage === 'won') {
        await createDealCommissions(tenantId, { id: deal.id, title: deal.title, value: deal.value, owner: deal.owner, referred_by: deal.referred_by }, ownerName);
      }
    },
    onSuccess: (_, { stage, deal }) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['crm-commissions'] });
      if (stage === 'won') {
        setCelebrate(true); setTimeout(() => setCelebrate(false), 2400);
        toast.success(`Deal won! ${fmtINR(deal.value)} 🎉 Commissions created.`, {
          action: { label: 'Create Invoice', onClick: () => navigate('/crm/sales') },
        });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCRMDeal(tenantId, id),
    onSuccess: () => { invalidate(); toast.success('Deal deleted'); },
  });

  const totalOpen = deals.filter(d => d.stage !== 'won' && d.stage !== 'lost').reduce((s, d) => s + (d.value || 0), 0);
  const totalWon = deals.filter(d => d.stage === 'won').reduce((s, d) => s + (d.value || 0), 0);

  return (
    <CRMPage>
      {celebrate && <Confetti />}
      <PageHead title="Pipeline" subtitle={`${fmtINR(totalOpen)} in play · ${fmtINR(totalWon)} won — drag deals between stages.`}
        actions={<Btn onClick={() => { setForm(emptyForm); setShowForm(true); }}><Plus size={14} /> New Deal</Btn>} />

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${STAGES.length}, 1fr)`, gap: '12px', alignItems: 'start' }}>
        {STAGES.map(stage => {
          const stageDeals = deals.filter(d => d.stage === stage.key);
          const stageValue = stageDeals.reduce((s, d) => s + (d.value || 0), 0);
          const isOver = overStage === stage.key;
          return (
            <div key={stage.key}
              onDragOver={e => { e.preventDefault(); setOverStage(stage.key); }}
              onDragLeave={() => setOverStage(null)}
              onDrop={e => {
                e.preventDefault(); setOverStage(null);
                const id = e.dataTransfer.getData('text/plain') || dragId;
                const deal = deals.find(d => d.id === id);
                if (deal && deal.stage !== stage.key) moveStage.mutate({ deal, stage: stage.key });
                setDragId(null);
              }}
              style={{
                background: isOver ? stage.bg : C.surface,
                border: `2px dashed ${isOver ? stage.color : 'transparent'}`,
                borderRadius: '12px', padding: '10px', minHeight: '300px', transition: 'all 0.15s ease',
              }}>
              {/* Column header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 6px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: stage.color }} />
                  <span style={{ fontSize: '12px', fontWeight: 800, color: C.text }}>{stage.label}</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: C.muted, background: C.surface, borderRadius: '999px', padding: '1px 7px', border: `1px solid ${C.border}` }}>{stageDeals.length}</span>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: C.muted }}>{fmtINR(stageValue)}</span>
              </div>

              {/* Cards */}
              {stageDeals.map(deal => {
                const closeDays = daysUntil(deal.expected_close_date);
                const isOpenStage = stage.key !== 'won' && stage.key !== 'lost';
                return (
                  <div key={deal.id} draggable
                    onDragStart={e => { setDragId(deal.id); e.dataTransfer.setData('text/plain', deal.id); }}
                    onDragEnd={() => setDragId(null)}
                    className="crm-hover-lift"
                    style={{
                      background: C.surface, border: `1px solid ${C.border}`, borderRadius: '10px',
                      padding: '12px', marginBottom: '8px', cursor: 'grab', boxShadow: C.shadow,
                      opacity: dragId === deal.id ? 0.4 : 1,
                    }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: C.text, marginBottom: '6px', lineHeight: 1.3 }}>{deal.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <Avatar name={contactName(deal.contact_id)} size={20} />
                      <span style={{ fontSize: '11px', color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{contactName(deal.contact_id)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: C.green, display: 'inline-flex', alignItems: 'center' }}>
                        <IndianRupee size={11} />{(deal.value || 0).toLocaleString('en-IN')}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {deal.expected_close_date && isOpenStage && (
                          <span style={{ fontSize: '10px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px', color: closeDays !== null && closeDays < 0 ? C.red : C.muted }}>
                            <CalendarDays size={10} />
                            {closeDays !== null && closeDays < 0 ? `${-closeDays}d late` : fmtDate(deal.expected_close_date)}
                          </span>
                        )}
                        <button onClick={() => { if (confirm('Delete this deal?')) remove.mutate(deal.id); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.faint, padding: '2px', display: 'flex' }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    {deal.owner && <div style={{ fontSize: '10px', color: C.faint, marginTop: '6px' }}>👤 {deal.owner}</div>}
                  </div>
                );
              })}

              {stageDeals.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 8px', fontSize: '12px', color: C.faint }}>
                  Drop deals here
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* New deal modal */}
      {showForm && (
        <Modal title="New Deal" onClose={() => setShowForm(false)}
          footer={<>
            <Btn variant="ghost" onClick={() => setShowForm(false)}>Cancel</Btn>
            <Btn onClick={() => {
              if (!form.title.trim()) return toast.error('Title is required');
              if (!form.contact_id) return toast.error('Pick a contact');
              add.mutate();
            }} disabled={add.isPending}>Add Deal</Btn>
          </>}>
          <FormGrid>
            <Field label="Title *" span2><input style={inp()} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} autoFocus placeholder="e.g. Sharma Hardware — CRM annual plan" /></Field>
            <Field label="Contact *">
              <select style={inp()} value={form.contact_id} onChange={e => setForm(p => ({ ...p, contact_id: e.target.value }))}>
                <option value="">— select —</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</option>)}
              </select>
            </Field>
            <Field label="Value (₹)"><input type="number" style={inp()} value={form.value} onChange={e => setForm(p => ({ ...p, value: e.target.value }))} /></Field>
            <Field label="Stage">
              <select style={inp()} value={form.stage} onChange={e => setForm(p => ({ ...p, stage: e.target.value }))}>
                {STAGES.filter(s => s.key !== 'won' && s.key !== 'lost').map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Expected Close"><input type="date" style={inp()} value={form.expected_close_date} onChange={e => setForm(p => ({ ...p, expected_close_date: e.target.value }))} /></Field>
            <Field label="Owner">
              <select style={inp()} value={form.owner} onChange={e => setForm(p => ({ ...p, owner: e.target.value }))}>
                <option value="">— select —</option>
                {team.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Referred By"><input style={inp()} value={form.referred_by} onChange={e => setForm(p => ({ ...p, referred_by: e.target.value }))} /></Field>
            <Field label="Notes" span2><textarea style={inp({ minHeight: '60px', resize: 'vertical' })} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></Field>
          </FormGrid>
        </Modal>
      )}
    </CRMPage>
  );
}

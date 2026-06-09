// [crm] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listCRMDeals, createCRMDeal, updateCRMDeal, deleteCRMDeal, listCRMContacts, createDealCommissions } from '@/lib/db/crm';
import { getCurrentStaffDisplayName } from '@/lib/db/staffUsers';
import { toast } from 'sonner';

const C = {
  bg: '#f0ece4', nav: '#0f1523', surface: '#ffffff', surface2: '#f8f5f0',
  border: '#e5dfd3', border2: '#ccc5b5', text: '#111520', muted: '#7c7869',
  accent: '#b8922a', accent2: '#d4aa44',
};

const STAGES = [
  { key: 'new',         label: 'New',         topColor: '#64748b', badgeBg: '#f1f5f9', badgeColor: '#475569' },
  { key: 'proposal',    label: 'Proposal',    topColor: '#2563eb', badgeBg: '#dbeafe', badgeColor: '#1d4ed8' },
  { key: 'negotiation', label: 'Negotiation', topColor: '#d97706', badgeBg: '#fef3c7', badgeColor: '#92400e' },
  { key: 'won',         label: 'Won',         topColor: '#16a34a', badgeBg: '#dcfce7', badgeColor: '#15803d' },
  { key: 'lost',        label: 'Lost',        topColor: '#dc2626', badgeBg: '#fee2e2', badgeColor: '#991b1b' },
];

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

const inp = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: C.surface2, border: `1px solid ${C.border}`, color: C.text,
  borderRadius: '4px', padding: '10px 14px', width: '100%', fontSize: '14px',
  fontFamily: "'Inter', -apple-system, sans-serif", outline: 'none', ...extra,
});

export function CRMPipelinePage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const ownerName = useAppStore(s => s.config?.owner_name ?? s.config?.shop_name ?? 'Owner');
  const qc = useQueryClient();

  const { data: currentStaff } = useQuery({
    queryKey: ['current-staff', tenantId],
    queryFn: () => getCurrentStaffDisplayName(tenantId),
    enabled: !!tenantId,
    staleTime: Infinity,
  });
  const isStaff = currentStaff !== null && currentStaff !== undefined;
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ contact_id: '', title: '', value: '', expected_close_date: '', notes: '', stage: 'new' });
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  const { data: deals = [] } = useQuery({
    queryKey: ['crm-deals', tenantId, currentStaff],
    queryFn: () => listCRMDeals(tenantId, { ownerFilter: currentStaff ?? null }),
    enabled: !!tenantId,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['crm-contacts', tenantId, ''],
    queryFn: () => listCRMContacts(tenantId),
    enabled: !!tenantId,
  });

  const contactName = (id: string) => contacts.find(c => c.id === id)?.name ?? '—';

  const add = useMutation({
    mutationFn: () => createCRMDeal(tenantId, {
      contact_id: form.contact_id, title: form.title,
      value: Number(form.value) || 0, stage: form.stage,
      expected_close_date: form.expected_close_date || null, notes: form.notes,
      owner: isStaff ? currentStaff! : ownerName,
      referred_by: '',
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-deals'] });
      qc.invalidateQueries({ queryKey: ['crm-stats'] });
      setShowAdd(false);
      setForm({ contact_id: '', title: '', value: '', expected_close_date: '', notes: '', stage: 'new' });
      toast.success('Deal added');
    },
    onError: (e) => toast.error(String(e)),
  });

  const moveStage = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => updateCRMDeal(tenantId, id, { stage }),
    onSuccess: async (_, { id, stage }) => {
      qc.invalidateQueries({ queryKey: ['crm-deals'] });
      qc.invalidateQueries({ queryKey: ['crm-stats'] });
      if (stage === 'won') {
        const deal = deals.find(d => d.id === id);
        if (deal) {
          await createDealCommissions(tenantId, { id: deal.id, title: deal.title, value: deal.value, owner: deal.owner ?? '', referred_by: deal.referred_by ?? '' }, ownerName);
          qc.invalidateQueries({ queryKey: ['crm-commissions'] });
          toast.success('🎉 Deal won! Commission created.');
        }
      }
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteCRMDeal(tenantId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-deals'] });
      qc.invalidateQueries({ queryKey: ['crm-stats'] });
      toast.success('Deal removed');
    },
  });

  // ── Drag handlers ────────────────────────────────────────────────────────────
  function onDragStart(e: React.DragEvent, dealId: string) {
    setDraggingId(dealId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dealId);
  }

  function onDragEnd() {
    setDraggingId(null);
    setDragOverStage(null);
  }

  function onDragOver(e: React.DragEvent, stageKey: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stageKey);
  }

  function onDrop(e: React.DragEvent, stageKey: string) {
    e.preventDefault();
    const dealId = e.dataTransfer.getData('text/plain') || draggingId;
    if (dealId) {
      const deal = deals.find(d => d.id === dealId);
      if (deal && deal.stage !== stageKey) {
        moveStage.mutate({ id: dealId, stage: stageKey });
      }
    }
    setDraggingId(null);
    setDragOverStage(null);
  }

  const totalPipeline = deals.filter(d => !['won', 'lost'].includes(d.stage)).reduce((s, d) => s + d.value, 0);

  return (
    <div style={{ background: C.bg, minHeight: '100%', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Page header */}
      <div style={{ padding: '28px 30px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.04em', color: C.text, margin: 0 }}>Pipeline</h1>
          <p style={{ fontSize: '11px', color: C.muted, marginTop: '4px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 500 }}>
            {deals.filter(d => !['won','lost'].includes(d.stage)).length} open deals · {fmt(totalPipeline)} total value
          </p>
        </div>
        <button onClick={() => setShowAdd(true)}
          style={{ background: C.nav, color: '#fff', border: 'none', borderRadius: '4px', padding: '10px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em', fontFamily: 'inherit' }}>
          + Add Deal
        </button>
      </div>

      {/* Kanban board */}
      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', padding: '24px 30px 30px' }}>
        <div style={{ display: 'flex', gap: '14px', height: '100%', minWidth: 'max-content' }}>
          {STAGES.map(stage => {
            const stageDeals = deals.filter(d => d.stage === stage.key);
            const stageTotal = stageDeals.reduce((s, d) => s + d.value, 0);
            const isOver = dragOverStage === stage.key;

            return (
              <div key={stage.key}
                onDragOver={e => onDragOver(e, stage.key)}
                onDragLeave={() => setDragOverStage(null)}
                onDrop={e => onDrop(e, stage.key)}
                style={{
                  width: '240px', flexShrink: 0, display: 'flex', flexDirection: 'column',
                  background: isOver ? '#ebe7df' : C.surface2,
                  border: `1px solid ${isOver ? stage.topColor : C.border}`,
                  borderTop: `3px solid ${stage.topColor}`,
                  borderRadius: '4px',
                  transition: 'background 0.15s, border-color 0.15s',
                  boxShadow: isOver ? `0 0 0 2px ${stage.topColor}33` : '0 1px 4px rgba(0,0,0,0.04)',
                }}>

                {/* Column header */}
                <div style={{ padding: '14px 16px 12px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <span style={{ background: stage.badgeBg, color: stage.badgeColor, borderRadius: '2px', padding: '2px 7px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        {stage.label}
                      </span>
                      <span style={{ background: C.border, color: C.muted, borderRadius: '999px', padding: '1px 6px', fontSize: '11px', fontWeight: 700 }}>
                        {stageDeals.length}
                      </span>
                    </div>
                  </div>
                  {stageTotal > 0 && (
                    <div style={{ marginTop: '6px', fontSize: '13px', fontWeight: 700, color: stage.topColor, letterSpacing: '-0.02em' }}>{fmt(stageTotal)}</div>
                  )}
                </div>

                {/* Cards */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {stageDeals.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '32px 12px', color: C.muted, fontSize: '12px', opacity: 0.6 }}>
                      {isOver ? 'Drop here' : 'No deals'}
                    </div>
                  )}
                  {stageDeals.map(deal => (
                    <div
                      key={deal.id}
                      draggable
                      onDragStart={e => onDragStart(e, deal.id)}
                      onDragEnd={onDragEnd}
                      style={{
                        background: C.surface,
                        border: `1px solid ${C.border}`,
                        borderRadius: '4px',
                        padding: '12px 14px',
                        cursor: 'grab',
                        opacity: draggingId === deal.id ? 0.4 : 1,
                        transition: 'opacity 0.15s, box-shadow 0.15s',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                        userSelect: 'none',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)')}
                      onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)')}>

                      {/* Card header */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '6px', marginBottom: '8px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: C.text, fontSize: '13px', lineHeight: 1.3 }}>{deal.title}</div>
                          <div style={{ fontSize: '11px', color: C.muted, marginTop: '2px' }}>{contactName(deal.contact_id)}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                          <GripVertical style={{ width: '13px', height: '13px', color: C.border2, cursor: 'grab' }} />
                          <button onClick={() => { if (confirm('Remove this deal?')) del.mutate(deal.id); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', color: C.border2, display: 'flex', alignItems: 'center' }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')}
                            onMouseLeave={e => (e.currentTarget.style.color = C.border2)}>
                            <Trash2 style={{ width: '12px', height: '12px' }} />
                          </button>
                        </div>
                      </div>

                      {/* Value */}
                      {deal.value > 0 && (
                        <div style={{ fontSize: '15px', fontWeight: 900, color: stage.topColor, letterSpacing: '-0.03em', marginBottom: '6px' }}>
                          {fmt(deal.value)}
                        </div>
                      )}

                      {/* Close date */}
                      {deal.expected_close_date && (
                        <div style={{ fontSize: '11px', color: C.muted, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ opacity: 0.5 }}>Close:</span>
                          {new Date(deal.expected_close_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </div>
                      )}

                      {/* Quick move buttons */}
                      <div style={{ marginTop: '10px', borderTop: `1px solid ${C.border}`, paddingTop: '8px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {STAGES.filter(s => s.key !== stage.key).map(s => (
                          <button key={s.key} onClick={() => moveStage.mutate({ id: deal.id, stage: s.key })}
                            style={{ background: s.badgeBg, color: s.badgeColor, border: 'none', borderRadius: '2px', padding: '3px 7px', fontSize: '10px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.04em' }}>
                            → {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Drop hint at bottom when dragging */}
                  {draggingId && dragOverStage === stage.key && (
                    <div style={{ border: `2px dashed ${stage.topColor}`, borderRadius: '4px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: stage.topColor, fontSize: '12px', fontWeight: 600, opacity: 0.6 }}>
                      Drop here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Deal Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '4px', padding: '32px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.18)', fontFamily: 'inherit' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.03em', color: C.text, margin: '0 0 24px' }}>Add Deal</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, marginBottom: '5px' }}>Contact *</label>
                <select style={inp()} value={form.contact_id} onChange={e => setForm(p => ({ ...p, contact_id: e.target.value }))}>
                  <option value="">Select contact…</option>
                  {contacts.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, marginBottom: '5px' }}>Deal Title *</label>
                <input style={inp()} placeholder="e.g. Annual subscription" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, marginBottom: '5px' }}>Value (₹)</label>
                  <input type="number" style={inp()} placeholder="0" value={form.value} onChange={e => setForm(p => ({ ...p, value: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, marginBottom: '5px' }}>Stage</label>
                  <select style={inp()} value={form.stage} onChange={e => setForm(p => ({ ...p, stage: e.target.value }))}>
                    {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, marginBottom: '5px' }}>Expected Close Date</label>
                <input type="date" style={inp()} value={form.expected_close_date} onChange={e => setForm(p => ({ ...p, expected_close_date: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, marginBottom: '5px' }}>Notes</label>
                <input style={inp()} placeholder="Optional" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, background: C.surface2, color: C.muted, border: `1px solid ${C.border}`, borderRadius: '4px', padding: '11px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={() => add.mutate()} disabled={!form.contact_id || !form.title.trim() || add.isPending}
                style={{ flex: 2, background: C.nav, color: '#fff', border: 'none', borderRadius: '4px', padding: '11px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.04em', opacity: !form.contact_id || !form.title.trim() || add.isPending ? 0.5 : 1 }}>
                {add.isPending ? 'Saving…' : 'Add Deal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// [catering] [all tenants]
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { listCateringEvents, deleteCateringEvent, updateCateringEvent } from '@/lib/db/catering';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

const STATUSES = [
  { value: 'all',       label: 'All' },
  { value: 'inquiry',   label: 'Inquiry' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  inquiry:   { bg: '#fef3c7', text: '#d97706' },
  confirmed: { bg: '#dcfce7', text: '#16a34a' },
  completed: { bg: '#dbeafe', text: '#2563eb' },
  cancelled: { bg: '#fee2e2', text: '#dc2626' },
};

export function CateringEventsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['catering-events', tenantId, status],
    queryFn: () => listCateringEvents(tenantId, status),
    enabled: !!tenantId,
  });

  const filtered = search
    ? events.filter(e => e.customer_name.toLowerCase().includes(search.toLowerCase()) || e.event_no.toLowerCase().includes(search.toLowerCase()) || e.event_type.toLowerCase().includes(search.toLowerCase()))
    : events;

  async function markCompleted(id: string) {
    const ev = events.find(e => e.id === id);
    if (!ev) return;
    await updateCateringEvent(tenantId, id, { ...ev, status: 'completed' });
    qc.invalidateQueries({ queryKey: ['catering-events'] });
    qc.invalidateQueries({ queryKey: ['catering-stats'] });
    toast.success('Event marked as completed');
  }

  async function del(id: string) {
    if (!confirm('Delete this event?')) return;
    await deleteCateringEvent(tenantId, id);
    qc.invalidateQueries({ queryKey: ['catering-events'] });
    qc.invalidateQueries({ queryKey: ['catering-stats'] });
    toast.success('Event deleted');
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Events</h1>
        <button onClick={() => navigate('/catering/events/new')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'var(--accent)' }}>
          <PlusCircle className="h-4 w-4" />
          New Event
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {STATUSES.map(s => (
          <button key={s.value} onClick={() => setStatus(s.value)}
            className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
            style={status === s.value
              ? { background: 'var(--accent)', color: 'white' }
              : { background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
            {s.label}
          </button>
        ))}
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by customer, event no or type…"
        className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none"
        style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />

      {isLoading ? (
        <p className="text-sm text-center py-8" style={{ color: 'var(--text-tertiary)' }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: 'var(--text-tertiary)' }}>No events found</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(ev => {
            const colors = STATUS_COLORS[ev.status] ?? { bg: '#f1f5f9', text: '#64748b' };
            return (
              <div key={ev.id} className="rounded-2xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{ev.customer_name}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: colors.bg, color: colors.text }}>
                        {ev.status.charAt(0).toUpperCase() + ev.status.slice(1)}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                      {ev.event_no} · {ev.event_type} · {ev.venue}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                      {new Date(ev.event_date).toLocaleDateString('en-IN')} · {ev.customer_phone}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <Users className="h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />
                      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{ev.guest_count} guests</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{fmt(ev.total_amount)}</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Adv: {fmt(ev.advance_paid)}</p>
                    <p className="text-xs font-medium" style={{ color: ev.total_amount - ev.advance_paid > 0 ? '#d97706' : '#16a34a' }}>
                      Bal: {fmt(ev.total_amount - ev.advance_paid)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  {ev.status === 'confirmed' && (
                    <button onClick={() => markCompleted(ev.id)}
                      className="flex-1 py-1.5 rounded-xl text-xs font-semibold text-white"
                      style={{ background: '#16a34a' }}>
                      Mark Completed
                    </button>
                  )}
                  <button onClick={() => del(ev.id)} className="p-1.5 rounded-xl" style={{ color: '#ef4444' }}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

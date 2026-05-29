// [catering] [all tenants]
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getCateringReportData } from '@/lib/db/catering';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }
function today() { return new Date().toISOString().substring(0, 10); }
function monthStart() { return new Date().toISOString().substring(0, 7) + '-01'; }

export function CateringReportsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());

  const { data, isLoading } = useQuery({
    queryKey: ['catering-report', tenantId, from, to],
    queryFn: () => getCateringReportData(tenantId, from, to),
    enabled: !!tenantId && !!from && !!to,
  });

  const events = data?.events ?? [];
  const completedEvents = events.filter(e => e.status === 'completed');
  const totalRevenue = completedEvents.reduce((s, e) => s + e.total_amount, 0);
  const totalGuests = completedEvents.reduce((s, e) => s + e.guest_count, 0);

  // By event type
  const byType: Record<string, { count: number; revenue: number }> = {};
  completedEvents.forEach(e => {
    const type = e.event_type || 'Other';
    if (!byType[type]) byType[type] = { count: 0, revenue: 0 };
    byType[type].count += 1;
    byType[type].revenue += e.total_amount;
  });

  const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    inquiry:   { bg: '#fef3c7', text: '#d97706' },
    confirmed: { bg: '#dcfce7', text: '#16a34a' },
    completed: { bg: '#dbeafe', text: '#2563eb' },
    cancelled: { bg: '#fee2e2', text: '#dc2626' },
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-6 w-6" style={{ color: 'var(--accent)' }} />
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Catering Reports</h1>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="px-3 py-2 rounded-xl border text-sm outline-none"
            style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="px-3 py-2 rounded-xl border text-sm outline-none"
            style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-center py-8" style={{ color: 'var(--text-tertiary)' }}>Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Revenue', value: fmt(totalRevenue), color: '#7c3aed' },
              { label: 'Events', value: events.length, color: '#2563eb' },
              { label: 'Completed', value: completedEvents.length, color: '#16a34a' },
              { label: 'Total Guests Served', value: totalGuests, color: '#0891b2' },
            ].map(c => (
              <div key={c.label} className="p-4 rounded-2xl border" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-tertiary)' }}>{c.label}</p>
                <p className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</p>
              </div>
            ))}
          </div>

          {Object.keys(byType).length > 0 && (
            <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
              <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Revenue by Event Type</h2>
              <div className="space-y-2">
                {Object.entries(byType).sort((a, b) => b[1].revenue - a[1].revenue).map(([type, d]) => (
                  <div key={type} className="flex items-center justify-between text-sm py-2 border-b last:border-0" style={{ borderColor: 'var(--surface-border)' }}>
                    <div>
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{type}</span>
                      <span className="ml-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>{d.count} event{d.count !== 1 ? 's' : ''}</span>
                    </div>
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{fmt(d.revenue)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
            <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>All Events ({events.length})</h2>
            {events.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: 'var(--text-tertiary)' }}>No events in this period</p>
            ) : (
              <div className="space-y-2">
                {events.map(e => {
                  const c = STATUS_COLORS[e.status] ?? { bg: '#f1f5f9', text: '#64748b' };
                  return (
                    <div key={e.id} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: 'var(--surface-border)' }}>
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{e.customer_name}</p>
                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{e.event_type} · {new Date(e.event_date).toLocaleDateString('en-IN')} · {e.guest_count} guests</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{fmt(e.total_amount)}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: c.bg, color: c.text }}>{e.status}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// [laundry] [all tenants]
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getLaundryReportData, type LaundryOrder } from '@/lib/db/laundry';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

function today() { return new Date().toISOString().substring(0, 10); }
function monthStart() { return new Date().toISOString().substring(0, 7) + '-01'; }

export function LaundryReportsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());

  const { data, isLoading } = useQuery({
    queryKey: ['laundry-report', tenantId, from, to],
    queryFn: () => getLaundryReportData(tenantId, from, to),
    enabled: !!tenantId && !!from && !!to,
  });

  const orders: LaundryOrder[] = data?.orders ?? [];
  const expenses = data?.expenses ?? [];

  const totalRevenue = orders.filter(o => o.status === 'delivered').reduce((s, o) => s + o.total_amount, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const pending = orders.filter(o => o.status !== 'delivered').length;

  // By service type
  const byServiceType: Record<string, { count: number; revenue: number }> = {};
  orders.forEach(o => {
    o.items.forEach(item => {
      if (!byServiceType[item.service_type]) byServiceType[item.service_type] = { count: 0, revenue: 0 };
      byServiceType[item.service_type].count += item.qty;
      byServiceType[item.service_type].revenue += item.qty * item.price;
    });
  });

  // Pending delivery
  const pendingOrders = orders.filter(o => ['received', 'washing', 'drying', 'ready'].includes(o.status));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-6 w-6" style={{ color: 'var(--accent)' }} />
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Reports</h1>
      </div>

      {/* Date range */}
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
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Revenue', value: fmt(totalRevenue), bg: '#ede9fe', color: '#7c3aed' },
              { label: 'Total Orders', value: orders.length, bg: '#dbeafe', color: '#2563eb' },
              { label: 'Pending Delivery', value: pending, bg: '#fef3c7', color: '#d97706' },
              { label: 'Expenses', value: fmt(totalExpenses), bg: '#fee2e2', color: '#dc2626' },
            ].map(c => (
              <div key={c.label} className="p-4 rounded-2xl border" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-tertiary)' }}>{c.label}</p>
                <p className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* By service type */}
          {Object.keys(byServiceType).length > 0 && (
            <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
              <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Revenue by Service Type</h2>
              <div className="space-y-2">
                {Object.entries(byServiceType).sort((a, b) => b[1].revenue - a[1].revenue).map(([type, data]) => (
                  <div key={type} className="flex items-center justify-between text-sm py-2 border-b last:border-0" style={{ borderColor: 'var(--surface-border)' }}>
                    <div>
                      <span className="font-medium capitalize" style={{ color: 'var(--text-primary)' }}>{type}</span>
                      <span className="ml-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>{data.count} pcs</span>
                    </div>
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{fmt(data.revenue)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending delivery list */}
          {pendingOrders.length > 0 && (
            <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
              <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Pending Delivery ({pendingOrders.length})</h2>
              <div className="space-y-2">
                {pendingOrders.map(o => (
                  <div key={o.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0" style={{ borderColor: 'var(--surface-border)' }}>
                    <div>
                      <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{o.customer_name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{o.order_no} · {o.status}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{fmt(o.total_amount)}</p>
                      {o.promised_date && <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Due: {new Date(o.promised_date).toLocaleDateString('en-IN')}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expenses */}
          {expenses.length > 0 && (
            <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
              <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Expenses</h2>
              <div className="space-y-2">
                {expenses.map(e => (
                  <div key={e.id} className="flex justify-between text-sm py-1.5 border-b last:border-0" style={{ borderColor: 'var(--surface-border)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{e.description}</span>
                    <span className="font-medium" style={{ color: '#dc2626' }}>{fmt(e.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold pt-2">
                  <span style={{ color: 'var(--text-primary)' }}>Total</span>
                  <span style={{ color: '#dc2626' }}>{fmt(totalExpenses)}</span>
                </div>
              </div>
            </div>
          )}

          {orders.length === 0 && (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-tertiary)' }}>No data for selected period</p>
          )}
        </>
      )}
    </div>
  );
}

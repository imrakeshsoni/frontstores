// [furniture] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/app/store/app.store';
import { listFurnOrders, listFurnCustomOrders } from '@/lib/db/furniture';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function FurnitureReportsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');

  const { data: orders = [] } = useQuery({
    queryKey: ['furn-orders-report', tenantId],
    queryFn: () => listFurnOrders(tenantId),
    enabled: !!tenantId,
  });

  const { data: custom = [] } = useQuery({
    queryKey: ['furn-custom-report', tenantId],
    queryFn: () => listFurnCustomOrders(tenantId),
    enabled: !!tenantId,
  });

  const totalRevenue = orders.reduce((s, o) => s + o.total_amount, 0);
  const totalPending = orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').reduce((s, o) => s + (o.total_amount - o.advance_paid), 0);
  const deliveredCount = orders.filter(o => o.status === 'delivered').length;
  const customRevenue = custom.reduce((s, o) => s + o.estimated_cost, 0);

  // Group by month
  const byMonth: Record<string, number> = {};
  for (const o of orders) {
    if (!o.delivery_date) continue;
    const month = o.delivery_date.slice(0, 7);
    byMonth[month] = (byMonth[month] ?? 0) + o.total_amount;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Furniture Reports</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: fmt(totalRevenue), color: '#92400e', bg: '#fef3c7' },
          { label: 'Custom Orders Revenue', value: fmt(customRevenue), color: '#7c3aed', bg: '#ede9fe' },
          { label: 'Orders Delivered', value: String(deliveredCount), color: '#16a34a', bg: '#dcfce7' },
          { label: 'Pending Collection', value: fmt(totalPending), color: '#dc2626', bg: '#fee2e2' },
        ].map(c => (
          <div key={c.label} className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
            <p className="text-xs font-medium text-slate-500 mb-1">{c.label}</p>
            <p className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Monthly revenue */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Monthly Revenue</h2>
        {Object.keys(byMonth).length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-6">No delivered orders yet</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(byMonth).sort(([a], [b]) => b.localeCompare(a)).map(([month, rev]) => (
              <div key={month} className="flex justify-between items-center py-2 border-b border-slate-50 text-sm">
                <span className="font-medium text-slate-700">{new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span>
                <span className="font-bold text-amber-700">{fmt(rev)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending deliveries */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Pending Deliveries</h2>
        {orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-6">All orders delivered</p>
        ) : (
          <div className="space-y-2">
            {orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').map(o => (
              <div key={o.id} className="flex justify-between items-center text-sm py-2 border-b border-slate-50">
                <div>
                  <span className="font-medium text-slate-800">{o.customer_name}</span>
                  <span className="text-xs text-slate-400 ml-2">{o.order_no}</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-900">{fmt(o.total_amount)}</p>
                  {o.delivery_date && <p className="text-xs text-amber-600">{o.delivery_date}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

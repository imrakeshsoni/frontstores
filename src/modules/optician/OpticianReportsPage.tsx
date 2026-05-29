// [optician] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Package, Users } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listOptOrders, listOptPrescriptions } from '@/lib/db/optician';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function OpticianReportsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');

  const { data: allOrders = [] } = useQuery({
    queryKey: ['opt-orders-report', tenantId],
    queryFn: () => listOptOrders(tenantId),
    enabled: !!tenantId,
  });

  const { data: prescriptions = [] } = useQuery({
    queryKey: ['opt-prescriptions-report', tenantId],
    queryFn: () => listOptPrescriptions(tenantId),
    enabled: !!tenantId,
  });

  const monthOrders = allOrders.filter(o => {
    const m = new Date().toISOString().slice(0, 7);
    return o.updated_at && o.updated_at.startsWith(m);
  });

  const monthRevenue = monthOrders.reduce((s, o) => s + o.total_amount, 0);
  const pendingDelivery = allOrders.filter(o => o.status !== 'delivered').length;
  const readyCount = allOrders.filter(o => o.status === 'ready').length;

  // Lens type breakdown
  const lensTypeMap: Record<string, number> = {};
  allOrders.forEach(o => { if (o.lens_type) lensTypeMap[o.lens_type] = (lensTypeMap[o.lens_type] ?? 0) + 1; });
  const lensTypes = Object.entries(lensTypeMap).sort((a, b) => b[1] - a[1]);

  // Status breakdown
  const statusMap: Record<string, number> = {};
  allOrders.forEach(o => { statusMap[o.status] = (statusMap[o.status] ?? 0) + 1; });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Reports</h1>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Month Revenue', value: fmt(monthRevenue), icon: TrendingUp, color: '#0891b2', bg: '#cffafe' },
          { label: 'Pending Delivery', value: pendingDelivery, icon: Package, color: '#d97706', bg: '#fef3c7' },
          { label: 'Total Exams', value: prescriptions.length, icon: Users, color: '#7c3aed', bg: '#ede9fe' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500">{c.label}</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: c.bg }}>
                <c.icon className="h-3.5 w-3.5" style={{ color: c.color }} />
              </span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Orders by Lens Type</h2>
          <div className="space-y-2">
            {lensTypes.length === 0 ? <p className="text-slate-400 text-sm text-center py-4">No data</p> : lensTypes.map(([type, count]) => (
              <div key={type} className="flex items-center gap-3">
                <div className="w-28 text-xs text-slate-600 truncate">{type}</div>
                <div className="flex-1 bg-slate-100 rounded-full h-2">
                  <div className="h-2 rounded-full bg-cyan-500" style={{ width: `${(count / allOrders.length) * 100}%` }} />
                </div>
                <span className="text-xs font-semibold text-slate-700 w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Order Status Summary</h2>
          <div className="space-y-2">
            {[
              { label: 'Order Placed', key: 'order_placed', color: '#1d4ed8', bg: '#dbeafe' },
              { label: 'Lens Received', key: 'lens_received', color: '#92400e', bg: '#fef3c7' },
              { label: 'Ready for Pickup', key: 'ready', color: '#166534', bg: '#dcfce7' },
              { label: 'Delivered', key: 'delivered', color: '#64748b', bg: '#f1f5f9' },
            ].map(s => {
              const count = statusMap[s.key] ?? 0;
              const revenue = allOrders.filter(o => o.status === s.key).reduce((t, o) => t + o.total_amount, 0);
              return (
                <div key={s.key} className="flex justify-between items-center text-sm py-1.5 border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                    <span className="text-slate-700">{s.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.color }}>{count}</span>
                    <span className="text-xs text-slate-500">{fmt(revenue)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pending deliveries table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Pending Deliveries</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-medium text-slate-500 border-b border-slate-100">
                <th className="text-left pb-2">Order No</th>
                <th className="text-left pb-2">Patient</th>
                <th className="text-left pb-2">Lens Type</th>
                <th className="text-left pb-2">Status</th>
                <th className="text-left pb-2">Promised</th>
                <th className="text-right pb-2">Balance</th>
              </tr>
            </thead>
            <tbody>
              {allOrders.filter(o => o.status !== 'delivered').slice(0, 20).map(o => {
                const balance = o.total_amount - o.advance_paid;
                const overdue = o.promised_date && new Date(o.promised_date) < new Date();
                return (
                  <tr key={o.id} className={`border-b border-slate-50 ${overdue ? 'bg-orange-50' : ''}`}>
                    <td className="py-2 text-slate-500">{o.order_no}</td>
                    <td className="py-2 font-medium text-slate-800">{o.patient_name}</td>
                    <td className="py-2 text-slate-500">{o.lens_type || '—'}</td>
                    <td className="py-2"><span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">{o.status}</span></td>
                    <td className={`py-2 text-xs ${overdue ? 'text-red-600 font-semibold' : 'text-slate-400'}`}>{o.promised_date ? new Date(o.promised_date).toLocaleDateString('en-IN') : '—'}</td>
                    <td className="py-2 text-right font-semibold text-orange-600">{balance > 0 ? fmt(balance) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {allOrders.filter(o => o.status !== 'delivered').length === 0 && <p className="text-center text-slate-400 py-8">All orders delivered!</p>}
        </div>
      </div>
    </div>
  );
}

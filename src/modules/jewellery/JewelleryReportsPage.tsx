// [jewellery] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/app/store/app.store';
import { getJewelleryStats, listBills, listRates } from '@/lib/db/jewellery';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function JewelleryReportsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');

  const { data: stats } = useQuery({ queryKey: ['jewellery-stats', tenantId], queryFn: () => getJewelleryStats(tenantId), enabled: !!tenantId });
  const { data: bills = [] } = useQuery({ queryKey: ['jewellery-bills', tenantId], queryFn: () => listBills(tenantId, 20), enabled: !!tenantId });
  const { data: rates = [] } = useQuery({ queryKey: ['jewellery-rates', tenantId], queryFn: () => listRates(tenantId, 7), enabled: !!tenantId });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Reports</h1>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: 'Today\'s Sales', value: fmt(stats?.todaySales ?? 0), sub: `${stats?.todayBills ?? 0} bills`, color: '#16a34a' },
          { label: 'This Month', value: fmt(stats?.monthSales ?? 0), sub: 'total sales', color: '#2563eb' },
          { label: 'Stock Value', value: fmt(stats?.stockValue ?? 0), sub: `${stats?.stockCount ?? 0} pieces`, color: '#d97706' },
          { label: 'Custom Orders', value: stats?.pendingOrders ?? 0, sub: 'pending', color: '#7c3aed' },
          { label: 'Repair Jobs', value: stats?.pendingRepairs ?? 0, sub: 'pending', color: '#dc2626' },
          { label: 'Gold 22K', value: fmt(stats?.gold22k ?? 0), sub: 'per gram today', color: '#92400e' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <p className="text-xs text-slate-500">{c.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: c.color }}>{c.value}</p>
            <p className="text-xs text-slate-400">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent bills */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 mb-3">Recent Bills</h2>
          {bills.length === 0 ? <p className="text-slate-400 text-sm">No bills yet</p> : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {bills.map(b => (
                <div key={b.id} className="flex justify-between items-center py-1.5 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{b.customer_name}</p>
                    <p className="text-xs text-slate-400">{new Date(b.billed_at).toLocaleDateString('en-IN')} · {b.bill_number}</p>
                  </div>
                  <span className="font-semibold text-amber-700">{fmt(b.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rate trend */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 mb-3">Gold Rate (Last 7 Days)</h2>
          {rates.length === 0 ? <p className="text-slate-400 text-sm">No rates recorded</p> : (
            <div className="space-y-2">
              {rates.map(r => (
                <div key={r.id} className="flex justify-between text-sm">
                  <span className="text-slate-600">{new Date(r.rate_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                  <div className="flex gap-4">
                    <span className="text-amber-700 font-medium">22K: {fmt(r.gold_22k)}</span>
                    <span className="text-amber-600">24K: {fmt(r.gold_24k)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

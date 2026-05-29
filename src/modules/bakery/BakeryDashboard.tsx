// [bakery] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, AlertTriangle, Clock, PackageCheck, CalendarCheck } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getBakeryStats, getExpiringBkItems, listBkBulkOrders } from '@/lib/db/bakery';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function BakeryDashboard() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const shopName = useAppStore(s => s.config?.shop_name ?? 'Bakery');
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['bakery-stats', tenantId],
    queryFn: () => getBakeryStats(tenantId),
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  const { data: expiringItems = [] } = useQuery({
    queryKey: ['bk-expiring', tenantId],
    queryFn: () => getExpiringBkItems(tenantId, 4),
    enabled: !!tenantId,
    refetchInterval: 60000,
  });

  const { data: bulkOrders = [] } = useQuery({
    queryKey: ['bk-bulk-today', tenantId],
    queryFn: () => listBkBulkOrders(tenantId, 'confirmed'),
    enabled: !!tenantId,
  });

  const todayBulkOrders = bulkOrders.filter(o => {
    const today = new Date().toISOString().slice(0, 10);
    return o.delivery_date.slice(0, 10) === today;
  });

  const cards = [
    { label: "Today's Revenue", value: fmt(stats?.todayRevenue ?? 0), icon: TrendingUp, color: '#d97706', bg: '#fef3c7', path: '/bakery/billing' },
    { label: "Today's Production", value: `${stats?.todayProductionBatches ?? 0} batches`, icon: PackageCheck, color: '#16a34a', bg: '#dcfce7', path: '/bakery/production' },
    { label: 'Expiring Soon', value: stats?.expiringItemsCount ?? 0, icon: AlertTriangle, color: '#dc2626', bg: '#fee2e2', path: '/bakery/production' },
    { label: 'Bulk Orders Today', value: stats?.bulkOrdersDueToday ?? 0, icon: CalendarCheck, color: '#7c3aed', bg: '#ede9fe', path: '/bakery/bulk-orders' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{shopName}</h1>
        <p className="text-slate-500 text-sm mt-0.5">Bakery &amp; Sweets Shop</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <button key={c.label} onClick={() => navigate(c.path)}
            className="text-left p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-500">{c.label}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: c.bg }}>
                <c.icon className="h-4 w-4" style={{ color: c.color }} />
              </span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{c.value}</p>
          </button>
        ))}
      </div>

      {/* Expiring items alert */}
      {expiringItems.length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <h2 className="font-semibold text-red-800">Items Expiring in Next 4 Hours!</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {expiringItems.map(item => (
              <div key={item.id} className="flex justify-between items-center text-sm bg-white rounded-xl px-3 py-2">
                <div>
                  <p className="font-medium text-slate-800">{item.product_name}</p>
                  <p className="text-xs text-slate-400">Qty: {item.quantity}</p>
                </div>
                <div className="flex items-center gap-1 text-red-600">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="text-xs font-semibold">
                    {item.expiry_at ? new Date(item.expiry_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bulk Orders Due Today */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-purple-600" />
              <h2 className="font-semibold text-slate-900">Bulk Orders Due Today</h2>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">{todayBulkOrders.length}</span>
          </div>
          <div className="space-y-2">
            {todayBulkOrders.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">No bulk orders today</p>
            ) : todayBulkOrders.map(o => (
              <div key={o.id} className="flex justify-between items-center text-sm bg-slate-50 rounded-xl px-3 py-2">
                <div>
                  <p className="font-medium text-slate-800">{o.customer_name}</p>
                  <p className="text-xs text-slate-400">{o.event_type || 'Order'} · {o.customer_phone}</p>
                </div>
                <span className="text-xs font-semibold text-purple-600">{fmt(o.total_amount)}</span>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/bakery/bulk-orders')} className="mt-3 w-full py-2 rounded-xl text-sm font-medium text-purple-600 hover:bg-purple-50 transition-colors">View All Bulk Orders →</button>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'New Sale', icon: '🍞', path: '/bakery/billing' },
              { label: 'Log Production', icon: '🏭', path: '/bakery/production' },
              { label: 'Bulk Order', icon: '🎂', path: '/bakery/bulk-orders' },
              { label: 'Reports', icon: '📊', path: '/bakery/reports' },
            ].map(a => (
              <button key={a.label} onClick={() => navigate(a.path)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                <span className="text-2xl">{a.icon}</span>
                <span className="text-xs font-medium text-slate-700">{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

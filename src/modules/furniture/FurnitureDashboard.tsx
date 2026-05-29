// [furniture] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Package, Truck, TrendingUp, Wrench } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getFurnStats, listFurnOrders } from '@/lib/db/furniture';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function FurnitureDashboard() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const shopName = useAppStore(s => s.config?.shop_name ?? 'Furniture Store');
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['furn-stats', tenantId],
    queryFn: () => getFurnStats(tenantId),
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  const { data: pending = [] } = useQuery({
    queryKey: ['furn-orders-pending', tenantId],
    queryFn: () => listFurnOrders(tenantId, 'confirmed'),
    enabled: !!tenantId,
  });

  const cards = [
    { label: 'Pending Deliveries', value: stats?.pendingDeliveries ?? 0, icon: Truck, color: '#d97706', bg: '#fef3c7', path: '/furniture/orders' },
    { label: 'Custom Orders', value: stats?.customOrdersInProgress ?? 0, icon: Wrench, color: '#7c3aed', bg: '#ede9fe', path: '/furniture/custom-orders' },
    { label: 'Monthly Revenue', value: fmt(stats?.monthRevenue ?? 0), icon: TrendingUp, color: '#16a34a', bg: '#dcfce7', path: '/furniture/reports' },
    { label: 'Products', value: stats?.totalProducts ?? 0, icon: Package, color: '#2563eb', bg: '#dbeafe', path: '/furniture/products' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{shopName}</h1>
        <p className="text-slate-500 text-sm mt-0.5">Furniture Store Management</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <button key={c.label} onClick={() => navigate(c.path)} className="text-left p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all">
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

      {/* Upcoming deliveries */}
      {pending.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Truck className="h-4 w-4 text-amber-600" />
            <h2 className="font-semibold text-amber-800">Pending Deliveries</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {pending.slice(0, 6).map(o => (
              <div key={o.id} className="flex justify-between items-center text-sm bg-white rounded-xl px-3 py-2">
                <div>
                  <p className="font-medium text-slate-800">{o.customer_name}</p>
                  <p className="text-xs text-slate-400">{o.order_no}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-amber-600">{o.delivery_date ?? '—'}</p>
                  <p className="text-xs text-slate-500">{fmt(o.total_amount)}</p>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/furniture/orders')} className="mt-3 text-sm font-medium text-amber-700 hover:underline">View all orders →</button>
        </div>
      )}

      {/* Quick actions */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'New Order', icon: '🛒', path: '/furniture/orders/new' },
            { label: 'Custom Order', icon: '🪵', path: '/furniture/custom-orders' },
            { label: 'Products', icon: '🪑', path: '/furniture/products' },
            { label: 'Reports', icon: '📊', path: '/furniture/reports' },
          ].map(a => (
            <button key={a.label} onClick={() => navigate(a.path)} className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
              <span className="text-2xl">{a.icon}</span>
              <span className="text-xs font-medium text-slate-700">{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

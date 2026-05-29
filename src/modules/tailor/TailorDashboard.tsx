// [tailor] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Scissors, TrendingUp, Package, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getTailorStats, listTailorOrders } from '@/lib/db/tailor';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

const STATUS_LABELS: Record<string, string> = {
  received: 'Received',
  cutting: 'Cutting',
  stitching: 'Stitching',
  ready: 'Ready',
  delivered: 'Delivered',
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  received: { bg: '#dbeafe', text: '#2563eb' },
  cutting: { bg: '#fef9c3', text: '#ca8a04' },
  stitching: { bg: '#ffedd5', text: '#ea580c' },
  ready: { bg: '#dcfce7', text: '#16a34a' },
  delivered: { bg: '#f1f5f9', text: '#64748b' },
};

export function TailorDashboard() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const shopName = useAppStore(s => s.config?.shop_name ?? 'Tailor');
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['tailor-stats', tenantId],
    queryFn: () => getTailorStats(tenantId),
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  const { data: todayDeliveries = [] } = useQuery({
    queryKey: ['tailor-today-deliveries', tenantId],
    queryFn: () => {
      const today = new Date().toISOString().split('T')[0];
      return listTailorOrders(tenantId, { status: undefined }).then(orders =>
        orders.filter(o => o.delivery_date === today && o.status !== 'delivered')
      );
    },
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  const { data: readyOrders = [] } = useQuery({
    queryKey: ['tailor-ready', tenantId],
    queryFn: () => listTailorOrders(tenantId, { status: 'ready' }),
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  const cards = [
    { label: 'Received', value: stats?.receivedCount ?? 0, icon: Package, color: '#2563eb', bg: '#dbeafe', path: '/tailor/orders?status=received' },
    { label: 'Cutting', value: stats?.cuttingCount ?? 0, icon: Scissors, color: '#ca8a04', bg: '#fef9c3', path: '/tailor/orders?status=cutting' },
    { label: 'Stitching', value: stats?.stitchingCount ?? 0, icon: Scissors, color: '#ea580c', bg: '#ffedd5', path: '/tailor/orders?status=stitching' },
    { label: 'Ready for Pickup', value: stats?.readyCount ?? 0, icon: CheckCircle, color: '#16a34a', bg: '#dcfce7', path: '/tailor/orders?status=ready' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{shopName}</h1>
        <p className="text-slate-500 text-sm mt-0.5">Tailor / Boutique</p>
      </div>

      {/* Stats row */}
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

      {/* Revenue cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-purple-600" />
            <span className="text-sm text-slate-500">Monthly Revenue</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{fmt(stats?.monthRevenue ?? 0)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <span className="text-sm text-slate-500">Pending Balance</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{fmt(stats?.pendingBalance ?? 0)}</p>
        </div>
      </div>

      {/* Today's deliveries */}
      {todayDeliveries.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-amber-600" />
            <h2 className="font-semibold text-amber-800">Today's Deliveries ({todayDeliveries.length})</h2>
          </div>
          <div className="space-y-2">
            {todayDeliveries.map(o => (
              <div key={o.id} className="flex justify-between items-center text-sm bg-white rounded-xl px-3 py-2">
                <div>
                  <p className="font-medium text-slate-800">{o.customer_name}</p>
                  <p className="text-xs text-slate-400">{o.item_type} — #{o.order_no}</p>
                </div>
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: STATUS_COLORS[o.status]?.bg, color: STATUS_COLORS[o.status]?.text }}
                >
                  {STATUS_LABELS[o.status]}
                </span>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/tailor/orders')} className="mt-3 text-sm font-medium text-amber-700 hover:underline">View all orders →</button>
        </div>
      )}

      {/* Ready for pickup */}
      {readyOrders.length > 0 && (
        <div className="bg-green-50 border border-green-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <h2 className="font-semibold text-green-800">Ready for Pickup ({readyOrders.length})</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {readyOrders.slice(0, 6).map(o => (
              <div key={o.id} className="flex justify-between items-center text-sm bg-white rounded-xl px-3 py-2">
                <div>
                  <p className="font-medium text-slate-800">{o.customer_name}</p>
                  <p className="text-xs text-slate-400">{o.item_type}</p>
                </div>
                <span className="text-xs text-green-700 font-semibold">{fmt(o.total_amount - o.advance_paid)} due</span>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/tailor/orders?status=ready')} className="mt-3 text-sm font-medium text-green-700 hover:underline">View all ready orders →</button>
        </div>
      )}

      {/* Quick actions */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'New Order', icon: '✂️', path: '/tailor/orders/new' },
            { label: 'All Orders', icon: '📋', path: '/tailor/orders' },
            { label: 'Measurements', icon: '📏', path: '/tailor/measurements' },
            { label: 'Reports', icon: '📊', path: '/tailor/reports' },
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

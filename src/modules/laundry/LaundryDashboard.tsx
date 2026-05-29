// [laundry] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ShirtIcon, Clock, CheckCircle, TrendingUp, AlertTriangle, PlusCircle } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getLaundryStats, listLaundryOrders } from '@/lib/db/laundry';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  received:  { bg: '#dbeafe', text: '#2563eb', label: 'Received' },
  washing:   { bg: '#fef3c7', text: '#d97706', label: 'Washing' },
  drying:    { bg: '#ffedd5', text: '#ea580c', label: 'Drying' },
  ready:     { bg: '#dcfce7', text: '#16a34a', label: 'Ready' },
  delivered: { bg: '#f0fdf4', text: '#15803d', label: 'Delivered' },
};

export function LaundryDashboard() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const shopName = useAppStore(s => s.config?.shop_name ?? 'Laundry');
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['laundry-stats', tenantId],
    queryFn: () => getLaundryStats(tenantId),
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  const { data: readyOrders = [] } = useQuery({
    queryKey: ['laundry-orders-ready', tenantId],
    queryFn: () => listLaundryOrders(tenantId, 'ready'),
    enabled: !!tenantId,
  });

  const { data: recentOrders = [] } = useQuery({
    queryKey: ['laundry-orders-recent', tenantId],
    queryFn: () => listLaundryOrders(tenantId),
    enabled: !!tenantId,
    select: data => data.slice(0, 8),
  });

  const cards = [
    { label: "Today's Revenue", value: fmt(stats?.todayRevenue ?? 0), icon: TrendingUp, color: '#7c3aed', bg: '#ede9fe', path: '/laundry/reports' },
    { label: 'Pending Orders', value: stats?.pendingCount ?? 0, icon: Clock, color: '#d97706', bg: '#fef3c7', path: '/laundry/orders' },
    { label: 'Ready for Pickup', value: stats?.readyCount ?? 0, icon: CheckCircle, color: '#16a34a', bg: '#dcfce7', path: '/laundry/orders' },
    { label: 'Total Orders', value: stats?.totalOrders ?? 0, icon: ShirtIcon, color: '#0891b2', bg: '#cffafe', path: '/laundry/orders' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{shopName}</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Laundry & Dry Clean Management</p>
        </div>
        <button
          onClick={() => navigate('/laundry/orders/new')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'var(--accent)' }}
        >
          <PlusCircle className="h-4 w-4" />
          New Order
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <button key={c.label} onClick={() => navigate(c.path)}
            className="text-left p-4 rounded-2xl border shadow-sm hover:shadow-md transition-all"
            style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{c.label}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: c.bg }}>
                <c.icon className="h-4 w-4" style={{ color: c.color }} />
              </span>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{c.value}</p>
          </button>
        ))}
      </div>

      {/* Status breakdown */}
      <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Orders by Status</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {(['received', 'washing', 'drying', 'ready', 'delivered'] as const).map(s => (
            <button key={s} onClick={() => navigate(`/laundry/orders?status=${s}`)}
              className="flex flex-col items-center gap-1 p-3 rounded-xl transition-colors"
              style={{ background: STATUS_COLORS[s].bg }}>
              <span className="text-xl font-bold" style={{ color: STATUS_COLORS[s].text }}>
                {s === 'received' ? stats?.receivedCount ?? 0 :
                 s === 'washing'  ? stats?.washingCount  ?? 0 :
                 s === 'drying'   ? stats?.dryingCount   ?? 0 :
                 s === 'ready'    ? stats?.readyCount    ?? 0 :
                                   stats?.deliveredCount ?? 0}
              </span>
              <span className="text-xs font-medium" style={{ color: STATUS_COLORS[s].text }}>{STATUS_COLORS[s].label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Ready for pickup */}
      {readyOrders.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: '#dcfce7', border: '1px solid #bbf7d0' }}>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <h2 className="font-semibold text-green-800">Ready for Pickup ({readyOrders.length})</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {readyOrders.slice(0, 6).map(o => (
              <div key={o.id} className="flex justify-between items-center text-sm bg-white rounded-xl px-3 py-2">
                <div>
                  <p className="font-medium text-slate-800">{o.customer_name}</p>
                  <p className="text-xs text-slate-400">{o.order_no} · {o.customer_phone}</p>
                </div>
                <span className="text-sm font-semibold text-green-700">{fmt(o.total_amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent orders */}
        <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Recent Orders</h2>
          </div>
          <div className="space-y-2">
            {recentOrders.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: 'var(--text-tertiary)' }}>No orders yet</p>
            ) : recentOrders.map(o => (
              <div key={o.id} className="flex justify-between items-center text-sm py-1.5 border-b last:border-0" style={{ borderColor: 'var(--surface-border)' }}>
                <div>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{o.customer_name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{o.order_no} · {o.items.length} item(s)</p>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: STATUS_COLORS[o.status]?.bg ?? '#f1f5f9', color: STATUS_COLORS[o.status]?.text ?? '#64748b' }}>
                  {STATUS_COLORS[o.status]?.label ?? o.status}
                </span>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/laundry/orders')} className="mt-3 w-full py-2 rounded-xl text-sm font-medium transition-colors" style={{ color: 'var(--accent)' }}>
            View all orders →
          </button>
        </div>

        {/* Quick actions */}
        <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
          <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Quick Actions</h2>
          {(stats?.pendingCount ?? 0) > 0 && (
            <div className="flex items-center gap-2 mb-4 p-3 rounded-xl" style={{ background: '#fef3c7' }}>
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <p className="text-sm text-amber-800 font-medium">{stats?.pendingCount} orders in progress</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'New Order', icon: '👕', path: '/laundry/orders/new' },
              { label: 'All Orders', icon: '📋', path: '/laundry/orders' },
              { label: 'Price List', icon: '💰', path: '/laundry/services' },
              { label: 'Reports', icon: '📊', path: '/laundry/reports' },
            ].map(a => (
              <button key={a.label} onClick={() => navigate(a.path)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors"
                style={{ borderColor: 'var(--surface-border)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}>
                <span className="text-2xl">{a.icon}</span>
                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// [optician] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Users, TrendingUp, AlertTriangle, Package, ClipboardCheck } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getOpticianStats, listOptOrders } from '@/lib/db/optician';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function OpticianDashboard() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const shopName = useAppStore(s => s.config?.shop_name ?? 'Eye Care');
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['optician-stats', tenantId],
    queryFn: () => getOpticianStats(tenantId),
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  const { data: readyOrders = [] } = useQuery({
    queryKey: ['opt-orders-ready', tenantId],
    queryFn: () => listOptOrders(tenantId, 'ready'),
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  const { data: pendingOrders = [] } = useQuery({
    queryKey: ['opt-orders-pending', tenantId],
    queryFn: () => listOptOrders(tenantId, 'order_placed'),
    enabled: !!tenantId,
  });

  const cards = [
    { label: 'Ready for Pickup', value: stats?.readyForPickup ?? 0, icon: ClipboardCheck, color: '#16a34a', bg: '#dcfce7', path: '/optician/orders' },
    { label: "Today's Exams", value: stats?.todayExams ?? 0, icon: Users, color: '#0891b2', bg: '#cffafe', path: '/optician/prescriptions' },
    { label: 'Month Revenue', value: fmt(stats?.monthRevenue ?? 0), icon: TrendingUp, color: '#7c3aed', bg: '#ede9fe', path: '/optician/reports' },
    { label: 'Low Stock Frames', value: stats?.lowStockItems ?? 0, icon: AlertTriangle, color: '#d97706', bg: '#fef3c7', path: '/optician/inventory' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{shopName}</h1>
        <p className="text-slate-500 text-sm mt-0.5">Optician / Eye Care Center</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Orders ready for pickup */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-green-600" />
              <h2 className="font-semibold text-slate-900">Ready for Pickup</h2>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{readyOrders.length}</span>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {readyOrders.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">No orders ready</p>
            ) : readyOrders.map(o => (
              <div key={o.id} className="flex justify-between items-center text-sm bg-green-50 rounded-xl px-3 py-2">
                <div>
                  <p className="font-medium text-slate-800">{o.patient_name}</p>
                  <p className="text-xs text-slate-400">{o.order_no} · {o.lens_type}</p>
                </div>
                <span className="text-xs font-semibold text-green-600">{fmt(o.total_amount)}</span>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/optician/orders')} className="mt-3 w-full py-2 rounded-xl text-sm font-medium text-green-600 hover:bg-green-50">View All Orders →</button>
        </div>

        {/* Pending orders */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              <h2 className="font-semibold text-slate-900">Pending Orders</h2>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{pendingOrders.length}</span>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {pendingOrders.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">No pending orders</p>
            ) : pendingOrders.map(o => (
              <div key={o.id} className="flex justify-between items-center text-sm bg-blue-50 rounded-xl px-3 py-2">
                <div>
                  <p className="font-medium text-slate-800">{o.patient_name}</p>
                  <p className="text-xs text-slate-400">{o.order_no} · {o.frame_desc}</p>
                </div>
                <span className="text-xs text-slate-400">{o.promised_date ? new Date(o.promised_date).toLocaleDateString('en-IN') : '—'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'New Patient', icon: '👤', path: '/optician/patients' },
            { label: 'Eye Exam', icon: '👓', path: '/optician/prescriptions' },
            { label: 'New Order', icon: '📋', path: '/optician/orders' },
            { label: 'Inventory', icon: '📦', path: '/optician/inventory' },
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
  );
}

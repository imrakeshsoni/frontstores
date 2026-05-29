// [furniture] [all tenants]
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { listFurnOrders, updateFurnOrder } from '@/lib/db/furniture';
import { now } from '@/lib/db/index';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-blue-100 text-blue-700',
  ready: 'bg-amber-100 text-amber-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export function OrdersPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');

  const { data: orders = [] } = useQuery({
    queryKey: ['furn-orders', tenantId, statusFilter],
    queryFn: () => listFurnOrders(tenantId, statusFilter || undefined),
    enabled: !!tenantId,
  });

  async function markDelivered(id: string) {
    try {
      await updateFurnOrder(tenantId, id, { status: 'delivered', delivered_at: now() });
      toast.success('Order marked as delivered');
      qc.invalidateQueries({ queryKey: ['furn-orders', tenantId] });
      qc.invalidateQueries({ queryKey: ['furn-stats', tenantId] });
    } catch (e) { toast.error(String(e)); }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
        <button onClick={() => navigate('/furniture/orders/new')} className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-600 text-white text-sm font-semibold transition-colors">
          + New Order
        </button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {['', 'confirmed', 'ready', 'delivered', 'cancelled'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${statusFilter === s ? 'bg-amber-700 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        {orders.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-6">No orders found</p>
        ) : (
          <div className="space-y-3">
            {orders.map(o => {
              const balance = o.total_amount - o.advance_paid;
              return (
                <div key={o.id} className="flex items-start justify-between p-4 rounded-xl border border-slate-100 hover:bg-slate-50">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-slate-900">{o.customer_name}</span>
                      <span className="text-xs text-slate-400">{o.order_no}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[o.status] ?? 'bg-slate-100 text-slate-600'}`}>{o.status}</span>
                    </div>
                    <p className="text-sm text-slate-500">{o.customer_phone}</p>
                    {o.delivery_date && <p className="text-xs text-amber-600 mt-1">Delivery: {o.delivery_date}</p>}
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-bold text-slate-900">{fmt(o.total_amount)}</p>
                    {balance > 0 && <p className="text-xs text-red-500">Pending: {fmt(balance)}</p>}
                    {o.status !== 'delivered' && o.status !== 'cancelled' && (
                      <button onClick={() => markDelivered(o.id)} className="mt-2 px-3 py-1 rounded-lg bg-green-100 hover:bg-green-200 text-green-700 text-xs font-medium transition-colors">
                        Mark Delivered
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

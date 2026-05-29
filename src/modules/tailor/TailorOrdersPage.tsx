// [tailor] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { listTailorOrders, updateTailorOrderStatus, deleteTailorOrder, type TailorOrder } from '@/lib/db/tailor';

const STATUSES = ['all', 'received', 'cutting', 'stitching', 'ready', 'delivered'] as const;

const STATUS_LABELS: Record<string, string> = {
  all: 'All',
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

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function TailorOrdersPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [activeStatus, setActiveStatus] = useState<string>(searchParams.get('status') ?? 'all');

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['tailor-orders', tenantId, activeStatus, search],
    queryFn: () => listTailorOrders(tenantId, {
      status: activeStatus === 'all' ? undefined : activeStatus,
      search: search || undefined,
    }),
    enabled: !!tenantId,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TailorOrder['status'] }) =>
      updateTailorOrderStatus(tenantId, id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tailor-orders'] });
      qc.invalidateQueries({ queryKey: ['tailor-stats'] });
      toast.success('Order status updated');
    },
  });

  const deleteOrder = useMutation({
    mutationFn: (id: string) => deleteTailorOrder(tenantId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tailor-orders'] });
      toast.success('Order deleted');
    },
  });

  const NEXT_STATUS: Record<string, TailorOrder['status']> = {
    received: 'cutting',
    cutting: 'stitching',
    stitching: 'ready',
    ready: 'delivered',
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Orders</h1>
        <button
          onClick={() => navigate('/tailor/orders/new')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: '#7c3aed' }}
        >
          <Plus className="h-4 w-4" />
          New Order
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by customer, item, order no…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
        />
      </div>

      {/* Status filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setActiveStatus(s)}
            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={activeStatus === s
              ? { background: '#7c3aed', color: 'white' }
              : { background: '#f1f5f9', color: '#64748b' }}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Order list */}
      {isLoading ? (
        <p className="text-slate-400 text-sm">Loading…</p>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-4xl mb-2">✂️</p>
          <p>No orders found</p>
          <button onClick={() => navigate('/tailor/orders/new')} className="mt-3 text-sm text-purple-600 hover:underline">Create new order</button>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map(o => (
            <div key={o.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-slate-900">{o.customer_name}</span>
                    <span className="text-xs text-slate-400">#{o.order_no}</span>
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: STATUS_COLORS[o.status]?.bg, color: STATUS_COLORS[o.status]?.text }}
                    >
                      {STATUS_LABELS[o.status]}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">{o.item_type}{o.description ? ` — ${o.description}` : ''}</p>
                  <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
                    {o.delivery_date && <span>Delivery: {new Date(o.delivery_date).toLocaleDateString('en-IN')}</span>}
                    <span>Total: {fmt(o.total_amount)}</span>
                    <span>Advance: {fmt(o.advance_paid)}</span>
                    {o.total_amount > o.advance_paid && (
                      <span className="text-orange-600 font-medium">Due: {fmt(o.total_amount - o.advance_paid)}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  {NEXT_STATUS[o.status] && (
                    <button
                      onClick={() => updateStatus.mutate({ id: o.id, status: NEXT_STATUS[o.status] })}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                      style={{ background: '#7c3aed' }}
                    >
                      → {STATUS_LABELS[NEXT_STATUS[o.status]]}
                    </button>
                  )}
                  <button
                    onClick={() => navigate(`/tailor/orders/${o.id}`)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

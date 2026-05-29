// [laundry] [all tenants]
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PlusCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { listLaundryOrders, updateLaundryOrderStatus, deleteLaundryOrder, type LaundryOrder } from '@/lib/db/laundry';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

const STATUSES = [
  { value: 'all',       label: 'All' },
  { value: 'received',  label: 'Received' },
  { value: 'washing',   label: 'Washing' },
  { value: 'drying',    label: 'Drying' },
  { value: 'ready',     label: 'Ready' },
  { value: 'delivered', label: 'Delivered' },
];

const STATUS_NEXT: Record<string, string> = {
  received: 'washing',
  washing:  'drying',
  drying:   'ready',
  ready:    'delivered',
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  received:  { bg: '#dbeafe', text: '#2563eb' },
  washing:   { bg: '#fef3c7', text: '#d97706' },
  drying:    { bg: '#ffedd5', text: '#ea580c' },
  ready:     { bg: '#dcfce7', text: '#16a34a' },
  delivered: { bg: '#f1f5f9', text: '#64748b' },
};

export function LaundryOrdersPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState(searchParams.get('status') ?? 'all');
  const [search, setSearch] = useState('');

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['laundry-orders', tenantId, status],
    queryFn: () => listLaundryOrders(tenantId, status),
    enabled: !!tenantId,
  });

  const filtered = search
    ? orders.filter(o => o.customer_name.toLowerCase().includes(search.toLowerCase()) || o.order_no.toLowerCase().includes(search.toLowerCase()) || o.customer_phone.includes(search))
    : orders;

  async function advance(order: LaundryOrder) {
    const next = STATUS_NEXT[order.status];
    if (!next) return;
    await updateLaundryOrderStatus(tenantId, order.id, next);
    qc.invalidateQueries({ queryKey: ['laundry-orders'] });
    qc.invalidateQueries({ queryKey: ['laundry-stats'] });
    toast.success(`Order moved to ${next}`);
  }

  async function deleteOrder(id: string) {
    if (!confirm('Delete this order?')) return;
    await deleteLaundryOrder(tenantId, id);
    qc.invalidateQueries({ queryKey: ['laundry-orders'] });
    qc.invalidateQueries({ queryKey: ['laundry-stats'] });
    toast.success('Order deleted');
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Laundry Orders</h1>
        <button
          onClick={() => navigate('/laundry/orders/new')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'var(--accent)' }}
        >
          <PlusCircle className="h-4 w-4" />
          New Order
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {STATUSES.map(s => (
          <button key={s.value}
            onClick={() => setStatus(s.value)}
            className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
            style={status === s.value
              ? { background: 'var(--accent)', color: 'white' }
              : { background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
            {s.label}
          </button>
        ))}
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by name, order no or phone…"
        className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none"
        style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}
      />

      {isLoading ? (
        <p className="text-sm text-center py-8" style={{ color: 'var(--text-tertiary)' }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: 'var(--text-tertiary)' }}>No orders found</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(o => (
            <div key={o.id} className="rounded-2xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{o.customer_name}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: STATUS_COLORS[o.status]?.bg ?? '#f1f5f9', color: STATUS_COLORS[o.status]?.text ?? '#64748b' }}>
                      {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                    {o.order_no} · {o.customer_phone} · {o.items.length} item(s)
                  </p>
                  {o.promised_date && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                      Due: {new Date(o.promised_date).toLocaleDateString('en-IN')}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{fmt(o.total_amount)}</p>
                  {o.advance_paid > 0 && (
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Adv: {fmt(o.advance_paid)}</p>
                  )}
                </div>
              </div>
              {/* Item summary */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {o.items.map((item, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-md" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                    {item.qty}x {item.item_name} ({item.service_type})
                  </span>
                ))}
              </div>
              {/* Actions */}
              <div className="flex gap-2 mt-3">
                {STATUS_NEXT[o.status] && (
                  <button onClick={() => advance(o)}
                    className="flex-1 py-1.5 rounded-xl text-xs font-semibold text-white"
                    style={{ background: 'var(--accent)' }}>
                    Mark as {STATUS_NEXT[o.status].charAt(0).toUpperCase() + STATUS_NEXT[o.status].slice(1)}
                  </button>
                )}
                <button onClick={() => deleteOrder(o.id)}
                  className="p-1.5 rounded-xl transition-colors"
                  style={{ color: '#ef4444' }}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// [bakery] [all tenants]
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, CalendarCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { listBkBulkOrders, createBkBulkOrder, updateBkBulkOrder, deleteBkBulkOrder } from '@/lib/db/bakery';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  confirmed: { bg: '#dbeafe', text: '#1d4ed8' },
  preparing: { bg: '#fef3c7', text: '#92400e' },
  ready: { bg: '#dcfce7', text: '#166534' },
  delivered: { bg: '#f1f5f9', text: '#64748b' },
};

const EVENT_TYPES = ['Birthday', 'Wedding', 'Anniversary', 'Corporate', 'Festive', 'Other'];

export function BulkOrdersPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();

  const [filter, setFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    customer_name: '', customer_phone: '', event_type: '',
    items: '', delivery_date: '', advance_paid: '', total_amount: '',
    status: 'confirmed', notes: '',
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['bk-bulk-orders', tenantId, filter],
    queryFn: () => filter === 'all' ? listBkBulkOrders(tenantId) : listBkBulkOrders(tenantId, filter),
    enabled: !!tenantId,
  });

  function resetForm() {
    setForm({ customer_name: '', customer_phone: '', event_type: '', items: '', delivery_date: '', advance_paid: '', total_amount: '', status: 'confirmed', notes: '' });
    setShowForm(false);
  }

  async function handleSave() {
    if (!form.customer_name || !form.delivery_date) { toast.error('Fill required fields'); return; }
    try {
      await createBkBulkOrder(tenantId, {
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        event_type: form.event_type,
        items: form.items,
        delivery_date: form.delivery_date,
        advance_paid: Number(form.advance_paid) || 0,
        total_amount: Number(form.total_amount) || 0,
        status: form.status,
        notes: form.notes,
      });
      toast.success('Bulk order created');
      qc.invalidateQueries({ queryKey: ['bk-bulk-orders'] });
      qc.invalidateQueries({ queryKey: ['bakery-stats'] });
      resetForm();
    } catch { toast.error('Failed to create'); }
  }

  async function handleStatusChange(id: string, status: string) {
    await updateBkBulkOrder(tenantId, id, { status });
    qc.invalidateQueries({ queryKey: ['bk-bulk-orders'] });
    toast.success('Status updated');
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this order?')) return;
    await deleteBkBulkOrder(tenantId, id);
    qc.invalidateQueries({ queryKey: ['bk-bulk-orders'] });
    toast.success('Deleted');
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Bulk Orders</h1>
          <p className="text-slate-500 text-sm">{orders.length} orders</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: '#d97706' }}>
          <Plus className="h-4 w-4" /> New Order
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['all', 'confirmed', 'preparing', 'ready', 'delivered'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === s ? 'text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
            style={filter === s ? { background: '#d97706' } : {}}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-slate-900">New Bulk Order</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-slate-500 block mb-1">Customer Name *</label>
              <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-slate-500 block mb-1">Phone</label>
              <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.customer_phone} onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-slate-500 block mb-1">Event Type</label>
              <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.event_type} onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}>
                <option value="">Select</option>{EVENT_TYPES.map(e => <option key={e} value={e}>{e}</option>)}</select></div>
            <div><label className="text-xs font-medium text-slate-500 block mb-1">Delivery Date *</label>
              <input type="date" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.delivery_date} onChange={e => setForm(f => ({ ...f, delivery_date: e.target.value }))} /></div>
            <div className="col-span-2"><label className="text-xs font-medium text-slate-500 block mb-1">Items (description)</label>
              <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="e.g. Birthday cake 2kg, 50 cupcakes" value={form.items} onChange={e => setForm(f => ({ ...f, items: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-slate-500 block mb-1">Total Amount</label>
              <input type="number" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-slate-500 block mb-1">Advance Paid</label>
              <input type="number" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.advance_paid} onChange={e => setForm(f => ({ ...f, advance_paid: e.target.value }))} /></div>
            <div className="col-span-2"><label className="text-xs font-medium text-slate-500 block mb-1">Notes</label>
              <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="px-5 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: '#d97706' }}>Save</button>
            <button onClick={resetForm} className="px-5 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {orders.map(o => {
          const sc = STATUS_COLORS[o.status] ?? STATUS_COLORS.confirmed;
          const balance = o.total_amount - o.advance_paid;
          const isOverdue = o.status !== 'delivered' && new Date(o.delivery_date) < new Date();
          return (
            <div key={o.id} className={`bg-white rounded-2xl border shadow-sm p-4 ${isOverdue ? 'border-red-200' : 'border-slate-100'}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: sc.bg }}>
                    <CalendarCheck className="h-5 w-5" style={{ color: sc.text }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{o.customer_name}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: sc.bg, color: sc.text }}>{o.status}</span>
                      {isOverdue && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">Overdue</span>}
                    </div>
                    <p className="text-sm text-slate-500">{o.event_type && `${o.event_type} · `}{o.customer_phone}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{o.items}</p>
                    <p className="text-xs text-slate-400">Delivery: {new Date(o.delivery_date).toLocaleDateString('en-IN')}</p>
                    {o.notes && <p className="text-xs text-slate-300 mt-0.5">{o.notes}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900">{fmt(o.total_amount)}</p>
                  <p className="text-xs text-green-600">Adv: {fmt(o.advance_paid)}</p>
                  {balance > 0 && <p className="text-xs text-orange-500">Due: {fmt(balance)}</p>}
                </div>
              </div>
              <div className="flex gap-2 mt-3 pt-3 border-t border-slate-50">
                {['confirmed', 'preparing', 'ready', 'delivered'].map(s => (
                  <button key={s} onClick={() => handleStatusChange(o.id, s)}
                    disabled={o.status === s}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium border transition-all disabled:opacity-40"
                    style={o.status === s ? { background: sc.bg, color: sc.text, borderColor: sc.text + '40' } : { borderColor: '#e2e8f0', color: '#64748b' }}>
                    {s}
                  </button>
                ))}
                <button onClick={() => handleDelete(o.id)} className="ml-auto px-2.5 py-1 rounded-lg text-xs font-medium border border-red-100 text-red-400 hover:bg-red-50">Delete</button>
              </div>
            </div>
          );
        })}
        {orders.length === 0 && <p className="text-center text-slate-400 py-12">No bulk orders found</p>}
      </div>
    </div>
  );
}

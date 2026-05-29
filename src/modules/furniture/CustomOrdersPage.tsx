// [furniture] [all tenants]
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { listFurnCustomOrders, createFurnCustomOrder, updateFurnCustomOrder } from '@/lib/db/furniture';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

const STATUS_COLORS: Record<string, string> = {
  design: 'bg-purple-100 text-purple-700',
  in_progress: 'bg-blue-100 text-blue-700',
  ready: 'bg-amber-100 text-amber-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export function CustomOrdersPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    customer_name: '', customer_phone: '', description: '',
    wood_type: '', dimensions: '', estimated_cost: '',
    advance_paid: '', delivery_date: '', carpenter: '', status: 'design',
  });
  const [saving, setSaving] = useState(false);

  const { data: orders = [] } = useQuery({
    queryKey: ['furn-custom-orders', tenantId],
    queryFn: () => listFurnCustomOrders(tenantId),
    enabled: !!tenantId,
  });

  async function handleSave() {
    if (!form.customer_name || !form.description) { toast.error('Customer name and description required'); return; }
    setSaving(true);
    try {
      const count = Date.now();
      await createFurnCustomOrder(tenantId, {
        order_no: `CO-${count.toString().slice(-6)}`,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        description: form.description,
        wood_type: form.wood_type,
        dimensions: form.dimensions,
        estimated_cost: parseFloat(form.estimated_cost) || 0,
        advance_paid: parseFloat(form.advance_paid) || 0,
        delivery_date: form.delivery_date || null,
        status: form.status,
        carpenter: form.carpenter,
      });
      toast.success('Custom order created');
      setShowAdd(false);
      setForm({ customer_name: '', customer_phone: '', description: '', wood_type: '', dimensions: '', estimated_cost: '', advance_paid: '', delivery_date: '', carpenter: '', status: 'design' });
      qc.invalidateQueries({ queryKey: ['furn-custom-orders', tenantId] });
      qc.invalidateQueries({ queryKey: ['furn-stats', tenantId] });
    } catch (e) { toast.error(String(e)); }
    finally { setSaving(false); }
  }

  async function updateStatus(id: string, status: string) {
    try {
      await updateFurnCustomOrder(tenantId, id, { status });
      toast.success('Status updated');
      qc.invalidateQueries({ queryKey: ['furn-custom-orders', tenantId] });
      qc.invalidateQueries({ queryKey: ['furn-stats', tenantId] });
    } catch (e) { toast.error(String(e)); }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Custom Orders</h1>
        <button onClick={() => setShowAdd(s => !s)} className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-600 text-white text-sm font-semibold transition-colors">
          + New Custom Order
        </button>
      </div>

      {showAdd && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="font-semibold text-slate-900 mb-4">New Custom / Made-to-Order</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              ['Customer Name *', 'customer_name', 'text'],
              ['Phone', 'customer_phone', 'tel'],
              ['Wood Type', 'wood_type', 'text'],
              ['Dimensions', 'dimensions', 'text'],
              ['Estimated Cost (₹)', 'estimated_cost', 'number'],
              ['Advance Paid (₹)', 'advance_paid', 'number'],
              ['Delivery Date', 'delivery_date', 'date'],
              ['Carpenter', 'carpenter', 'text'],
            ].map(([label, key, type]) => (
              <div key={key}>
                <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                <input type={type} value={(form as any)[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            ))}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Description *</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                placeholder="e.g. Double bed with storage, king size, teak wood"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                <option value="design">Design</option>
                <option value="in_progress">In Progress</option>
                <option value="ready">Ready</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm hover:bg-slate-50">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-6 py-2 rounded-xl bg-amber-700 text-white text-sm font-semibold disabled:opacity-40 hover:bg-amber-600">
              {saving ? 'Saving…' : 'Create Order'}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {orders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
            <p className="text-slate-400 text-sm">No custom orders yet</p>
          </div>
        ) : orders.map(o => {
          const balance = o.estimated_cost - o.advance_paid;
          return (
            <div key={o.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-slate-900">{o.customer_name}</span>
                    <span className="text-xs text-slate-400">{o.order_no}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[o.status] ?? 'bg-slate-100 text-slate-600'}`}>{o.status.replace('_', ' ')}</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{o.description}</p>
                  <div className="flex gap-4 mt-2 text-xs text-slate-500">
                    {o.wood_type && <span>Wood: {o.wood_type}</span>}
                    {o.dimensions && <span>Size: {o.dimensions}</span>}
                    {o.carpenter && <span>Carpenter: {o.carpenter}</span>}
                    {o.delivery_date && <span>Delivery: {o.delivery_date}</span>}
                  </div>
                </div>
                <div className="text-right ml-4">
                  <p className="font-bold text-slate-900">{fmt(o.estimated_cost)}</p>
                  {balance > 0 && <p className="text-xs text-red-500">Pending: {fmt(balance)}</p>}
                </div>
              </div>
              {o.status !== 'delivered' && o.status !== 'cancelled' && (
                <div className="flex gap-2 mt-3">
                  {o.status === 'design' && <button onClick={() => updateStatus(o.id, 'in_progress')} className="px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 text-xs font-medium hover:bg-blue-200">Start Production</button>}
                  {o.status === 'in_progress' && <button onClick={() => updateStatus(o.id, 'ready')} className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 text-xs font-medium hover:bg-amber-200">Mark Ready</button>}
                  {o.status === 'ready' && <button onClick={() => updateStatus(o.id, 'delivered')} className="px-3 py-1.5 rounded-lg bg-green-100 text-green-700 text-xs font-medium hover:bg-green-200">Mark Delivered</button>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

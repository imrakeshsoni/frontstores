// [bakery] [all tenants]
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { listBkProducts, listBkProduction, logBkProduction, getExpiringBkItems } from '@/lib/db/bakery';
import { now } from '@/lib/db/index';

export function ProductionPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    product_id: '', quantity: '', production_date: today, notes: '',
  });

  const { data: products = [] } = useQuery({
    queryKey: ['bk-products', tenantId, ''],
    queryFn: () => listBkProducts(tenantId),
    enabled: !!tenantId,
  });

  const { data: todayProduction = [] } = useQuery({
    queryKey: ['bk-production-today', tenantId, today],
    queryFn: () => listBkProduction(tenantId, today),
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  const { data: expiringItems = [] } = useQuery({
    queryKey: ['bk-expiring', tenantId],
    queryFn: () => getExpiringBkItems(tenantId, 4),
    enabled: !!tenantId,
    refetchInterval: 60000,
  });

  const selectedProduct = products.find(p => p.id === form.product_id);

  function calcExpiry(): string | null {
    if (!selectedProduct || !form.production_date) return null;
    const prodTime = new Date(form.production_date + 'T' + new Date().toTimeString().slice(0, 8));
    const expiry = new Date(prodTime.getTime() + selectedProduct.shelf_life_hours * 3600 * 1000);
    return expiry.toISOString().replace('T', ' ').slice(0, 19);
  }

  async function handleSave() {
    if (!form.product_id || !form.quantity) { toast.error('Select product and quantity'); return; }
    try {
      const product = products.find(p => p.id === form.product_id);
      if (!product) return;
      const expiryAt = calcExpiry();
      await logBkProduction(tenantId, {
        product_id: form.product_id,
        product_name: product.name,
        quantity: Number(form.quantity),
        production_date: now(),
        expiry_at: expiryAt,
        cost: product.production_cost * Number(form.quantity),
        notes: form.notes,
      });
      toast.success('Production logged');
      qc.invalidateQueries({ queryKey: ['bk-production-today'] });
      qc.invalidateQueries({ queryKey: ['bk-expiring'] });
      qc.invalidateQueries({ queryKey: ['bakery-stats'] });
      setForm({ product_id: '', quantity: '', production_date: today, notes: '' });
      setShowForm(false);
    } catch { toast.error('Failed to log'); }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Daily Production</h1>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: '#d97706' }}>
          <Plus className="h-4 w-4" /> Log Production
        </button>
      </div>

      {expiringItems.length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span className="font-semibold text-red-800 text-sm">Expiring in 4 hours</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {expiringItems.map(item => (
              <span key={item.id} className="text-xs bg-white border border-red-100 rounded-lg px-2 py-1 text-red-700">
                {item.product_name} ({item.quantity}) — {item.expiry_at ? new Date(item.expiry_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
              </span>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-slate-900">Log New Production Batch</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-500 block mb-1">Product *</label>
              <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}>
                <option value="">Select product</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Quantity *</label>
              <input type="number" step="0.5" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Estimated Expiry</label>
              <div className="flex items-center gap-2 h-10 px-3 rounded-lg border border-slate-100 bg-slate-50 text-sm text-slate-500">
                <Clock className="h-3.5 w-3.5" />
                {selectedProduct && form.production_date ? (
                  calcExpiry() ? new Date(calcExpiry()!).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
                ) : 'Select product'}
              </div>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-500 block mb-1">Notes</label>
              <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          {selectedProduct && (
            <div className="text-xs text-slate-400 bg-amber-50 rounded-lg px-3 py-2">
              Shelf life: {selectedProduct.shelf_life_hours}h · Cost: ₹{selectedProduct.production_cost}/{selectedProduct.unit}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={handleSave} className="px-5 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: '#d97706' }}>Log</button>
            <button onClick={() => setShowForm(false)} className="px-5 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Today's Production ({todayProduction.length} batches)</h2>
        <div className="space-y-2">
          {todayProduction.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">No production logged today</p>
          ) : todayProduction.map(p => (
            <div key={p.id} className="flex justify-between items-center text-sm border-b border-slate-50 pb-2 last:border-0">
              <div>
                <p className="font-medium text-slate-800">{p.product_name}</p>
                <p className="text-xs text-slate-400">{new Date(p.production_date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-700">{p.quantity} units</p>
                {p.expiry_at && (
                  <p className={`text-xs flex items-center gap-1 justify-end ${new Date(p.expiry_at) < new Date(Date.now() + 4 * 3600000) ? 'text-red-500' : 'text-slate-400'}`}>
                    <Clock className="h-3 w-3" />
                    Expires {new Date(p.expiry_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

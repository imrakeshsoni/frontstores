// [medical] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Boxes, Plus, X, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getBatches, saveBatch, updateBatch, deleteBatch, getExpiringBatches, type RxBatch } from '@/lib/db/pharmacy';
import { listProducts, type Product } from '@/lib/db/products';

function expiryStatus(expiryDate: string): 'expired' | 'warning' | 'ok' {
  const today = new Date();
  const exp = new Date(expiryDate);
  const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / 86400000);
  if (daysLeft <= 0) return 'expired';
  if (daysLeft <= 30) return 'warning';
  return 'ok';
}

const STATUS_COLORS = {
  expired: { bg: '#fee2e2', text: '#dc2626', border: '#fca5a5', label: 'Expired' },
  warning: { bg: '#fef3c7', text: '#d97706', border: '#fcd34d', label: 'Expiring Soon' },
  ok:      { bg: '#dcfce7', text: '#16a34a', border: '#86efac', label: 'OK' },
};

interface BatchForm {
  product_id: string;
  batch_no: string;
  expiry_date: string;
  mfg_date: string;
  quantity: number;
  purchase_price: number;
  selling_price: number;
  supplier_id: string;
}

const EMPTY_FORM: BatchForm = {
  product_id: '', batch_no: '', expiry_date: '', mfg_date: '',
  quantity: 0, purchase_price: 0, selling_price: 0, supplier_id: '',
};

export function BatchManagerPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<BatchForm>(EMPTY_FORM);
  const [filterProductId, setFilterProductId] = useState('');
  const [showExpiring, setShowExpiring] = useState(false);

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ['rx_batches', tenantId, filterProductId],
    queryFn: () => getBatches(tenantId, filterProductId || undefined),
    enabled: !!tenantId,
  });

  const { data: expiringBatches = [] } = useQuery({
    queryKey: ['rx_expiring', tenantId],
    queryFn: () => getExpiringBatches(tenantId, 30),
    enabled: !!tenantId,
  });

  const { data: productsData } = useQuery({
    queryKey: ['products', tenantId],
    queryFn: () => listProducts(tenantId, { perPage: 500 }),
    enabled: !!tenantId,
  });
  const products: Product[] = productsData?.items ?? [];

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!form.product_id || !form.batch_no || !form.expiry_date) throw new Error('Product, batch no, and expiry date are required');
      if (editId) {
        await updateBatch(tenantId, editId, { ...form, mfg_date: form.mfg_date || null });
      } else {
        await saveBatch(tenantId, { ...form, mfg_date: form.mfg_date || null });
      }
    },
    onSuccess: () => {
      toast.success(editId ? 'Batch updated' : 'Batch added');
      qc.invalidateQueries({ queryKey: ['rx_batches'] });
      qc.invalidateQueries({ queryKey: ['rx_expiring'] });
      setShowForm(false); setEditId(null); setForm(EMPTY_FORM);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteBatch(tenantId, id),
    onSuccess: () => {
      toast.success('Batch deleted');
      qc.invalidateQueries({ queryKey: ['rx_batches'] });
      qc.invalidateQueries({ queryKey: ['rx_expiring'] });
    },
  });

  function openEdit(b: RxBatch) {
    setEditId(b.id);
    setForm({ product_id: b.product_id, batch_no: b.batch_no, expiry_date: b.expiry_date,
      mfg_date: b.mfg_date ?? '', quantity: b.quantity, purchase_price: b.purchase_price,
      selling_price: b.selling_price, supplier_id: b.supplier_id });
    setShowForm(true);
  }

  const displayBatches = showExpiring ? expiringBatches : batches;

  // Group by product_id
  const grouped: Record<string, RxBatch[]> = {};
  for (const b of displayBatches) {
    if (!grouped[b.product_id]) grouped[b.product_id] = [];
    grouped[b.product_id].push(b);
  }

  const getProductName = (pid: string) => products.find(p => p.id === pid)?.name ?? pid;

  return (
    <div className="p-6 space-y-6" style={{ color: 'var(--text-primary)' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: '#dcfce7' }}>
            <Boxes className="h-5 w-5" style={{ color: '#16a34a' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold">Batch Manager</h1>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>FEFO — First Expiry First Out</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowExpiring(!showExpiring)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all"
            style={showExpiring
              ? { background: '#fef3c7', color: '#d97706', borderColor: '#fcd34d' }
              : { background: 'var(--surface)', color: 'var(--text-secondary)', borderColor: 'var(--surface-border)' }}
          >
            <AlertTriangle className="h-4 w-4" />
            Expiring ({expiringBatches.length})
          </button>
          <button
            onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY_FORM); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
            style={{ background: 'var(--accent)' }}
          >
            <Plus className="h-4 w-4" /> Add Batch
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-3">
        <select
          value={filterProductId}
          onChange={e => setFilterProductId(e.target.value)}
          className="px-3 py-2 rounded-xl text-sm border"
          style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)', minWidth: 220 }}
        >
          <option value="">All Products</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-4" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">{editId ? 'Edit Batch' : 'Add Batch'}</h2>
              <button onClick={() => setShowForm(false)}><X className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Product *</label>
                <select value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border text-sm"
                  style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}>
                  <option value="">Select product…</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {[
                { key: 'batch_no', label: 'Batch No *', type: 'text' },
                { key: 'expiry_date', label: 'Expiry Date *', type: 'date' },
                { key: 'mfg_date', label: 'Mfg Date', type: 'date' },
                { key: 'quantity', label: 'Qty', type: 'number' },
                { key: 'purchase_price', label: 'Purchase Price ₹', type: 'number' },
                { key: 'selling_price', label: 'Selling Price ₹', type: 'number' },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>{label}</label>
                  <input
                    type={type}
                    value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border text-sm"
                    style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Cancel</button>
              <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="px-5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: 'var(--accent)' }}>
                {saveMut.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch list grouped by product */}
      {isLoading ? (
        <div className="text-center py-12" style={{ color: 'var(--text-tertiary)' }}>Loading…</div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center py-16 rounded-2xl border-2 border-dashed" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-tertiary)' }}>
          <Boxes className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No batches yet</p>
          <p className="text-sm mt-1">Add your first batch to start tracking</p>
        </div>
      ) : (
        Object.entries(grouped).map(([pid, blist]) => (
          <div key={pid} className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--surface-border)' }}>
            <div className="px-4 py-3" style={{ background: 'var(--surface-2)' }}>
              <span className="font-semibold text-sm">{getProductName(pid)}</span>
              <span className="ml-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>{blist.length} batch(es)</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--surface-border)' }}>
                  {['Batch No', 'Expiry', 'Mfg Date', 'Qty', 'Purchase ₹', 'Sell ₹', 'Status', ''].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {blist.map(b => {
                  const status = expiryStatus(b.expiry_date);
                  const sc = STATUS_COLORS[status];
                  const fefo = blist[0]?.id === b.id;
                  return (
                    <tr key={b.id} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                      <td className="px-4 py-3 font-mono text-xs">
                        {fefo && <span className="mr-1 text-xs font-bold" style={{ color: '#16a34a' }}>★</span>}
                        {b.batch_no}
                      </td>
                      <td className="px-4 py-3">{b.expiry_date}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-tertiary)' }}>{b.mfg_date ?? '—'}</td>
                      <td className="px-4 py-3 font-semibold">{b.quantity}</td>
                      <td className="px-4 py-3">₹{b.purchase_price}</td>
                      <td className="px-4 py-3">₹{b.selling_price}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium w-fit"
                          style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
                          {status === 'ok' ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(b)} className="text-xs px-2 py-1 rounded-lg border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Edit</button>
                          <button onClick={() => { if (confirm('Delete this batch?')) delMut.mutate(b.id); }}
                            className="text-xs px-2 py-1 rounded-lg border" style={{ borderColor: '#fca5a5', color: '#dc2626' }}>Del</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}

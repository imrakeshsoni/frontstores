import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, ChevronRight, Package } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { listPOs, createPO, updatePOStatus, deletePO, getPOItems } from '@/lib/db/purchaseOrders';
import { listSuppliers } from '@/lib/db/suppliers';
import { listProducts } from '@/lib/db/products';
import { addStock } from '@/lib/db/inventory';
import { PageIntro } from '@/components/ui/PageIntro';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-800 text-slate-300',
  ordered: 'bg-blue-950 text-blue-300',
  received: 'bg-green-950 text-green-300',
  cancelled: 'bg-red-950 text-red-400',
};

export function PurchaseOrdersPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPO, setSelectedPO] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [deletePOTarget, setDeletePOTarget] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['purchase-orders', tenantId, statusFilter],
    queryFn: () => listPOs(tenantId, statusFilter !== 'all' ? { status: statusFilter } : {}),
    enabled: !!tenantId,
  });
  const { data: poItems } = useQuery({
    queryKey: ['po-items', selectedPO],
    queryFn: () => getPOItems(selectedPO!),
    enabled: !!selectedPO,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: any }) => updatePOStatus(tenantId, id, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchase-orders'] }); toast.success('Status updated'); },
  });

  const receiveMutation = useMutation({
    mutationFn: async (poId: string) => {
      const items = await getPOItems(poId);
      for (const item of items) {
        if (item.product_id && item.quantity > 0) {
          await addStock(tenantId, {
            product_id: item.product_id,
            quantity: item.quantity,
            batch_no: item.batch_no ?? undefined,
            expiry_date: item.expiry_date ?? undefined,
            type: 'purchase',
          });
        }
      }
      await updatePOStatus(tenantId, poId, 'received');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      toast.success('Stock received and added to inventory');
      setSelectedPO(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePO(tenantId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('Deleted');
      setDeletePOTarget(null);
      setSelectedPO(null);
    },
  });

  const pos = data?.items ?? [];
  const selectedPOData = pos.find(p => p.id === selectedPO);
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  return (
    <div className="page-shell page-stack">
      <PageIntro eyebrow="Procurement" title="Purchase Orders"
        description="Create POs for suppliers, receive stock directly into inventory."
        actions={
          <button className="btn-primary flex items-center gap-2" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> New PO
          </button>
        }
      />

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['all','draft','ordered','received','cancelled'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all capitalize ${statusFilter === s ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}>
            {s}
          </button>
        ))}
      </div>

      {/* PO List */}
      <div className="card p-0 overflow-hidden">
        {!pos.length ? (
          <div className="p-12 text-center text-slate-500">
            <Package size={40} className="mx-auto mb-3 opacity-30" />
            <p>No purchase orders yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                {['PO #','Supplier','Items','Total','Status',''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-slate-400 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pos.map(po => (
                <tr key={po.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer" onClick={() => setSelectedPO(po.id === selectedPO ? null : po.id)}>
                  <td className="px-4 py-3 font-mono text-slate-200">{po.po_number}</td>
                  <td className="px-4 py-3 text-slate-300">{po.supplier_name || '—'}</td>
                  <td className="px-4 py-3 text-slate-400">—</td>
                  <td className="px-4 py-3 font-semibold text-white">{fmt(po.total)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[po.status]}`}>{po.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <ChevronRight size={14} className={`text-slate-500 transition-transform ${selectedPO === po.id ? 'rotate-90' : ''}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* PO Detail */}
      {selectedPO && selectedPOData && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white">{selectedPOData.po_number}</h3>
              <p className="text-xs text-slate-400">{selectedPOData.supplier_name || 'No supplier'} · {new Date(selectedPOData.created_at).toLocaleDateString('en-IN')}</p>
            </div>
            <div className="flex gap-2">
              {selectedPOData.status === 'draft' && (
                <button onClick={() => updateStatus.mutate({ id: selectedPO, status: 'ordered' })} className="btn-primary text-xs px-3 py-1.5">Mark Ordered</button>
              )}
              {selectedPOData.status === 'ordered' && (
                <button onClick={() => receiveMutation.mutate(selectedPO)} disabled={receiveMutation.isPending} className="btn-primary text-xs px-3 py-1.5">
                  {receiveMutation.isPending ? 'Receiving…' : '✓ Receive Stock'}
                </button>
              )}
              {selectedPOData.status === 'draft' && (
                <button onClick={() => setDeletePOTarget(selectedPO)} className="btn-secondary text-xs px-3 py-1.5 text-red-400">Delete</button>
              )}
              <button onClick={() => setSelectedPO(null)} className="btn-secondary text-xs px-3 py-1.5"><X size={14} /></button>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-800">
              {['Product','Batch','Expiry','Qty','Price','Total'].map(h => <th key={h} className="text-left px-3 py-2 text-xs text-slate-400">{h}</th>)}
            </tr></thead>
            <tbody>
              {(poItems ?? []).map(item => (
                <tr key={item.id} className="border-b border-slate-800/50">
                  <td className="px-3 py-2 text-slate-200">{item.product_name}</td>
                  <td className="px-3 py-2 text-slate-400 font-mono text-xs">{item.batch_no || '—'}</td>
                  <td className="px-3 py-2 text-slate-400 text-xs">{item.expiry_date || '—'}</td>
                  <td className="px-3 py-2 text-slate-300">{item.quantity}</td>
                  <td className="px-3 py-2 text-slate-300">{fmt(item.unit_price)}</td>
                  <td className="px-3 py-2 font-semibold text-white">{fmt(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end gap-6 text-sm pt-2 border-t border-slate-800">
            <span className="text-slate-400">Subtotal: <span className="text-white">{fmt(selectedPOData.subtotal)}</span></span>
            <span className="text-slate-400">Tax: <span className="text-white">{fmt(selectedPOData.tax_total)}</span></span>
            <span className="text-slate-400">Total: <span className="text-white font-bold text-base">{fmt(selectedPOData.total)}</span></span>
          </div>
        </div>
      )}

      {showCreate && <CreatePOModal tenantId={tenantId} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['purchase-orders'] }); }} />}
      <ConfirmDialog
        open={!!deletePOTarget}
        title="Delete purchase order"
        message="Are you sure you want to delete this purchase order?"
        onCancel={() => setDeletePOTarget(null)}
        onConfirm={() => deletePOTarget && deleteMutation.mutate(deletePOTarget)}
      />
    </div>
  );
}

function CreatePOModal({ tenantId, onClose, onCreated }: { tenantId: string; onClose: () => void; onCreated: () => void }) {
  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<{ product_id: string; product_name: string; quantity: number; unit_price: number; gst_rate: number; batch_no: string; expiry_date: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: suppliers } = useQuery({ queryKey: ['suppliers', tenantId], queryFn: () => listSuppliers(tenantId), enabled: !!tenantId });
  const { data: products } = useQuery({
    queryKey: ['product-search', search, tenantId],
    queryFn: () => listProducts(tenantId, { search, perPage: 20 }),
    enabled: !!tenantId && search.length > 1,
  });

  function addItem(product: any) {
    if (items.find(i => i.product_id === product.id)) return;
    setItems(prev => [...prev, { product_id: product.id, product_name: product.name, quantity: 1, unit_price: product.cost_price ?? 0, gst_rate: product.gst_rate ?? 0, batch_no: '', expiry_date: '' }]);
    setSearch('');
  }
  function updateItem(idx: number, key: string, value: any) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [key]: value } : item));
  }
  function removeItem(idx: number) { setItems(prev => prev.filter((_, i) => i !== idx)); }

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const taxTotal = items.reduce((s, i) => s + i.quantity * i.unit_price * (i.gst_rate / 100), 0);

  async function handleSave() {
    if (!items.length) { toast.error('Add at least one product'); return; }
    setSaving(true);
    try {
      await createPO(tenantId, { supplier_id: supplierId || undefined, supplier_name: supplierName || undefined, notes: notes || undefined, items });
      toast.success('Purchase order created');
      onCreated();
    } catch (e: any) { toast.error(e?.message ?? 'Failed'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-slate-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-700 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white text-lg">New Purchase Order</h3>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Supplier</label>
            <select className="input w-full" value={supplierId} onChange={e => {
              setSupplierId(e.target.value);
              setSupplierName((suppliers?.items ?? []).find((s: any) => s.id === e.target.value)?.name ?? '');
            }}>
              <option value="">Select supplier</option>
              {(suppliers?.items ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Notes</label>
            <input className="input w-full" placeholder="Optional notes" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="relative">
          <label className="block text-xs text-slate-400 mb-1">Search & add products</label>
          <input className="input w-full" placeholder="Type medicine name…" value={search} onChange={e => setSearch(e.target.value)} />
          {search.length > 1 && (products?.items?.length ?? 0) > 0 && (
            <div className="absolute top-full left-0 right-0 z-10 bg-slate-800 border border-slate-700 rounded-xl mt-1 max-h-48 overflow-y-auto">
              {products!.items.map((p: any) => (
                <button key={p.id} onClick={() => addItem(p)} className="w-full text-left px-4 py-2.5 hover:bg-slate-700 text-sm text-slate-200 border-b border-slate-700/50 last:border-0">
                  <span className="font-medium">{p.name}</span>
                  {p.salt_composition && <span className="text-slate-400 text-xs ml-2">({p.salt_composition})</span>}
                  <span className="text-slate-500 text-xs ml-2">₹{p.cost_price ?? p.mrp}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-xs text-slate-400 px-1">
              <span className="col-span-3">Product</span><span className="col-span-2">Batch</span>
              <span className="col-span-2">Expiry</span><span className="col-span-1">Qty</span>
              <span className="col-span-2">Price</span><span className="col-span-1">GST%</span><span className="col-span-1"></span>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <span className="col-span-3 text-sm text-slate-200 truncate">{item.product_name}</span>
                <input className="input col-span-2 text-xs py-1.5" placeholder="Batch" value={item.batch_no} onChange={e => updateItem(idx, 'batch_no', e.target.value)} />
                <input className="input col-span-2 text-xs py-1.5" type="date" value={item.expiry_date} onChange={e => updateItem(idx, 'expiry_date', e.target.value)} />
                <input className="input col-span-1 text-xs py-1.5" type="number" min="1" value={item.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} />
                <input className="input col-span-2 text-xs py-1.5" type="number" min="0" step="0.01" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', Number(e.target.value))} />
                <input className="input col-span-1 text-xs py-1.5" type="number" min="0" value={item.gst_rate} onChange={e => updateItem(idx, 'gst_rate', Number(e.target.value))} />
                <button onClick={() => removeItem(idx)} className="col-span-1 text-red-400 hover:text-red-300"><X size={14} /></button>
              </div>
            ))}
            <div className="flex justify-end gap-6 text-sm pt-2 border-t border-slate-700">
              <span className="text-slate-400">Sub: <span className="text-white">₹{subtotal.toFixed(2)}</span></span>
              <span className="text-slate-400">Tax: <span className="text-white">₹{taxTotal.toFixed(2)}</span></span>
              <span className="text-slate-400 font-semibold">Total: <span className="text-white">₹{(subtotal + taxTotal).toFixed(2)}</span></span>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} disabled={saving || !items.length} className="btn-primary flex-1 disabled:opacity-40">
            {saving ? 'Creating…' : 'Create PO'}
          </button>
        </div>
      </div>
    </div>
  );
}

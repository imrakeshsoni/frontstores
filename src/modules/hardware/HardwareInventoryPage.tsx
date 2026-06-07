// [hardware] [all tenants]
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, AlertTriangle, ArrowDownCircle, ArrowUpCircle, Settings2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import {
  listHwProducts, listHwStockMovements, recordHwStockMovement, adjustHwStock,
  type HwProduct, type HwStockMovement,
} from '@/lib/db/hardware';
import { listSuppliers } from '@/lib/db/suppliers';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`; }

const REASON_META: Record<HwStockMovement['reason'], { label: string; color: string; icon: typeof ArrowDownCircle }> = {
  purchase: { label: 'Stock In (Purchase)', color: 'text-emerald-600', icon: ArrowDownCircle },
  sale: { label: 'Sale', color: 'text-red-500', icon: ArrowUpCircle },
  adjustment: { label: 'Adjustment', color: 'text-cyan-600', icon: Settings2 },
  return: { label: 'Return', color: 'text-violet-600', icon: RotateCcw },
};

type Tab = 'stock-in' | 'log' | 'reorder';

export function HardwareInventoryPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();

  const [tab, setTab] = useState<Tab>('stock-in');

  // Stock-in form
  const [productId, setProductId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [qty, setQty] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [productSearch, setProductSearch] = useState('');

  // Log filters
  const [filterReason, setFilterReason] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const { data: products = [] } = useQuery({
    queryKey: ['hw-products-all', tenantId],
    queryFn: () => listHwProducts(tenantId, {}),
    enabled: !!tenantId,
  });

  const { data: lowStockProducts = [] } = useQuery({
    queryKey: ['hw-products-lowstock', tenantId],
    queryFn: () => listHwProducts(tenantId, { lowStock: true }),
    enabled: !!tenantId,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['hw-suppliers-list', tenantId],
    queryFn: async () => (await listSuppliers(tenantId, { perPage: 200 })).items,
    enabled: !!tenantId,
  });

  const { data: movements = [] } = useQuery({
    queryKey: ['hw-stock-movements', tenantId, filterReason, filterFrom, filterTo],
    queryFn: () => listHwStockMovements(tenantId, {
      reason: filterReason || undefined,
      from: filterFrom ? `${filterFrom} 00:00:00` : undefined,
      to: filterTo ? `${filterTo} 23:59:59` : undefined,
    }),
    enabled: !!tenantId,
  });

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const q = productSearch.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q) || p.brand?.toLowerCase().includes(q));
  }, [products, productSearch]);

  const selectedProduct = products.find(p => p.id === productId);

  const stockIn = useMutation({
    mutationFn: async () => {
      if (!selectedProduct) throw new Error('Select a product');
      const q = parseFloat(qty);
      if (!q || q <= 0) throw new Error('Enter a valid quantity');
      const supplier = suppliers.find(s => s.id === supplierId);
      const note = [
        supplier ? `Supplier: ${supplier.name}` : '',
        costPrice ? `Cost: ₹${costPrice}/unit` : '',
        invoiceRef ? `Ref: ${invoiceRef}` : '',
      ].filter(Boolean).join(' · ');
      await adjustHwStock(tenantId, selectedProduct.id, q);
      await recordHwStockMovement(tenantId, {
        product_id: selectedProduct.id, product_name: selectedProduct.name, qty_delta: q,
        reason: 'purchase', reference_type: 'supplier', reference_id: supplierId || '', note,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hw-products'] });
      qc.invalidateQueries({ queryKey: ['hw-products-all'] });
      qc.invalidateQueries({ queryKey: ['hw-products-lowstock'] });
      qc.invalidateQueries({ queryKey: ['hw-stock-movements'] });
      qc.invalidateQueries({ queryKey: ['hw-stats'] });
      toast.success('Stock added');
      setProductId(''); setQty(''); setCostPrice(''); setInvoiceRef(''); setSupplierId(''); setProductSearch('');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to record stock-in'),
  });

  const TABS: { key: Tab; label: string }[] = [
    { key: 'stock-in', label: 'Stock In' },
    { key: 'log', label: 'Movement Log' },
    { key: 'reorder', label: `Reorder List${lowStockProducts.length ? ` (${lowStockProducts.length})` : ''}` },
  ];

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-xl font-bold text-slate-900">Inventory</h1>

      <div className="flex gap-2 bg-slate-100 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={tab === t.key ? { background: 'white', color: '#d97706', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' } : { color: '#64748b' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'stock-in' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4 max-w-2xl">
          <h2 className="font-semibold text-slate-900">Record Stock In (Purchase)</h2>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Product *</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={selectedProduct ? `${selectedProduct.name}${selectedProduct.variant ? ` · ${selectedProduct.variant}` : ''}` : productSearch}
                onChange={e => { setProductSearch(e.target.value); setProductId(''); }}
                placeholder="Search product by name, brand, barcode…"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none"
              />
            </div>
            {!selectedProduct && productSearch.trim() && (
              <div className="mt-1 max-h-48 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-50">
                {filteredProducts.slice(0, 20).map(p => (
                  <button key={p.id} onClick={() => { setProductId(p.id); setProductSearch(''); }} className="w-full text-left px-3 py-2 text-sm hover:bg-amber-50 flex justify-between">
                    <span>{p.name}{p.variant ? ` · ${p.variant}` : ''}{p.brand ? <span className="text-slate-400"> ({p.brand})</span> : ''}</span>
                    <span className="text-slate-400">{p.stock} {p.unit}</span>
                  </button>
                ))}
                {filteredProducts.length === 0 && <p className="px-3 py-2 text-sm text-slate-400">No matching products</p>}
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Quantity *</label>
              <input type="number" value={qty} onChange={e => setQty(e.target.value)} step="0.01" placeholder="0" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Cost Price / unit (₹)</label>
              <input type="number" value={costPrice} onChange={e => setCostPrice(e.target.value)} placeholder="0" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Invoice / Challan Ref</label>
              <input value={invoiceRef} onChange={e => setInvoiceRef(e.target.value)} placeholder="e.g. INV-2451" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Supplier</label>
            <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none">
              <option value="">— None —</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <button
            onClick={() => stockIn.mutate()}
            disabled={!selectedProduct || !qty || stockIn.isPending}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: '#d97706' }}
          >
            {stockIn.isPending ? 'Saving…' : 'Record Stock In'}
          </button>
        </div>
      )}

      {tab === 'log' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <select value={filterReason} onChange={e => setFilterReason(e.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none">
              <option value="">All Reasons</option>
              {Object.entries(REASON_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
            </select>
            <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none" />
            <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none" />
          </div>
          {movements.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <p className="text-4xl mb-2">📦</p>
              <p>No stock movements recorded</p>
            </div>
          ) : (
            <div className="space-y-2">
              {movements.map(m => {
                const meta = REASON_META[m.reason] ?? REASON_META.adjustment;
                const Icon = meta.icon;
                return (
                  <div key={m.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center gap-4">
                    <Icon className={`h-5 w-5 shrink-0 ${meta.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900">{m.product_name}</p>
                      <p className="text-xs text-slate-400">{meta.label}{m.note ? ` · ${m.note}` : ''}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${m.qty_delta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {m.qty_delta >= 0 ? '+' : ''}{m.qty_delta}
                      </p>
                      <p className="text-xs text-slate-400">{m.created_at?.slice(0, 16).replace('T', ' ')}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'reorder' && (
        lowStockProducts.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-4xl mb-2">✅</p>
            <p>Nothing to reorder — all stock levels are healthy</p>
          </div>
        ) : (
          <div className="space-y-2">
            {lowStockProducts.map(p => {
              const reorderQty = Math.max(0, p.min_stock - p.stock);
              return (
                <div key={p.id} className="bg-white rounded-xl border border-orange-200 shadow-sm p-4 flex items-center gap-4">
                  <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900">{p.name}{p.variant ? ` · ${p.variant}` : ''}</p>
                    <p className="text-xs text-slate-400">{p.category}{p.brand ? ` · ${p.brand}` : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-orange-600">{p.stock} / {p.min_stock} {p.unit}</p>
                    <p className="text-xs text-slate-400">suggest reorder: {reorderQty} {p.unit}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">cost</p>
                    <p className="text-sm font-semibold text-slate-700">{fmt(p.purchase_price)}</p>
                  </div>
                  <button
                    onClick={() => { setTab('stock-in'); setProductId(p.id); setProductSearch(''); setQty(String(reorderQty || '')); }}
                    className="px-3 py-2 rounded-lg text-xs font-semibold text-white"
                    style={{ background: '#d97706' }}
                  >
                    Stock In
                  </button>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

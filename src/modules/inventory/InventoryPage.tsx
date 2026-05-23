import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Boxes, Clock, Plus, RotateCcw, Upload } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { listProducts } from '@/lib/db/products';
import { listSuppliers } from '@/lib/db/suppliers';
import { adjustStock, addStock, getExpiryAlerts } from '@/lib/db/inventory';
import { getDb } from '@/lib/db/index';
import { PageIntro } from '@/components/ui/PageIntro';
import { EmptyState } from '@/components/ui/EmptyState';
import { isMedicalShopType, useActiveShopType } from '@/lib/shop/shopType';

type InventoryNavigationState = {
  openAdjustStock?: boolean;
  productId?: string;
  productName?: string;
  direction?: 'add' | 'remove';
  type?: string;
};

export function InventoryPage() {
  const today = new Date().toISOString().slice(0, 10);
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const activeShopType = useActiveShopType();
  const isMedicalStore = isMedicalShopType(activeShopType);
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdjust, setShowAdjust] = useState(false);
  const [showExpiryWatch, setShowExpiryWatch] = useState(false);
  const [productSearchInput, setProductSearchInput] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [adjustment, setAdjustment] = useState({
    productId: '', quantity: '1', direction: 'add', type: 'adjustment',
    supplierId: '', invoiceNumber: '', batchNo: '', expiryDate: '', notes: '',
  });
  const navigationState = (location.state ?? null) as InventoryNavigationState | null;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProductDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!navigationState?.openAdjustStock || !navigationState.productId) return;
    setAdjustment((c) => ({
      ...c,
      productId: navigationState.productId ?? '',
      direction: navigationState.direction ?? 'add',
      type: navigationState.type ?? 'purchase',
      quantity: '1',
    }));
    setProductSearchInput(navigationState.productName ?? '');
    setShowProductDropdown(false);
    setShowAdjust(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, navigate, navigationState]);

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['inventory', tenantId, searchQuery],
    queryFn: () => listProducts(tenantId, { search: searchQuery, perPage: 200 }),
    enabled: !!tenantId,
  });

  const { data: allProducts } = useQuery({
    queryKey: ['inventory-products', tenantId],
    queryFn: () => listProducts(tenantId, { perPage: 300 }),
    enabled: !!tenantId && showAdjust,
  });

  const { data: suppliers } = useQuery({
    queryKey: ['inventory-suppliers', tenantId],
    queryFn: () => listSuppliers(tenantId, { perPage: 200 }),
    enabled: !!tenantId && showAdjust && isMedicalStore,
  });

  const { data: expiryAlerts } = useQuery({
    queryKey: ['expiry-alerts', tenantId],
    queryFn: () => getExpiryAlerts(tenantId, 120),
    enabled: !!tenantId && showExpiryWatch,
  });

  const filteredAdjustProducts = useMemo(() => {
    const items = allProducts?.items ?? [];
    if (!productSearchInput) return items;
    const q = productSearchInput.toLowerCase();
    return items.filter((p) => p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q) || (p.barcode ?? '').toLowerCase().includes(q));
  }, [allProducts, productSearchInput]);

  const resetAdjustment = () => {
    setAdjustment({ productId: '', quantity: '1', direction: 'add', type: 'adjustment', supplierId: '', invoiceNumber: '', batchNo: '', expiryDate: '', notes: '' });
    setProductSearchInput('');
  };

  const adjustMutation = useMutation({
    mutationFn: async () => {
      const qty = Number(adjustment.quantity || 0);
      if (!adjustment.productId || qty <= 0) throw new Error('Select a product and quantity');
      if (adjustment.direction === 'add' && (adjustment.type === 'purchase' || isMedicalStore)) {
        await addStock(tenantId, {
          product_id: adjustment.productId,
          quantity: qty,
          batch_no: adjustment.batchNo || undefined,
          expiry_date: adjustment.expiryDate || undefined,
          supplier_id: adjustment.supplierId || undefined,
          invoice_number: adjustment.invoiceNumber || undefined,
          notes: adjustment.notes || undefined,
          type: adjustment.type,
        });
      } else {
        await adjustStock(tenantId, {
          product_id: adjustment.productId,
          quantity: qty,
          direction: adjustment.direction as 'add' | 'remove',
          type: adjustment.type,
          invoice_number: adjustment.invoiceNumber || undefined,
          notes: adjustment.notes || undefined,
        });
      }
    },
    onSuccess: () => {
      toast.success('Inventory updated');
      setShowAdjust(false);
      resetAdjustment();
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['product-search'] });
      queryClient.invalidateQueries({ queryKey: ['pos-top-products'] });
      queryClient.invalidateQueries({ queryKey: ['low-stock'] });
    },
    onError: (err: any) => toast.error(err.message ?? 'Unable to adjust stock'),
  });

  const returnExpiredMutation = useMutation({
    mutationFn: async (alert: any) => {
      await adjustStock(tenantId, {
        product_id: alert.product_id,
        quantity: Number(alert.quantity ?? 0),
        direction: 'remove',
        type: 'write-off',
        notes: `Expired batch ${alert.batch_no ?? ''} returned`,
      });
    },
    onSuccess: () => {
      toast.success('Expired stock removed');
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['expiry-alerts'] });
    },
    onError: (err: any) => toast.error(err.message ?? 'Unable to process return'),
  });

  const inventoryItems = productsData?.items ?? [];
  const selectedProduct = allProducts?.items.find((p) => p.id === adjustment.productId);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="page-shell page-stack">
      <PageIntro
        eyebrow="Inventory"
        title="Stock that stays in control."
        description="Add stock, adjust quantities, and track expiry dates."
        actions={
          <div className="flex gap-2">
            {isMedicalStore && (
              <button className="btn-secondary" onClick={() => setShowExpiryWatch(true)}>
                <Clock className="h-4 w-4" />
                Expiry Watch
              </button>
            )}
            <button className="btn-primary" onClick={() => { resetAdjustment(); setShowAdjust(true); }}>
              <Plus className="h-4 w-4" />
              Adjust Stock
            </button>
          </div>
        }
      />

      <div className="card p-5">
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search products…"
          className="input max-w-md"
        />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Unit</th>
                <th className="text-right">Stock</th>
                <th className="text-right">Min Stock</th>
                <th className="text-right">MRP</th>
                <th className="text-right">Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 7 }).map((_, j) => (
                  <td key={j}><div className="h-4 rounded bg-slate-200 animate-pulse" /></td>
                ))}</tr>
              ))}
              {!isLoading && inventoryItems.length === 0 && (
                <tr><td colSpan={7} className="p-0">
                  <EmptyState icon={<Boxes className="h-8 w-8" />} title="No inventory yet"
                    description="Add your first products and stock up." />
                </td></tr>
              )}
              {inventoryItems.map((p) => {
                const isLow = p.stock_qty <= p.min_stock_qty;
                return (
                  <tr key={p.id}>
                    <td>
                      <p className="font-semibold text-slate-950">{p.name}</p>
                      {p.dosage_form && <p className="text-xs font-medium text-emerald-700">{p.dosage_form}</p>}
                    </td>
                    <td className="text-slate-500">{p.unit}</td>
                    <td className="text-right font-semibold">{p.stock_qty}</td>
                    <td className="text-right text-slate-500">{p.min_stock_qty}</td>
                    <td className="text-right">{formatCurrency(p.mrp)}</td>
                    <td className="text-right">
                      {isLow
                        ? <span className="badge badge-red flex items-center gap-1 justify-end"><AlertTriangle className="h-3 w-3" /> Low</span>
                        : <span className="badge badge-green">OK</span>
                      }
                    </td>
                    <td className="text-right">
                      <button
                        className="rounded-full bg-blue-50 p-2 text-blue-600 hover:bg-blue-100"
                        onClick={() => {
                          setAdjustment((c) => ({ ...c, productId: p.id, direction: 'add', type: 'purchase' }));
                          setProductSearchInput(p.name);
                          setShowAdjust(true);
                        }}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjust Stock Modal */}
      {showAdjust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="card-strong flex max-h-[90vh] w-full max-w-xl flex-col rounded-[2rem] p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl">Adjust Stock</h2>
              <button className="btn-secondary" onClick={() => setShowAdjust(false)}>Close</button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto space-y-4">
              {/* Product search */}
              <div ref={dropdownRef} className="relative">
                <label className="mb-2 block text-sm font-medium text-slate-700">Product *</label>
                <input
                  className="input"
                  value={productSearchInput}
                  onChange={(e) => { setProductSearchInput(e.target.value); setShowProductDropdown(true); setAdjustment((c) => ({ ...c, productId: '' })); }}
                  onFocus={() => setShowProductDropdown(true)}
                  placeholder="Type to search products…"
                />
                {showProductDropdown && filteredAdjustProducts.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                    {filteredAdjustProducts.slice(0, 20).map((p) => (
                      <button key={p.id} className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50"
                        onClick={() => { setAdjustment((c) => ({ ...c, productId: p.id })); setProductSearchInput(p.name); setShowProductDropdown(false); }}>
                        <span className="font-medium">{p.name}</span>
                        <span className="ml-2 text-slate-400">({p.stock_qty} in stock)</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Direction</label>
                  <select className="input" value={adjustment.direction} onChange={(e) => setAdjustment((c) => ({ ...c, direction: e.target.value }))}>
                    <option value="add">Add Stock</option>
                    <option value="remove">Remove Stock</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Type</label>
                  <select className="input" value={adjustment.type} onChange={(e) => setAdjustment((c) => ({ ...c, type: e.target.value }))}>
                    {adjustment.direction === 'add'
                      ? <>
                          <option value="purchase">Purchase</option>
                          <option value="return">Customer Return</option>
                          <option value="adjustment">Manual Adjustment</option>
                        </>
                      : <>
                          <option value="adjustment">Manual Adjustment</option>
                          <option value="write-off">Write-off</option>
                          <option value="return">Return to Supplier</option>
                        </>
                    }
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Quantity *</label>
                <input type="number" min="0.01" step="any" className="input" value={adjustment.quantity}
                  onChange={(e) => setAdjustment((c) => ({ ...c, quantity: e.target.value }))} />
                {selectedProduct && (
                  <p className="mt-1 text-xs text-slate-500">Current stock: {selectedProduct.stock_qty} {selectedProduct.unit}</p>
                )}
              </div>

              {isMedicalStore && adjustment.direction === 'add' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Batch No</label>
                      <input className="input" value={adjustment.batchNo} onChange={(e) => setAdjustment((c) => ({ ...c, batchNo: e.target.value }))} />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Expiry Date</label>
                      <input type="date" className="input" value={adjustment.expiryDate} onChange={(e) => setAdjustment((c) => ({ ...c, expiryDate: e.target.value }))} />
                    </div>
                  </div>
                  {suppliers?.items && (
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Supplier</label>
                      <select className="input" value={adjustment.supplierId} onChange={(e) => setAdjustment((c) => ({ ...c, supplierId: e.target.value }))}>
                        <option value="">No supplier</option>
                        {suppliers.items.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Invoice Number</label>
                <input className="input" value={adjustment.invoiceNumber} onChange={(e) => setAdjustment((c) => ({ ...c, invoiceNumber: e.target.value }))} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Notes</label>
                <input className="input" value={adjustment.notes} onChange={(e) => setAdjustment((c) => ({ ...c, notes: e.target.value }))} />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setShowAdjust(false)}>Cancel</button>
              <button className="btn-primary" onClick={() => adjustMutation.mutate()} disabled={adjustMutation.isPending || !adjustment.productId}>
                {adjustMutation.isPending ? 'Saving…' : 'Update Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expiry Watch Modal */}
      {showExpiryWatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="card-strong flex max-h-[90vh] w-full max-w-2xl flex-col rounded-[2rem] p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="section-label">Expiry Watch</p>
                <h2 className="mt-2">Batches expiring within 120 days</h2>
              </div>
              <button className="btn-secondary" onClick={() => setShowExpiryWatch(false)}>Close</button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto space-y-2">
              {(expiryAlerts ?? []).length === 0 && (
                <p className="text-sm text-emerald-600">No batches expiring within 120 days</p>
              )}
              {(expiryAlerts ?? []).map((a: any) => (
                <div key={a.id} className="card-strong flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="font-semibold text-slate-950">{a.product_name}</p>
                    <p className="text-xs text-slate-500">Batch: {a.batch_no ?? '—'} · Exp: {a.expiry_date ?? '—'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="badge badge-red">{a.quantity} units</span>
                    <button className="btn-secondary text-xs px-3 py-1"
                      onClick={() => returnExpiredMutation.mutate(a)}
                      disabled={returnExpiredMutation.isPending}>
                      Return / Write-off
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

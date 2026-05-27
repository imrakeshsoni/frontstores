// [grocery] [all tenants] — quick multi-product purchase entry (stock-in)
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, Plus, Trash2, ShoppingBag, CheckCircle } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listProducts } from '@/lib/db/products';
import { addStock } from '@/lib/db/inventory';

interface PurchaseLine {
  productId: string;
  productName: string;
  unit: string;
  quantity: string;
  costPrice: string;
}

function emptyLine(productId: string, productName: string, unit: string, costPrice?: number | null): PurchaseLine {
  return { productId, productName, unit, quantity: '', costPrice: costPrice ? String(costPrice) : '' };
}

export function PurchasePage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [lines, setLines] = useState<PurchaseLine[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const trimmed = search.trim();
  const { data: searchResults = [] } = useQuery({
    queryKey: ['purchase-product-search', trimmed, tenantId],
    queryFn: () => listProducts(tenantId, { search: trimmed, perPage: 10 }).then((r) => r.items),
    enabled: trimmed.length > 1 && !!tenantId,
  });

  const addLine = (product: { id: string; name: string; unit: string; cost_price?: number | null }) => {
    const already = lines.find((l) => l.productId === product.id);
    if (already) {
      toast.info(`${product.name} already in list`);
      setSearch('');
      setShowDropdown(false);
      return;
    }
    setLines((prev) => [...prev, emptyLine(product.id, product.name, product.unit, product.cost_price)]);
    setSearch('');
    setShowDropdown(false);
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  const updateLine = (idx: number, field: 'quantity' | 'costPrice', value: string) => {
    setLines((prev) => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const validLines = lines.filter((l) => l.productId && Number(l.quantity) > 0);
      if (validLines.length === 0) throw new Error('Add at least one product with quantity');
      for (const line of validLines) {
        await addStock(tenantId, {
          product_id: line.productId,
          quantity: Number(line.quantity),
          cost_price: line.costPrice ? Number(line.costPrice) : undefined,
          invoice_number: invoiceNumber || undefined,
          notes: supplierName ? `Supplier: ${supplierName}` : undefined,
          type: 'purchase',
        });
      }
    },
    onSuccess: () => {
      toast.success('Purchase saved — stock updated');
      setLines([]);
      setInvoiceNumber('');
      setSupplierName('');
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['grocery-low-stock'] });
      qc.invalidateQueries({ queryKey: ['low-stock'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to save'),
  });

  const totalItems = lines.length;
  const totalCost = lines.reduce((s, l) => {
    const qty = Number(l.quantity) || 0;
    const cost = Number(l.costPrice) || 0;
    return s + qty * cost;
  }, 0);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>Inventory</p>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Purchase Entry</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Quickly add stock for multiple products at once</p>
      </div>

      {/* Meta */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Invoice / Bill Number</label>
            <input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="e.g. INV-2025-001"
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
              style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Supplier Name</label>
            <input
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="e.g. Sharma Wholesale"
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
              style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }}
            />
          </div>
        </div>
      </div>

      {/* Product search */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Add Products</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            placeholder="Search product by name or barcode…"
            className="w-full rounded-xl border pl-10 pr-3 py-2.5 text-sm outline-none focus:ring-2"
            style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }}
          />
          {showDropdown && searchResults.length > 0 && (
            <div className="absolute z-20 mt-1 w-full rounded-xl shadow-xl overflow-hidden"
              style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
              {searchResults.map((p) => (
                <button
                  key={p.id}
                  onMouseDown={() => addLine(p)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-left hover:bg-slate-50 transition-colors"
                >
                  <div>
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{p.unit} · Stock: {p.stock_qty}</p>
                  </div>
                  <Plus className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--accent)' }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Lines table */}
        {lines.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--surface-border)' }}>
                  <th className="text-left py-2 font-medium" style={{ color: 'var(--text-tertiary)' }}>Product</th>
                  <th className="text-center py-2 font-medium w-28" style={{ color: 'var(--text-tertiary)' }}>Qty</th>
                  <th className="text-center py-2 font-medium w-32" style={{ color: 'var(--text-tertiary)' }}>Cost Price (₹)</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={line.productId} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                    <td className="py-2.5 pr-3">
                      <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{line.productName}</p>
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{line.unit}</p>
                    </td>
                    <td className="py-2.5 px-2">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={line.quantity}
                        onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                        placeholder="0"
                        className="w-full text-center rounded-lg border px-2 py-1.5 text-sm outline-none focus:ring-2"
                        style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }}
                      />
                    </td>
                    <td className="py-2.5 px-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.costPrice}
                        onChange={(e) => updateLine(idx, 'costPrice', e.target.value)}
                        placeholder="0.00"
                        className="w-full text-center rounded-lg border px-2 py-1.5 text-sm outline-none focus:ring-2"
                        style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }}
                      />
                    </td>
                    <td className="py-2.5 pl-2">
                      <button onClick={() => removeLine(idx)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {lines.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 gap-2" style={{ color: 'var(--text-tertiary)' }}>
            <ShoppingBag className="h-8 w-8 opacity-40" />
            <p className="text-sm">Search and add products above</p>
          </div>
        )}
      </div>

      {/* Summary + save */}
      {lines.length > 0 && (
        <div className="rounded-2xl p-5 flex items-center justify-between gap-4"
          style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{totalItems} products</span>
            {totalCost > 0 && <span className="ml-3">Total cost: <span className="font-semibold" style={{ color: 'var(--accent)' }}>₹{totalCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></span>}
          </div>
          <div className="flex items-center gap-3">
            {submitted && (
              <div className="flex items-center gap-1.5 text-sm font-medium" style={{ color: '#16a34a' }}>
                <CheckCircle className="h-4 w-4" /> Saved!
              </div>
            )}
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || lines.every((l) => !Number(l.quantity))}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition-opacity disabled:opacity-60"
              style={{ background: 'var(--accent)' }}
            >
              {saveMutation.isPending ? 'Saving…' : 'Save Purchase'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

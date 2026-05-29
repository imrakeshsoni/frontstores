// [medical] [all tenants]
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FlaskConical, Search } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listProducts, type Product } from '@/lib/db/products';

export function SaltSearchPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Simple debounce via state
  function handleSearch(val: string) {
    setSearch(val);
    clearTimeout((window as any).__saltSearchTimer);
    (window as any).__saltSearchTimer = setTimeout(() => setDebouncedSearch(val), 300);
  }

  const { data, isLoading } = useQuery({
    queryKey: ['salt_search', tenantId, debouncedSearch],
    queryFn: () => listProducts(tenantId, { search: debouncedSearch, perPage: 100 }),
    enabled: !!tenantId && debouncedSearch.length >= 2,
  });

  const products: Product[] = data?.items ?? [];

  // Highlight matching salt
  function highlight(text: string | null, q: string) {
    if (!text || !q) return text ?? '—';
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return (
      text.slice(0, idx) +
      `<mark style="background:#fef3c7;color:#d97706;border-radius:3px;padding:0 2px">${text.slice(idx, idx + q.length)}</mark>` +
      text.slice(idx + q.length)
    );
  }

  return (
    <div className="p-6 space-y-6" style={{ color: 'var(--text-primary)' }}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: '#cffafe' }}>
          <FlaskConical className="h-5 w-5" style={{ color: '#0891b2' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold">Salt / Composition Search</h1>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Find medicines by salt or composition name</p>
        </div>
      </div>

      {/* Search box */}
      <div className="relative max-w-lg">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5" style={{ color: 'var(--text-tertiary)' }} />
        <input
          value={search}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Type salt name e.g. Amoxicillin, Paracetamol, Metformin…"
          className="w-full pl-11 pr-4 py-3 rounded-2xl border text-sm"
          style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}
          autoFocus
        />
      </div>

      {debouncedSearch.length < 2 && (
        <div className="text-center py-16 rounded-2xl border-2 border-dashed" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-tertiary)' }}>
          <FlaskConical className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium text-base">Enter at least 2 characters to search</p>
          <p className="text-sm mt-1">Searches product name, salt composition, and manufacturer</p>
        </div>
      )}

      {debouncedSearch.length >= 2 && isLoading && (
        <div className="text-center py-12" style={{ color: 'var(--text-tertiary)' }}>Searching…</div>
      )}

      {debouncedSearch.length >= 2 && !isLoading && products.length === 0 && (
        <div className="text-center py-12 rounded-2xl border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-tertiary)' }}>
          <p className="font-medium">No products found for "{debouncedSearch}"</p>
          <p className="text-sm mt-1">Try a different salt or generic name</p>
        </div>
      )}

      {products.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{products.length} result(s)</p>
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--surface-border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--surface-border)', background: 'var(--surface-2)' }}>
                  {['Product Name', 'Salt / Composition', 'Manufacturer', 'Category', 'MRP ₹', 'Stock', 'Rx'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                    <td className="px-4 py-3">
                      <span className="font-medium" dangerouslySetInnerHTML={{ __html: highlight(p.name, debouncedSearch) }} />
                      {p.dosage_form && <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full" style={{ background: '#f1f5f9', color: '#64748b' }}>{p.dosage_form}</span>}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      <span dangerouslySetInnerHTML={{ __html: highlight(p.salt_composition, debouncedSearch) }} />
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      <span dangerouslySetInnerHTML={{ __html: highlight(p.manufacturer, debouncedSearch) }} />
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>{p.category ?? '—'}</td>
                    <td className="px-4 py-3 font-semibold">₹{p.mrp}</td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${p.stock_qty <= p.min_stock_qty ? 'text-red-500' : ''}`}>{p.stock_qty}</span>
                    </td>
                    <td className="px-4 py-3">
                      {p.requires_prescription
                        ? <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: '#fee2e2', color: '#dc2626' }}>Rx</span>
                        : <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: '#dcfce7', color: '#16a34a' }}>OTC</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

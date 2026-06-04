// [tyrescrap] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { Scale } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getStockSummary, TYRE_TYPE_LABELS, TYRE_CATEGORY_LABELS } from '@/lib/db/tyrescrap';

export function TyreStockPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');

  const { data: stock = [] } = useQuery({
    queryKey: ['tyre-stock', tenantId],
    queryFn:  () => getStockSummary(tenantId),
    enabled:  !!tenantId,
    refetchInterval: 30000,
  });

  const totalStockKg = stock.reduce((s, r) => s + r.stock_kg, 0);
  const totalBoughtKg = stock.reduce((s, r) => s + r.purchased_kg, 0);
  const totalSoldKg = stock.reduce((s, r) => s + r.sold_kg, 0);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#f3e8ff' }}>
          <Scale size={20} style={{ color: '#9333ea' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Stock — Current Inventory</h1>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Computed from purchases minus sales</p>
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Purchased', value: `${totalBoughtKg.toFixed(0)} kg`, color: '#16a34a', bg: '#dcfce7' },
          { label: 'Total Sold', value: `${totalSoldKg.toFixed(0)} kg`, color: '#2563eb', bg: '#dbeafe' },
          { label: 'Stock on Hand', value: `${totalStockKg.toFixed(0)} kg`, color: '#9333ea', bg: '#f3e8ff' },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl p-4 border" style={{ background: s.bg, borderColor: 'transparent' }}>
            <div className="text-xs font-medium mb-1" style={{ color: s.color, opacity: 0.8 }}>{s.label}</div>
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Stock breakdown */}
      {stock.length === 0 ? (
        <div className="text-center py-16" style={{ color: 'var(--text-tertiary)' }}>
          No stock data yet — add some purchases first
        </div>
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--surface-hover)' }}>
                {['Tyre Type', 'Category', 'Purchased (kg)', 'Sold (kg)', 'Stock (kg)', 'Purchased (pcs)', 'Sold (pcs)', 'Stock (pcs)'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stock.map((row, i) => (
                <tr key={i} className="border-t" style={{ borderColor: 'var(--border)' }}>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                    {TYRE_TYPE_LABELS[row.tyre_type as keyof typeof TYRE_TYPE_LABELS] ?? row.tyre_type}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                    {TYRE_CATEGORY_LABELS[row.category as keyof typeof TYRE_CATEGORY_LABELS] ?? row.category}
                  </td>
                  <td className="px-4 py-3" style={{ color: '#16a34a' }}>{row.purchased_kg.toFixed(1)}</td>
                  <td className="px-4 py-3" style={{ color: '#2563eb' }}>{row.sold_kg.toFixed(1)}</td>
                  <td className="px-4 py-3 font-bold" style={{ color: row.stock_kg > 0 ? '#9333ea' : '#6b7280' }}>
                    {row.stock_kg.toFixed(1)}
                  </td>
                  <td className="px-4 py-3" style={{ color: '#16a34a' }}>{row.purchased_pieces}</td>
                  <td className="px-4 py-3" style={{ color: '#2563eb' }}>{row.sold_pieces}</td>
                  <td className="px-4 py-3 font-bold" style={{ color: row.stock_pieces > 0 ? '#9333ea' : '#6b7280' }}>
                    {row.stock_pieces}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

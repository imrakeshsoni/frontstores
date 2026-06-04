// [tyrescrap] [all tenants]
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/app/store/app.store';
import { listPurchases, listSales, listExpenses, TYRE_TYPE_LABELS, TYRE_CATEGORY_LABELS } from '@/lib/db/tyrescrap';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }
function fmtKg(n: number) { return `${n.toLocaleString('en-IN', { maximumFractionDigits: 1 })} kg`; }

function thisMonthRange() {
  const now = new Date();
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const to   = now.toISOString().slice(0, 10);
  return { from, to };
}

export function TyreReportsPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const def = thisMonthRange();
  const [from, setFrom] = useState(def.from);
  const [to, setTo]     = useState(def.to);

  const { data: purchases = [] } = useQuery({
    queryKey: ['tyre-purchases', tenantId, from, to],
    queryFn:  () => listPurchases(tenantId, { from, to }),
    enabled:  !!tenantId,
  });
  const { data: sales = [] } = useQuery({
    queryKey: ['tyre-sales', tenantId, from, to],
    queryFn:  () => listSales(tenantId, { from, to }),
    enabled:  !!tenantId,
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ['tyre-expenses', tenantId, from, to],
    queryFn:  () => listExpenses(tenantId, { from, to }),
    enabled:  !!tenantId,
  });

  const totalPurchased = purchases.reduce((s, p) => s + p.total_amount, 0);
  const totalSold      = sales.reduce((s, p) => s + p.total_amount, 0);
  const totalExpenses  = expenses.reduce((s, p) => s + p.amount, 0);
  const profit         = totalSold - totalPurchased - totalExpenses;
  const purchasedKg    = purchases.reduce((s, p) => s + p.weight_kg, 0);
  const soldKg         = sales.reduce((s, p) => s + p.weight_kg, 0);

  // Group purchases by tyre type
  const byType = new Map<string, { purchasedKg: number; soldKg: number; purchasedAmt: number; soldAmt: number }>();
  for (const p of purchases) {
    const r = byType.get(p.tyre_type) ?? { purchasedKg: 0, soldKg: 0, purchasedAmt: 0, soldAmt: 0 };
    r.purchasedKg  += p.weight_kg;
    r.purchasedAmt += p.total_amount;
    byType.set(p.tyre_type, r);
  }
  for (const s of sales) {
    const r = byType.get(s.tyre_type) ?? { purchasedKg: 0, soldKg: 0, purchasedAmt: 0, soldAmt: 0 };
    r.soldKg  += s.weight_kg;
    r.soldAmt += s.total_amount;
    byType.set(s.tyre_type, r);
  }

  // Group expenses by category
  const expByCategory = new Map<string, number>();
  for (const e of expenses) {
    expByCategory.set(e.category, (expByCategory.get(e.category) ?? 0) + e.amount);
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Reports</h1>
        <div className="flex gap-3 items-center flex-wrap mt-3">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm border" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm border" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
        </div>
      </div>

      {/* P&L summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Purchased', value: fmt(totalPurchased), sub: fmtKg(purchasedKg), color: '#ca8a04', bg: '#fef9c3' },
          { label: 'Total Sales',     value: fmt(totalSold),      sub: fmtKg(soldKg),       color: '#2563eb', bg: '#dbeafe' },
          { label: 'Total Expenses',  value: fmt(totalExpenses),  sub: `${expenses.length} entries`, color: '#dc2626', bg: '#fee2e2' },
          { label: 'Net Profit',      value: fmt(profit),         sub: 'Sales − Purchases − Expenses',
            color: profit >= 0 ? '#16a34a' : '#dc2626', bg: profit >= 0 ? '#dcfce7' : '#fee2e2' },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border p-4" style={{ background: c.bg, borderColor: 'transparent' }}>
            <div className="text-xs font-medium mb-1" style={{ color: c.color, opacity: 0.8 }}>{c.label}</div>
            <div className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</div>
            <div className="text-xs mt-0.5" style={{ color: c.color, opacity: 0.7 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* By tyre type */}
      {byType.size > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>BY TYRE TYPE</h2>
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--surface-hover)' }}>
                  {['Tyre Type', 'Purchased (₹)', 'Purchased (kg)', 'Sold (₹)', 'Sold (kg)'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from(byType.entries()).map(([type, r]) => (
                  <tr key={type} className="border-t" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                      {TYRE_TYPE_LABELS[type as keyof typeof TYRE_TYPE_LABELS] ?? type}
                    </td>
                    <td className="px-4 py-3" style={{ color: '#ca8a04' }}>{fmt(r.purchasedAmt)}</td>
                    <td className="px-4 py-3" style={{ color: '#ca8a04' }}>{r.purchasedKg.toFixed(1)} kg</td>
                    <td className="px-4 py-3" style={{ color: '#2563eb' }}>{fmt(r.soldAmt)}</td>
                    <td className="px-4 py-3" style={{ color: '#2563eb' }}>{r.soldKg.toFixed(1)} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Expenses by category */}
      {expByCategory.size > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>EXPENSES BY CATEGORY</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from(expByCategory.entries()).map(([cat, amt]) => (
              <div key={cat} className="rounded-xl border p-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <div className="text-xs mb-1 capitalize" style={{ color: 'var(--text-secondary)' }}>{cat.replace('_', ' ')}</div>
                <div className="text-lg font-bold" style={{ color: '#dc2626' }}>{fmt(amt)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

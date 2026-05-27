// [grocery] [all tenants]
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Wallet, CheckCircle, History } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getCashDrawerEntry, getCashDrawerHistory, getCashSalesForDate, upsertCashDrawerEntry } from '@/lib/db/grocery';

function todayISO() { return new Date().toISOString().slice(0, 10); }
function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }
function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function CashDrawerPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const today = todayISO();
  const qc = useQueryClient();

  const [openingInput, setOpeningInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [saved, setSaved] = useState(false);

  const { data: entry, isLoading: loadingEntry } = useQuery({
    queryKey: ['cash-drawer-today', tenantId, today],
    queryFn: () => getCashDrawerEntry(tenantId, today),
    enabled: !!tenantId,
  });

  useEffect(() => {
    if (entry) {
      setOpeningInput(String(entry.opening_balance));
      setNotesInput(entry.notes ?? '');
      setSaved(true);
    }
  }, [entry]);

  const { data: cashSales = 0 } = useQuery({
    queryKey: ['cash-sales-today', tenantId, today],
    queryFn: () => getCashSalesForDate(tenantId, today),
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  const { data: history = [] } = useQuery({
    queryKey: ['cash-drawer-history', tenantId],
    queryFn: () => getCashDrawerHistory(tenantId, 15),
    enabled: !!tenantId,
  });

  const opening = parseFloat(openingInput) || 0;
  const closingBalance = opening + cashSales;

  const saveMutation = useMutation({
    mutationFn: () => upsertCashDrawerEntry(tenantId, today, {
      opening_balance: opening,
      closing_balance: closingBalance,
      notes: notesInput || null,
    }),
    onSuccess: () => {
      toast.success('Cash drawer saved');
      setSaved(true);
      qc.invalidateQueries({ queryKey: ['cash-drawer-today'] });
      qc.invalidateQueries({ queryKey: ['cash-drawer-history'] });
    },
    onError: () => toast.error('Failed to save'),
  });

  if (loadingEntry) {
    return <div className="p-8 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading…</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>Cash Drawer</p>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Daily Cash Report</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{fmtDate(today)}</p>
      </div>

      {/* Today's panel */}
      <div className="rounded-2xl p-6 space-y-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5" style={{ color: 'var(--accent)' }} />
          <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Today</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl p-4" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <p className="text-xs font-medium mb-1" style={{ color: '#15803d' }}>Opening Balance</p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold" style={{ color: '#15803d' }}>₹</span>
              <input
                type="number"
                min="0"
                value={openingInput}
                onChange={(e) => { setOpeningInput(e.target.value); setSaved(false); }}
                placeholder="0"
                className="flex-1 bg-transparent text-xl font-bold outline-none"
                style={{ color: '#15803d' }}
              />
            </div>
          </div>

          <div className="rounded-xl p-4" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
            <p className="text-xs font-medium mb-1" style={{ color: '#1d4ed8' }}>Cash Sales Today</p>
            <p className="text-xl font-bold" style={{ color: '#1d4ed8' }}>{fmt(cashSales)}</p>
            <p className="text-xs mt-0.5" style={{ color: '#60a5fa' }}>auto-calculated from POS</p>
          </div>

          <div className="rounded-xl p-4" style={{ background: '#fdf4ff', border: '1px solid #e9d5ff' }}>
            <p className="text-xs font-medium mb-1" style={{ color: '#7c3aed' }}>Closing Balance</p>
            <p className="text-xl font-bold" style={{ color: '#7c3aed' }}>{fmt(closingBalance)}</p>
            <p className="text-xs mt-0.5" style={{ color: '#a78bfa' }}>opening + cash sales</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Notes (optional)</label>
          <textarea
            value={notesInput}
            onChange={(e) => { setNotesInput(e.target.value); setSaved(false); }}
            rows={2}
            placeholder="Any notes about today's cash…"
            className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
            style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition-opacity disabled:opacity-60"
            style={{ background: 'var(--accent)' }}
          >
            {saveMutation.isPending ? 'Saving…' : 'Save Today\'s Report'}
          </button>
          {saved && (
            <div className="flex items-center gap-1.5 text-sm font-medium" style={{ color: '#16a34a' }}>
              <CheckCircle className="h-4 w-4" />
              Saved
            </div>
          )}
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <div className="flex items-center gap-2 mb-4">
            <History className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
            <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Past Reports</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--surface-border)' }}>
                  <th className="text-left py-2 font-medium" style={{ color: 'var(--text-tertiary)' }}>Date</th>
                  <th className="text-right py-2 font-medium" style={{ color: 'var(--text-tertiary)' }}>Opening</th>
                  <th className="text-right py-2 font-medium" style={{ color: 'var(--text-tertiary)' }}>Cash Sales</th>
                  <th className="text-right py-2 font-medium" style={{ color: 'var(--text-tertiary)' }}>Closing</th>
                  <th className="text-left py-2 font-medium pl-4" style={{ color: 'var(--text-tertiary)' }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                    <td className="py-2.5 font-medium" style={{ color: 'var(--text-primary)' }}>{fmtDate(h.date)}</td>
                    <td className="py-2.5 text-right" style={{ color: 'var(--text-secondary)' }}>{fmt(h.opening_balance)}</td>
                    <td className="py-2.5 text-right" style={{ color: '#2563eb' }}>
                      {h.closing_balance != null ? fmt(h.closing_balance - h.opening_balance) : '—'}
                    </td>
                    <td className="py-2.5 text-right font-semibold" style={{ color: 'var(--accent)' }}>
                      {h.closing_balance != null ? fmt(h.closing_balance) : '—'}
                    </td>
                    <td className="py-2.5 pl-4 text-xs" style={{ color: 'var(--text-tertiary)' }}>{h.notes ?? '—'}</td>
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

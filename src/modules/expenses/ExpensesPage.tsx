// [carwash] [all tenants] — redesigned expenses page using CSS variable theme system
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/app/store/app.store';
import { listExpenses, addExpense, deleteExpense, getExpenseSummary, EXPENSE_CATEGORIES } from '@/lib/db/expenses';
import { toast } from 'sonner';
import { Plus, Trash2, X, Download, IndianRupee, Calendar } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';

const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const today = () => format(new Date(), 'yyyy-MM-dd');

const QUICK_RANGES = [
  { label: 'Today',      from: () => today(),                              to: () => today() },
  { label: 'This Week',  from: () => format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'), to: () => format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd') },
  { label: 'This Month', from: () => format(startOfMonth(new Date()), 'yyyy-MM-dd'), to: () => format(endOfMonth(new Date()), 'yyyy-MM-dd') },
  { label: 'Last 30',    from: () => format(subDays(new Date(), 30), 'yyyy-MM-dd'), to: () => today() },
];

const CATEGORY_ICONS: Record<string, string> = {
  'Rent': '🏠', 'Electricity': '⚡', 'Salaries': '👷', 'Purchase / Stock': '🧴',
  'Transport': '🚛', 'Maintenance': '🔧', 'Marketing': '📣', 'Packaging': '📦', 'Miscellaneous': '💼',
};

const PAYMENT_COLORS: Record<string, string> = {
  cash: '#16a34a', upi: '#7c3aed', card: '#2563eb',
};

const emptyForm = () => ({
  category: EXPENSE_CATEGORIES[0],
  description: '',
  amount: '',
  payment_method: 'cash' as const,
  expense_date: today(),
  notes: '',
});

export function ExpensesPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();

  const [from, setFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [to, setTo]   = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [activeRange, setActiveRange] = useState(2); // "This Month" default
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses', tenantId, from, to],
    queryFn: () => listExpenses(tenantId, from, to),
    enabled: !!tenantId,
  });

  const { data: summary = [] } = useQuery({
    queryKey: ['expenses-summary', tenantId, from, to],
    queryFn: () => getExpenseSummary(tenantId, from, to),
    enabled: !!tenantId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['expenses'] });
    qc.invalidateQueries({ queryKey: ['expenses-summary'] });
  };

  const addMutation = useMutation({
    mutationFn: () => {
      if (!form.amount || parseFloat(form.amount) <= 0) throw new Error('Enter a valid amount');
      return addExpense(tenantId, {
        category: form.category,
        description: form.description || null,
        amount: parseFloat(form.amount),
        expense_date: form.expense_date,
        payment_method: form.payment_method,
        notes: form.notes || null,
      });
    },
    onSuccess: () => { invalidate(); setShowAdd(false); setForm(emptyForm()); toast.success('Expense recorded'); },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to save'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteExpense(tenantId, id),
    onSuccess: () => { invalidate(); toast.success('Expense deleted'); },
  });

  function applyRange(idx: number) {
    setActiveRange(idx);
    setFrom(QUICK_RANGES[idx].from());
    setTo(QUICK_RANGES[idx].to());
  }

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  const exportCSV = () => {
    const rows = [
      ['Date', 'Category', 'Description', 'Amount', 'Payment', 'Notes'],
      ...expenses.map(e => [e.expense_date.slice(0, 10), e.category, e.description || '', e.amount, e.payment_method, e.notes || '']),
    ];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `expenses_${from}_to_${to}.csv`;
    a.click();
  };

  const inp = 'w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2';
  const inpStyle = { borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' } as React.CSSProperties;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Car Wash</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Expenses</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="flex items-center gap-1.5 btn-secondary px-3 py-2 rounded-xl text-sm font-semibold">
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button onClick={() => { setForm(emptyForm()); setShowAdd(true); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'var(--accent)' }}>
            <Plus className="h-4 w-4" /> Add Expense
          </button>
        </div>
      </div>

      {/* Quick range + date pickers */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          {QUICK_RANGES.map((r, i) => (
            <button key={r.label} onClick={() => applyRange(i)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: activeRange === i ? 'var(--accent)' : 'transparent', color: activeRange === i ? 'white' : 'var(--text-secondary)' }}>
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5" style={{ borderColor: 'var(--surface-border)', background: 'var(--surface)' }}>
            <Calendar className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
            <input type="date" value={from} onChange={e => { setFrom(e.target.value); setActiveRange(-1); }}
              className="text-xs outline-none" style={{ background: 'transparent', color: 'var(--text-primary)' }} />
          </div>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>to</span>
          <div className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5" style={{ borderColor: 'var(--surface-border)', background: 'var(--surface)' }}>
            <Calendar className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
            <input type="date" value={to} onChange={e => { setTo(e.target.value); setActiveRange(-1); }}
              className="text-xs outline-none" style={{ background: 'transparent', color: 'var(--text-primary)' }} />
          </div>
        </div>
      </div>

      {/* Total + category summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Total card */}
        <div className="rounded-2xl p-4 col-span-2 sm:col-span-1 flex flex-col justify-between"
          style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Total Spent</p>
          <p className="text-2xl font-bold mt-2" style={{ color: '#f87171' }}>{fmt(totalExpenses)}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{expenses.length} expense{expenses.length !== 1 ? 's' : ''}</p>
        </div>
        {/* Category breakdown */}
        {summary.slice(0, 3).map(s => (
          <div key={s.category} className="rounded-2xl p-4 flex flex-col justify-between"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>
              {CATEGORY_ICONS[s.category] ?? '💼'} {s.category}
            </p>
            <p className="text-lg font-bold mt-2" style={{ color: 'var(--text-primary)' }}>{fmt(s.total)}</p>
          </div>
        ))}
      </div>

      {/* Expense list */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        {isLoading && (
          <div className="space-y-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4" style={{ borderBottom: '1px solid var(--surface-border)' }}>
                <div className="h-9 w-9 rounded-xl animate-pulse" style={{ background: 'var(--surface-2)' }} />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-32 rounded animate-pulse" style={{ background: 'var(--surface-2)' }} />
                  <div className="h-3 w-20 rounded animate-pulse" style={{ background: 'var(--surface-2)' }} />
                </div>
                <div className="h-4 w-16 rounded animate-pulse" style={{ background: 'var(--surface-2)' }} />
              </div>
            ))}
          </div>
        )}
        {!isLoading && expenses.length === 0 && (
          <div className="flex flex-col items-center justify-center py-14 gap-3">
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-3xl" style={{ background: 'var(--surface-2)' }}>💸</div>
            <p className="font-semibold text-sm" style={{ color: 'var(--text-secondary)' }}>No expenses in this period</p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Click "Add Expense" to record one</p>
          </div>
        )}
        {!isLoading && expenses.map((e, i) => (
          <div key={e.id} className="flex items-center gap-4 px-5 py-4 group"
            style={{ borderBottom: i < expenses.length - 1 ? '1px solid var(--surface-border)' : undefined }}>
            {/* Icon */}
            <div className="h-10 w-10 rounded-xl flex items-center justify-center text-xl shrink-0"
              style={{ background: 'var(--surface-2)' }}>
              {CATEGORY_ICONS[e.category] ?? '💼'}
            </div>
            {/* Details */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                {e.description || e.category}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {new Date(e.expense_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                  {e.category}
                </span>
              </div>
            </div>
            {/* Payment method */}
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full uppercase hidden sm:block"
              style={{ background: `${PAYMENT_COLORS[e.payment_method] ?? '#6b7280'}18`, color: PAYMENT_COLORS[e.payment_method] ?? '#6b7280' }}>
              {e.payment_method}
            </span>
            {/* Amount */}
            <p className="font-bold text-base shrink-0" style={{ color: '#f87171' }}>
              {fmt(e.amount)}
            </p>
            {/* Delete */}
            <button onClick={() => deleteMutation.mutate(e.id)}
              className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500 hover:bg-red-50 shrink-0">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Add Expense modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="rounded-2xl p-6 w-full max-w-sm space-y-4" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Add Expense</h2>
              <button onClick={() => setShowAdd(false)}><X className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} /></button>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Category *</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inp} style={inpStyle}>
                {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Description</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="e.g. Motor oil, staff salary" className={inp} style={inpStyle} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Amount *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: 'var(--text-tertiary)' }}>₹</span>
                <input type="number" placeholder="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  className={`${inp} pl-7`} style={inpStyle} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Date *</label>
                <input type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))}
                  className={inp} style={inpStyle} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Payment</label>
                <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value as any }))}
                  className={inp} style={inpStyle}>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                </select>
              </div>
            </div>

            <button onClick={() => addMutation.mutate()} disabled={!form.amount || addMutation.isPending}
              className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-50"
              style={{ background: 'var(--accent)' }}>
              {addMutation.isPending ? 'Saving…' : 'Save Expense'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

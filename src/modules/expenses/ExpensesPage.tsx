import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/app/store/app.store';
import { listExpenses, addExpense, deleteExpense, getExpenseSummary, EXPENSE_CATEGORIES } from '@/lib/db/expenses';
import { toast } from 'sonner';
import { Plus, Trash2, X, IndianRupee } from 'lucide-react';
import { format, subDays } from 'date-fns';

export function ExpensesPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [from, setFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ category: EXPENSE_CATEGORIES[0], description: '', amount: '', payment_method: 'cash' as const, expense_date: format(new Date(), 'yyyy-MM-dd'), notes: '' });

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses', tenantId, from, to],
    queryFn: () => listExpenses(tenantId, from, to),
    enabled: !!tenantId,
  });

  const { data: summary = [] } = useQuery({
    queryKey: ['expenses-summary', tenantId, from, to],
    queryFn: () => getExpenseSummary(tenantId, from, to),
    enabled: !!tenantId,
  });

  const addMutation = useMutation({
    mutationFn: () => addExpense(tenantId, {
      category: form.category,
      description: form.description || null,
      amount: parseFloat(form.amount),
      expense_date: form.expense_date,
      payment_method: form.payment_method,
      notes: form.notes || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['expenses-summary'] });
      setShowAdd(false);
      setForm({ category: EXPENSE_CATEGORIES[0], description: '', amount: '', payment_method: 'cash', expense_date: format(new Date(), 'yyyy-MM-dd'), notes: '' });
      toast.success('Expense recorded');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteExpense(tenantId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['expenses-summary'] });
      toast.success('Expense deleted');
    },
  });

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  const exportCSV = () => {
    const rows = [
      ['Date', 'Category', 'Description', 'Amount', 'Payment Method', 'Notes'],
      ...expenses.map(e => [e.expense_date.slice(0, 10), e.category, e.description || '', e.amount, e.payment_method, e.notes || '']),
    ];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `expenses_${from}_to_${to}.csv`;
    a.click();
  };

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Expenses</h1>
          <p className="text-slate-400 text-sm mt-1">Track all shop expenses</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="btn-secondary text-sm">↓ Export CSV</button>
          <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Add Expense
          </button>
        </div>
      </div>

      {/* Date range */}
      <div className="flex gap-3 mb-6">
        <div><label className="block text-xs text-slate-400 mb-1">From</label><input type="date" className="input" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div><label className="block text-xs text-slate-400 mb-1">To</label><input type="date" className="input" value={to} onChange={e => setTo(e.target.value)} /></div>
        <div className="flex items-end"><div className="card px-5 py-2.5"><span className="text-xs text-slate-400">Total: </span><span className="font-bold text-red-400">{fmt(totalExpenses)}</span></div></div>
      </div>

      {/* Category summary */}
      {summary.length > 0 && (
        <div className="card mb-6">
          <p className="section-label mb-3">By Category</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {summary.map(s => (
              <div key={s.category} className="bg-slate-800/50 rounded-xl p-3">
                <p className="text-xs text-slate-400">{s.category}</p>
                <p className="font-bold text-white mt-1">{fmt(s.total)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expense list */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left px-4 py-3 text-xs text-slate-400 uppercase tracking-wider">Date</th>
              <th className="text-left px-4 py-3 text-xs text-slate-400 uppercase tracking-wider">Category</th>
              <th className="text-left px-4 py-3 text-xs text-slate-400 uppercase tracking-wider">Description</th>
              <th className="text-left px-4 py-3 text-xs text-slate-400 uppercase tracking-wider">Payment</th>
              <th className="text-right px-4 py-3 text-xs text-slate-400 uppercase tracking-wider">Amount</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-slate-500 text-sm">No expenses in this period</td></tr>
            ) : expenses.map(e => (
              <tr key={e.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                <td className="px-4 py-3 text-sm text-slate-300">{new Date(e.expense_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                <td className="px-4 py-3"><span className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded-full">{e.category}</span></td>
                <td className="px-4 py-3 text-sm text-slate-300">{e.description || '—'}</td>
                <td className="px-4 py-3 text-xs text-slate-400 uppercase">{e.payment_method}</td>
                <td className="px-4 py-3 text-right font-semibold text-red-400">{fmt(e.amount)}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => deleteMutation.mutate(e.id)} className="text-slate-600 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white">Add Expense</h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Category *</label>
                <select className="input w-full" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Description</label>
                <input className="input w-full" placeholder="e.g. Monthly rent" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Amount *</label>
                <div className="relative">
                  <IndianRupee size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input className="input w-full pl-8" type="number" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Date *</label>
                  <input type="date" className="input w-full" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Payment</label>
                  <select className="input w-full" value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value as any }))}>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={() => addMutation.mutate()} disabled={!form.amount || addMutation.isPending} className="btn-primary flex-1 disabled:opacity-40">
                {addMutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

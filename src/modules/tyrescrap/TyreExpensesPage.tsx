// [tyrescrap] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, X } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listExpenses, saveExpense, deleteExpense, EXPENSE_CATEGORY_LABELS, TyreExpense } from '@/lib/db/tyrescrap';

function todayISO() { return new Date().toISOString().slice(0, 10); }
function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

const EMPTY = { date: todayISO(), category: 'transport', description: '', amount: 0, notes: '' };

export function TyreExpensesPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const { data: expenses = [] } = useQuery({
    queryKey: ['tyre-expenses', tenantId, filterFrom, filterTo],
    queryFn:  () => listExpenses(tenantId, { from: filterFrom || undefined, to: filterTo || undefined }),
    enabled:  !!tenantId,
  });

  const saveMut = useMutation({
    mutationFn: () => saveExpense(tenantId, form, editId ?? undefined),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tyre-expenses'] }); qc.invalidateQueries({ queryKey: ['tyrescrap-stats'] }); closeForm(); },
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteExpense(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tyre-expenses'] }); qc.invalidateQueries({ queryKey: ['tyrescrap-stats'] }); },
  });

  function openNew() { setForm({ ...EMPTY }); setEditId(null); setShowForm(true); }
  function openEdit(e: TyreExpense) {
    setForm({ date: e.date, category: e.category, description: e.description, amount: e.amount, notes: e.notes });
    setEditId(e.id); setShowForm(true);
  }
  function closeForm() { setShowForm(false); setEditId(null); }
  function set(k: string, v: unknown) { setForm((p) => ({ ...p, [k]: v })); }

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Expenses</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{expenses.length} entries · {fmt(total)}</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow" style={{ background: '#dc2626' }}>
          <Plus size={16} /> Add Expense
        </button>
      </div>

      <div className="flex gap-3 mb-5 flex-wrap">
        <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm border" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
        <span className="self-center text-sm" style={{ color: 'var(--text-secondary)' }}>to</span>
        <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm border" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
        {(filterFrom || filterTo) && (
          <button onClick={() => { setFilterFrom(''); setFilterTo(''); }} className="text-sm px-3 py-2 rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Clear</button>
        )}
      </div>

      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--surface-hover)' }}>
              {['Date', 'Category', 'Description', 'Amount', ''].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 && (
              <tr><td colSpan={5} className="text-center py-12" style={{ color: 'var(--text-tertiary)' }}>No expenses yet</td></tr>
            )}
            {expenses.map((e) => (
              <tr key={e.id} className="border-t cursor-pointer hover:opacity-80" style={{ borderColor: 'var(--border)' }} onClick={() => openEdit(e)}>
                <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>{e.date}</td>
                <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{EXPENSE_CATEGORY_LABELS[e.category as keyof typeof EXPENSE_CATEGORY_LABELS] ?? e.category}</td>
                <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>{e.description}</td>
                <td className="px-4 py-3 font-semibold" style={{ color: '#dc2626' }}>{fmt(e.amount)}</td>
                <td className="px-4 py-3" onClick={(evt) => { evt.stopPropagation(); if (confirm('Delete expense?')) delMut.mutate(e.id); }}>
                  <Trash2 size={15} style={{ color: '#dc2626' }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{editId ? 'Edit Expense' : 'Add Expense'}</h2>
              <button onClick={closeForm}><X size={20} style={{ color: 'var(--text-secondary)' }} /></button>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Date</label>
              <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Category</label>
              <select value={form.category} onChange={(e) => set('category', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Description *</label>
              <input value={form.description} onChange={(e) => set('description', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} placeholder="e.g. Truck loading charge" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Amount (₹) *</label>
              <input type="number" value={form.amount} onChange={(e) => set('amount', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg border text-sm font-semibold" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: '#dc2626' }} min="0" step="1" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Notes</label>
              <input value={form.notes} onChange={(e) => set('notes', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} placeholder="Optional" />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={closeForm} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Cancel</button>
              <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.description || !form.amount}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: '#dc2626' }}>
                {saveMut.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

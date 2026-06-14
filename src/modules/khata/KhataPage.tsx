import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/app/store/app.store';
import { listKhataCustomers, listKhataEntries, addKhataEntry, deleteKhataEntry, KhataCustomerSummary } from '@/lib/db/khata';
import { listCustomers } from '@/lib/db/customers';
import { toast } from 'sonner';
import { IndianRupee, Plus, Trash2, X, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

export function KhataPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const config = useAppStore((s) => s.config);
  const qc = useQueryClient();
  const [selectedCustomer, setSelectedCustomer] = useState<KhataCustomerSummary | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ customer_id: '', type: 'debit' as 'debit' | 'credit', amount: '', notes: '' });
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  const { data: summary = [] } = useQuery({
    queryKey: ['khata-summary', tenantId],
    queryFn: () => listKhataCustomers(tenantId),
    enabled: !!tenantId,
  });

  const { data: entries = [] } = useQuery({
    queryKey: ['khata-entries', tenantId, selectedCustomer?.customer_id],
    queryFn: () => listKhataEntries(tenantId, selectedCustomer!.customer_id),
    enabled: !!tenantId && !!selectedCustomer,
  });

  const { data: customersData } = useQuery({
    queryKey: ['customers', tenantId],
    queryFn: () => listCustomers(tenantId),
    enabled: !!tenantId && showAdd,
  });
  const customers: import('@/lib/db/customers').Customer[] = customersData?.items ?? [];

  const addMutation = useMutation({
    mutationFn: () => addKhataEntry(tenantId, {
      customer_id: form.customer_id,
      type: form.type,
      amount: parseFloat(form.amount),
      notes: form.notes,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['khata-summary'] });
      qc.invalidateQueries({ queryKey: ['khata-entries'] });
      setShowAdd(false);
      setForm({ customer_id: '', type: 'debit', amount: '', notes: '' });
      toast.success('Entry added');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteKhataEntry(tenantId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['khata-summary'] });
      qc.invalidateQueries({ queryKey: ['khata-entries'] });
      setDeleteTarget(null);
      toast.success('Entry deleted');
    },
  });

  const totalOutstanding = summary.reduce((s, c) => s + Math.max(0, c.balance), 0);

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  return (
    <div className="flex h-full gap-0">
      {/* Left — customer list */}
      <div className="w-80 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-lg font-bold text-white">Khata</h1>
            <button onClick={() => setShowAdd(true)} className="btn-primary px-3 py-1.5 text-sm flex items-center gap-1">
              <Plus size={14} /> Add Entry
            </button>
          </div>
          <p className="text-xs text-slate-500">Total outstanding: <span className="text-red-400 font-semibold">{fmt(totalOutstanding)}</span></p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {summary.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No credit entries yet.<br />Add an entry to start tracking.
            </div>
          ) : (
            summary.map((c) => (
              <div
                key={c.customer_id}
                onClick={() => setSelectedCustomer(c)}
                className={`p-4 border-b border-slate-800/50 cursor-pointer hover:bg-slate-800/30 transition-colors ${selectedCustomer?.customer_id === c.customer_id ? 'bg-slate-800/50 border-l-2 border-l-indigo-500' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-sm text-white">{c.customer_name}</p>
                    {c.customer_phone && <p className="text-xs text-slate-500 mt-0.5">{c.customer_phone}</p>}
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${c.balance > 0 ? 'text-red-400' : c.balance < 0 ? 'text-green-400' : 'text-slate-400'}`}>
                      {c.balance > 0 ? `${fmt(c.balance)} due` : c.balance < 0 ? `${fmt(Math.abs(c.balance))} advance` : 'Settled'}
                    </p>
                    {c.last_entry && <p className="text-xs text-slate-600 mt-0.5">{new Date(c.last_entry).toLocaleDateString('en-IN')}</p>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right — ledger */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedCustomer ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
            Select a customer to view their ledger
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-white">{selectedCustomer.customer_name}</h2>
                <div className="flex gap-4 mt-1 text-xs text-slate-400">
                  <span>Total sold: <span className="text-slate-200">{fmt(selectedCustomer.total_debit)}</span></span>
                  <span>Total received: <span className="text-green-400">{fmt(selectedCustomer.total_credit)}</span></span>
                  <span className={`font-semibold ${selectedCustomer.balance > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    Balance: {selectedCustomer.balance > 0 ? `${fmt(selectedCustomer.balance)} due` : selectedCustomer.balance < 0 ? `${fmt(Math.abs(selectedCustomer.balance))} advance` : 'Settled'}
                  </span>
                </div>
              </div>
              {selectedCustomer.customer_phone && (
                <a
                  href={`https://wa.me/91${selectedCustomer.customer_phone.replace(/\D/g, '')}?text=Hi ${selectedCustomer.customer_name}, your outstanding balance is ${fmt(selectedCustomer.balance)}. Please clear at your earliest. - ${config?.shop_name}`}
                  className="btn-secondary text-sm px-3 py-1.5"
                  target="_blank" rel="noreferrer"
                >
                  💬 Remind on WhatsApp
                </a>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {entries.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-12">No entries yet</p>
              ) : (
                entries.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <div className={`p-2 rounded-lg ${e.type === 'debit' ? 'bg-red-950 text-red-400' : 'bg-green-950 text-green-400'}`}>
                      {e.type === 'debit' ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{e.type === 'debit' ? 'Sale / Credit given' : 'Payment received'}</p>
                      {e.notes && <p className="text-xs text-slate-500 truncate">{e.notes}</p>}
                      <p className="text-xs text-slate-600">{new Date(e.entry_date).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <p className={`font-bold text-sm ${e.type === 'debit' ? 'text-red-400' : 'text-green-400'}`}>
                      {e.type === 'debit' ? '+' : '-'}{fmt(e.amount)}
                    </p>
                    <button onClick={() => setDeleteTarget(e)} className="text-slate-600 hover:text-red-400 transition-colors p-1">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Add entry modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white">Add Khata Entry</h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Customer *</label>
                <select className="input w-full" value={form.customer_id} onChange={(e) => setForm(f => ({ ...f, customer_id: e.target.value }))}>
                  <option value="">Select customer</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setForm(f => ({ ...f, type: 'debit' }))} className={`py-2 rounded-xl text-sm font-semibold border ${form.type === 'debit' ? 'bg-red-950 border-red-700 text-red-300' : 'border-slate-700 text-slate-400'}`}>
                    ↑ Sale (Debit)
                  </button>
                  <button onClick={() => setForm(f => ({ ...f, type: 'credit' }))} className={`py-2 rounded-xl text-sm font-semibold border ${form.type === 'credit' ? 'bg-green-950 border-green-700 text-green-300' : 'border-slate-700 text-slate-400'}`}>
                    ↓ Payment (Credit)
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Amount *</label>
                <div className="relative">
                  <IndianRupee size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input className="input w-full pl-8" type="number" placeholder="0.00" value={form.amount} onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Notes</label>
                <input className="input w-full" placeholder="Optional note" value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={() => addMutation.mutate()}
                disabled={!form.customer_id || !form.amount || addMutation.isPending}
                className="btn-primary flex-1 disabled:opacity-40"
              >
                {addMutation.isPending ? 'Saving…' : 'Save Entry'}
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete entry"
        message="Are you sure you want to delete this khata entry?"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}

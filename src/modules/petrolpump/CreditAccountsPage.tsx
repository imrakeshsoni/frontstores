// [petrolpump] [all tenants]
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { listCreditAccounts, createCreditAccount, listCreditTransactions, addCreditTransaction } from '@/lib/db/petrolpump';
import { now } from '@/lib/db/index';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function CreditAccountsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ customer_name: '', vehicle_no: '', phone: '' });
  const [txForm, setTxForm] = useState({ fuel_type: 'petrol', litres: '', amount: '', type: 'debit' });
  const [saving, setSaving] = useState(false);

  const { data: accounts = [] } = useQuery({
    queryKey: ['pp-credit-accounts', tenantId, search],
    queryFn: () => listCreditAccounts(tenantId, search),
    enabled: !!tenantId,
  });

  const { data: txns = [] } = useQuery({
    queryKey: ['pp-credit-txns', tenantId, selectedId],
    queryFn: () => listCreditTransactions(tenantId, selectedId!),
    enabled: !!tenantId && !!selectedId,
  });

  const selected = accounts.find(a => a.id === selectedId);

  async function handleAddAccount() {
    if (!addForm.customer_name) { toast.error('Customer name is required'); return; }
    setSaving(true);
    try {
      await createCreditAccount(tenantId, addForm);
      toast.success('Account created');
      setAddForm({ customer_name: '', vehicle_no: '', phone: '' });
      setShowAdd(false);
      qc.invalidateQueries({ queryKey: ['pp-credit-accounts', tenantId] });
    } catch (e) { toast.error(String(e)); }
    finally { setSaving(false); }
  }

  async function handleAddTxn() {
    if (!selectedId || !txForm.amount) { toast.error('Enter amount'); return; }
    setSaving(true);
    try {
      await addCreditTransaction(tenantId, {
        account_id: selectedId,
        fuel_type: txForm.fuel_type,
        litres: parseFloat(txForm.litres) || 0,
        amount: parseFloat(txForm.amount) || 0,
        type: txForm.type,
        date: new Date().toISOString().slice(0, 10),
      });
      toast.success(txForm.type === 'debit' ? 'Fuel added on credit' : 'Payment recorded');
      setTxForm({ fuel_type: 'petrol', litres: '', amount: '', type: 'debit' });
      qc.invalidateQueries({ queryKey: ['pp-credit-txns', tenantId, selectedId] });
      qc.invalidateQueries({ queryKey: ['pp-credit-accounts', tenantId] });
    } catch (e) { toast.error(String(e)); }
    finally { setSaving(false); }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Credit Accounts</h1>
        <button onClick={() => setShowAdd(s => !s)} className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors">
          + Add Account
        </button>
      </div>

      {showAdd && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 mb-4">New Credit Account</h2>
          <div className="grid grid-cols-3 gap-4">
            {[['Customer Name *', 'customer_name', 'e.g. Sharma Enterprises'], ['Vehicle No', 'vehicle_no', 'e.g. MH12AB1234'], ['Phone', 'phone', '9999999999']].map(([label, key, ph]) => (
              <div key={key}>
                <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                <input value={(addForm as any)[key]} onChange={e => setAddForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={ph}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm hover:bg-slate-50">Cancel</button>
            <button onClick={handleAddAccount} disabled={saving} className="px-6 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold disabled:opacity-40">
              {saving ? 'Saving…' : 'Create Account'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Account list */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search accounts…"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {accounts.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-6">No credit accounts yet</p>
            ) : accounts.map(a => (
              <button key={a.id} onClick={() => setSelectedId(a.id)}
                className={`w-full text-left p-3 rounded-xl border transition-colors ${selectedId === a.id ? 'border-amber-400 bg-amber-50' : 'border-slate-100 hover:bg-slate-50'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-slate-800 text-sm">{a.customer_name}</p>
                    <p className="text-xs text-slate-500">{a.vehicle_no} {a.phone && `· ${a.phone}`}</p>
                  </div>
                  <span className={`text-sm font-bold ${a.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(a.balance)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Account detail */}
        {selected && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-semibold text-slate-900">{selected.customer_name}</h2>
                <p className="text-xs text-slate-500">{selected.vehicle_no}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Balance</p>
                <p className={`text-xl font-bold ${selected.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(selected.balance)}</p>
              </div>
            </div>

            {/* Add transaction */}
            <div className="border border-slate-100 rounded-xl p-4 mb-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Add Transaction</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
                  <select value={txForm.type} onChange={e => setTxForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none">
                    <option value="debit">Fuel (Debit)</option>
                    <option value="credit">Payment (Credit)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Fuel Type</label>
                  <select value={txForm.fuel_type} onChange={e => setTxForm(f => ({ ...f, fuel_type: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none">
                    <option value="petrol">Petrol</option>
                    <option value="diesel">Diesel</option>
                    <option value="cng">CNG</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Litres</label>
                  <input type="number" value={txForm.litres} onChange={e => setTxForm(f => ({ ...f, litres: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Amount (₹) *</label>
                  <input type="number" value={txForm.amount} onChange={e => setTxForm(f => ({ ...f, amount: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none" placeholder="0" />
                </div>
              </div>
              <button onClick={handleAddTxn} disabled={saving} className="mt-3 w-full py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold disabled:opacity-40">
                {saving ? 'Saving…' : 'Add'}
              </button>
            </div>

            {/* Transactions */}
            <div className="max-h-48 overflow-y-auto space-y-1">
              {txns.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-3">No transactions yet</p>
              ) : txns.map(t => (
                <div key={t.id} className="flex justify-between items-center text-sm py-1.5 border-b border-slate-50">
                  <div>
                    <span className="font-medium text-slate-700 capitalize">{t.type === 'debit' ? 'Fuel' : 'Payment'}</span>
                    <span className="text-slate-400 text-xs ml-2">{t.date}</span>
                  </div>
                  <span className={`font-bold ${t.type === 'debit' ? 'text-red-600' : 'text-green-600'}`}>
                    {t.type === 'debit' ? '+' : '-'}{fmt(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

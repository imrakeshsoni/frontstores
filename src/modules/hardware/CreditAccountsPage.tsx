// [hardware] [all tenants]
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, ChevronRight, ArrowLeft, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { sendWhatsApp } from '@/lib/whatsapp';
import {
  listHwCreditAccounts, saveHwCreditAccount, deleteHwCreditAccount,
  listHwCreditTransactions, addHwCreditTransaction,
  type HwCreditAccount, type HwCreditTransaction,
} from '@/lib/db/hardware';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`; }

function ageInDays(dateStr: string): number {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

function agingBuckets(transactions: HwCreditTransaction[]) {
  const buckets = { d0_30: 0, d31_60: 0, d60_plus: 0 };
  for (const tx of transactions) {
    if (tx.type !== 'debit') continue;
    const age = ageInDays(tx.date);
    if (age <= 30) buckets.d0_30 += tx.amount;
    else if (age <= 60) buckets.d31_60 += tx.amount;
    else buckets.d60_plus += tx.amount;
  }
  return buckets;
}

export function CreditAccountsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const shopName = useAppStore(s => s.config?.shop_name ?? 'our shop');
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<HwCreditAccount | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');

  const [txType, setTxType] = useState<'debit' | 'credit'>('debit');
  const [txAmount, setTxAmount] = useState('');
  const [txDesc, setTxDesc] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: accounts = [] } = useQuery({
    queryKey: ['hw-credit-accounts', tenantId, search],
    queryFn: () => listHwCreditAccounts(tenantId, search || undefined),
    enabled: !!tenantId,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['hw-credit-tx', tenantId, selected?.id],
    queryFn: () => listHwCreditTransactions(tenantId, selected!.id),
    enabled: !!tenantId && !!selected,
  });

  const addAccount = useMutation({
    mutationFn: () => saveHwCreditAccount(tenantId, { customer_name: newName, phone: newPhone, address: newAddress }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hw-credit-accounts'] });
      toast.success('Account created');
      setShowAdd(false);
      setNewName(''); setNewPhone(''); setNewAddress('');
    },
  });

  const addTx = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('No account selected');
      return addHwCreditTransaction(tenantId, {
        account_id: selected.id,
        type: txType,
        amount: parseFloat(txAmount) || 0,
        description: txDesc,
        date: txDate,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hw-credit-tx'] });
      qc.invalidateQueries({ queryKey: ['hw-credit-accounts'] });
      qc.invalidateQueries({ queryKey: ['hw-stats'] });
      toast.success('Transaction added');
      setTxAmount(''); setTxDesc('');
    },
    onError: (e: any) => toast.error(e.message || 'Failed'),
  });

  const deleteAccount = useMutation({
    mutationFn: (id: string) => deleteHwCreditAccount(tenantId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hw-credit-accounts'] });
      setSelected(null);
      toast.success('Account deleted');
    },
  });

  const aging = useMemo(() => agingBuckets(transactions), [transactions]);

  function sendReminder(acc: HwCreditAccount) {
    if (!acc.phone) { toast.error('No phone number on this account'); return; }
    const msg = `Hello ${acc.customer_name}, this is a reminder from ${shopName}. Your outstanding balance is ${fmt(Math.abs(acc.balance))}. Please clear it at your earliest convenience. Thank you!`;
    sendWhatsApp(acc.phone, msg);
  }

  if (selected) {
    return (
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelected(null)} className="p-2 rounded-xl hover:bg-slate-100">
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{selected.customer_name}</h1>
            <p className="text-sm text-slate-500">{selected.phone}</p>
          </div>
        </div>

        {/* Balance card */}
        <div className={`rounded-2xl p-5 ${selected.balance > 0 ? 'bg-red-50 border border-red-100' : 'bg-green-50 border border-green-100'}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">Outstanding Balance</p>
              <p className={`text-3xl font-bold ${selected.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {fmt(Math.abs(selected.balance))}
              </p>
              <p className="text-xs text-slate-400 mt-1">{selected.balance > 0 ? 'Customer owes you' : selected.balance < 0 ? 'You owe customer' : 'Clear'}</p>
            </div>
            {selected.balance > 0 && (
              <button
                onClick={() => sendReminder(selected)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-white"
                style={{ background: '#16a34a' }}
              >
                <MessageCircle className="h-4 w-4" /> Send Reminder
              </button>
            )}
          </div>
          {selected.balance > 0 && (aging.d0_30 + aging.d31_60 + aging.d60_plus > 0) && (
            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-red-100">
              <div className="text-center">
                <p className="text-xs text-slate-400">0-30 days</p>
                <p className="text-sm font-semibold text-slate-700">{fmt(aging.d0_30)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400">31-60 days</p>
                <p className="text-sm font-semibold text-amber-600">{fmt(aging.d31_60)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400">60+ days</p>
                <p className="text-sm font-semibold text-red-600">{fmt(aging.d60_plus)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Add transaction */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 p-5 space-y-4">
          <h2 className="font-semibold text-slate-900">Add Transaction</h2>
          <div className="flex gap-3">
            {(['debit', 'credit'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTxType(t)}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                style={txType === t
                  ? { background: t === 'debit' ? '#dc2626' : '#16a34a', color: 'white' }
                  : { background: '#f1f5f9', color: '#64748b' }}
              >
                {t === 'debit' ? 'Debit (Sold)' : 'Credit (Payment)'}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              value={txAmount}
              onChange={e => setTxAmount(e.target.value)}
              placeholder="Amount (₹)"
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none"
            />
            <input
              type="date"
              value={txDate}
              onChange={e => setTxDate(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none"
            />
          </div>
          <input
            value={txDesc}
            onChange={e => setTxDesc(e.target.value)}
            placeholder="Description (bill no, items, etc.)"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none"
          />
          <button
            onClick={() => addTx.mutate()}
            disabled={!txAmount || addTx.isPending}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', boxShadow: '0 4px 12px -2px rgba(37,99,235,0.4)' }}
          >
            Add Transaction
          </button>
        </div>

        {/* Transaction history */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Transaction History</h2>
          {transactions.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-4">No transactions yet</p>
          ) : (
            <div className="space-y-2">
              {transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-slate-800">
                      {tx.description || (tx.type === 'debit' ? 'Sale' : 'Payment')}
                      {tx.reference_bill_no && (
                        <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                          Bill {tx.reference_bill_no}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-400">{tx.date} · {ageInDays(tx.date)}d ago</p>
                  </div>
                  <span className={`font-semibold ${tx.type === 'debit' ? 'text-red-600' : 'text-green-600'}`}>
                    {tx.type === 'debit' ? '+' : '-'}{fmt(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => { if (confirm('Delete this account?')) deleteAccount.mutate(selected.id); }}
          className="text-sm text-red-500 hover:underline"
        >
          Delete Account
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Credit / Udhar Khata</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', boxShadow: '0 4px 12px -2px rgba(37,99,235,0.4)' }}
        >
          <Plus className="h-4 w-4" /> Add Account
        </button>
      </div>

      {showAdd && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold text-slate-900">New Credit Account</h2>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Customer name *" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none" />
          <input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Phone" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none" />
          <input value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="Address" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none" />
          <div className="flex gap-3">
            <button onClick={() => addAccount.mutate()} disabled={!newName.trim()} className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}>Save</button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl text-sm text-slate-500 hover:bg-slate-100">Cancel</button>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input type="text" placeholder="Search accounts…" value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none" />
      </div>

      {accounts.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-4xl mb-2">📒</p>
          <p>No credit accounts yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map(a => (
            <div
              key={a.id}
              className="w-full bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3 flex items-center justify-between hover:shadow-md transition-all"
            >
              <button onClick={() => setSelected(a)} className="flex-1 text-left min-w-0">
                <p className="font-medium text-slate-900">{a.customer_name}</p>
                <p className="text-xs text-slate-400">{a.phone}</p>
              </button>
              <div className="flex items-center gap-3">
                <span className={`font-semibold ${a.balance > 0 ? 'text-red-600' : a.balance < 0 ? 'text-green-600' : 'text-slate-400'}`}>
                  {fmt(Math.abs(a.balance))}
                </span>
                {a.balance > 0 && a.phone && (
                  <button onClick={() => sendReminder(a)} className="p-2 rounded-lg hover:bg-green-50 text-green-600" title="Send WhatsApp reminder">
                    <MessageCircle className="h-4 w-4" />
                  </button>
                )}
                <button onClick={() => setSelected(a)} className="p-1">
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

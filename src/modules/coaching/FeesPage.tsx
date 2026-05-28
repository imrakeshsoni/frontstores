// [coaching] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IndianRupee, Search, Plus } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listStudents, listBatches, listFees, collectFee, getFeeSummary, getDueStudents } from '@/lib/db/coaching';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function FeesPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const thisMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const [search, setSearch] = useState('');
  const [showCollect, setShowCollect] = useState(false);
  const [collectForm, setCollectForm] = useState({ student_id: '', amount: '', payment_method: 'cash', notes: '' });

  const { data: fees = [] } = useQuery({ queryKey: ['coaching-fees', tenantId, month], queryFn: () => listFees(tenantId, month), enabled: !!tenantId });
  const { data: summary } = useQuery({ queryKey: ['coaching-fee-summary', tenantId, month], queryFn: () => getFeeSummary(tenantId, month), enabled: !!tenantId });
  const { data: dueStudents = [] } = useQuery({ queryKey: ['coaching-due-students', tenantId], queryFn: () => getDueStudents(tenantId), enabled: !!tenantId });
  const { data: students = [] } = useQuery({ queryKey: ['coaching-students', tenantId], queryFn: () => listStudents(tenantId), enabled: !!tenantId });
  const { data: batches = [] } = useQuery({ queryKey: ['coaching-batches', tenantId], queryFn: () => listBatches(tenantId), enabled: !!tenantId });

  const collect = useMutation({
    mutationFn: () => {
      const student = students.find(s => s.id === collectForm.student_id);
      if (!student) throw new Error('Student not found');
      const batch = batches.find(b => b.id === student.batch_id);
      return collectFee(tenantId, {
        student_id: student.id!, student_name: student.name,
        batch_id: student.batch_id ?? null, batch_name: batch?.name ?? null,
        amount: Number(collectForm.amount), month,
        payment_method: collectForm.payment_method, notes: collectForm.notes || null,
        collected_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coaching-fees'] });
      qc.invalidateQueries({ queryKey: ['coaching-fee-summary'] });
      qc.invalidateQueries({ queryKey: ['coaching-due-students'] });
      qc.invalidateQueries({ queryKey: ['coaching-stats'] });
      setShowCollect(false);
      setCollectForm({ student_id: '', amount: '', payment_method: 'cash', notes: '' });
    },
  });

  const filtered = fees.filter(f => {
    const q = search.toLowerCase();
    return !q || f.student_name.toLowerCase().includes(q);
  });

  const handleStudentSelect = (id: string) => {
    const s = students.find(st => st.id === id);
    setCollectForm(f => ({ ...f, student_id: id, amount: s ? String(s.fee_amount) : '' }));
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Fee Collection</h1>
        <button onClick={() => setShowCollect(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors">
          <Plus className="h-4 w-4" /> Collect Fee
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs text-slate-500">Collected This Month</p>
          <p className="text-xl font-bold text-green-600 mt-1">{fmt(summary?.total ?? 0)}</p>
          <p className="text-xs text-slate-400">{summary?.count ?? 0} payments</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs text-slate-500">Students with Dues</p>
          <p className="text-xl font-bold text-orange-500 mt-1">{dueStudents.length}</p>
          <p className="text-xs text-slate-400">{fmt(dueStudents.reduce((s, d) => s + d.balance_due, 0))} total</p>
        </div>
        <div className="col-span-2 sm:col-span-1 flex items-center">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none" />
        </div>
      </div>

      {/* Due students alert */}
      {dueStudents.length > 0 && (
        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4">
          <p className="text-sm font-medium text-orange-800 mb-2">⚠️ Students with Outstanding Dues</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {dueStudents.slice(0, 6).map(s => (
              <div key={s.id} className="flex justify-between text-sm">
                <span className="text-orange-700">{s.name}</span>
                <span className="font-semibold text-orange-800">{fmt(s.balance_due)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fee history */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-50">
          <Search className="h-4 w-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by student name…" className="flex-1 text-sm focus:outline-none" />
        </div>
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <IndianRupee className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>No fee records for this month</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map(f => (
              <div key={f.id} className="flex items-center justify-between px-5 py-3.5">
                <div>
                  <p className="font-medium text-slate-900 text-sm">{f.student_name}</p>
                  <p className="text-xs text-slate-400">{f.batch_name ?? 'No batch'} · {new Date(f.collected_at).toLocaleDateString('en-IN')}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-green-600">{fmt(f.amount)}</p>
                  <p className="text-xs text-slate-400 capitalize">{f.payment_method}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCollect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Collect Fee</h2>
            <div className="space-y-3">
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Student *</label>
                <select className="input w-full" value={collectForm.student_id} onChange={e => handleStudentSelect(e.target.value)} autoFocus>
                  <option value="">Select student…</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name}{s.balance_due > 0 ? ` (Due: ${fmt(s.balance_due)})` : ''}</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Month</label>
                <input type="month" className="input w-full" value={month} onChange={e => setMonth(e.target.value)} />
              </div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Amount (₹) *</label>
                <input type="number" className="input w-full" value={collectForm.amount} onChange={e => setCollectForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" />
              </div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Payment Method</label>
                <select className="input w-full" value={collectForm.payment_method} onChange={e => setCollectForm(f => ({ ...f, payment_method: e.target.value }))}>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                <input className="input w-full" value={collectForm.notes} onChange={e => setCollectForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowCollect(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => collect.mutate()} disabled={!collectForm.student_id || !collectForm.amount || collect.isPending} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {collect.isPending ? 'Saving…' : 'Collect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

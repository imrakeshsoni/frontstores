// [drivingschool] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { getDSStudent, saveDSStudent, listDSSessions, listDSPayments, addDSPayment } from '@/lib/db/drivingschool';

export function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('cash');
  const [payNotes, setPayNotes] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<Record<string,string>>({});

  const { data: student, isLoading } = useQuery({
    queryKey: ['ds-student', id, tenantId],
    queryFn: () => getDSStudent(tenantId, id!),
    enabled: !!id && !!tenantId,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['ds-sessions-student', id, tenantId],
    queryFn: () => listDSSessions(tenantId, { studentId: id }),
    enabled: !!id && !!tenantId,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['ds-payments-student', id, tenantId],
    queryFn: () => listDSPayments(tenantId, id),
    enabled: !!id && !!tenantId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['ds-student', id] });
    qc.invalidateQueries({ queryKey: ['ds-students'] });
    qc.invalidateQueries({ queryKey: ['ds-stats'] });
  };

  const recordPayment = useMutation({
    mutationFn: () => addDSPayment(tenantId, {
      student_id: id!,
      amount: parseFloat(payAmount) || 0,
      payment_mode: payMode,
      date: new Date().toISOString().slice(0,10),
      notes: payNotes,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ds-payments-student', id] });
      invalidate();
      setPayAmount(''); setPayNotes('');
      toast.success('Payment recorded');
    },
  });

  const updateStudent = useMutation({
    mutationFn: (data: Record<string,string | number>) => saveDSStudent(tenantId, { ...student!, ...data } as any),
    onSuccess: () => { invalidate(); setEditOpen(false); toast.success('Saved'); },
  });

  if (isLoading) return <div className="p-6 text-center" style={{ color: 'var(--text-secondary)' }}>Loading…</div>;
  if (!student) return <div className="p-6 text-center text-red-500">Student not found</div>;

  const due = student.fees_total - student.fees_paid;
  const today = new Date().toISOString().slice(0,10);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/drivingschool/students')} className="text-sm font-medium hover:underline" style={{ color: 'var(--text-secondary)' }}>← Students</button>
        <span style={{ color: 'var(--text-tertiary)' }}>/</span>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{student.name}</h1>
      </div>

      {/* Profile card */}
      <div className="rounded-2xl border p-5 space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{student.name}</h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{student.phone} · {student.license_type}</p>
          </div>
          <button onClick={() => { setEditForm({ ll_test_date: student.ll_test_date??'', ll_passed: String(student.ll_passed), dl_test_date: student.dl_test_date??'', dl_passed: String(student.dl_passed), dl_no: student.dl_no, status: student.status }); setEditOpen(true); }} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: '#2563eb' }}>Edit</button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
          <div><p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Enrolled</p><p className="font-medium" style={{ color: 'var(--text-primary)' }}>{student.enrolled_at?.slice(0,10)}</p></div>
          <div><p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>DOB</p><p className="font-medium" style={{ color: 'var(--text-primary)' }}>{student.dob || '—'}</p></div>
          <div><p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>ID Proof</p><p className="font-medium" style={{ color: 'var(--text-primary)' }}>{student.id_proof_type}: {student.id_proof_no || '—'}</p></div>
          <div><p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Address</p><p className="font-medium" style={{ color: 'var(--text-primary)' }}>{student.address || '—'}</p></div>
          <div><p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Status</p><p className="font-medium capitalize" style={{ color: 'var(--text-primary)' }}>{student.status}</p></div>
        </div>

        {/* LL / DL status */}
        <div className="grid grid-cols-2 gap-3">
          <div className={`rounded-xl p-3 ${student.ll_passed ? 'bg-green-50 border border-green-100' : 'bg-slate-50 border border-slate-100'}`}>
            <p className="text-xs font-semibold mb-1" style={{ color: student.ll_passed ? '#15803d' : '#64748b' }}>Learner License (LL)</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Test Date: {student.ll_test_date || '—'}</p>
            <p className="text-xs font-medium mt-1" style={{ color: student.ll_passed ? '#16a34a' : '#94a3b8' }}>{student.ll_passed ? '✓ Passed' : 'Pending'}</p>
          </div>
          <div className={`rounded-xl p-3 ${student.dl_passed ? 'bg-blue-50 border border-blue-100' : 'bg-slate-50 border border-slate-100'}`}>
            <p className="text-xs font-semibold mb-1" style={{ color: student.dl_passed ? '#1d4ed8' : '#64748b' }}>Driving License (DL)</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Test Date: {student.dl_test_date || '—'}</p>
            <p className="text-xs font-medium mt-1" style={{ color: student.dl_passed ? '#2563eb' : '#94a3b8' }}>{student.dl_passed ? `✓ DL No: ${student.dl_no || '—'}` : 'Pending'}</p>
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Update Test Results</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><label className="block text-xs font-medium mb-1 text-slate-600">LL Test Date</label><input type="date" className="input w-full" value={editForm.ll_test_date??''} onChange={e => setEditForm(f=>({...f,ll_test_date:e.target.value}))} /></div>
              <div><label className="block text-xs font-medium mb-1 text-slate-600">LL Passed</label><select className="input w-full" value={editForm.ll_passed??'0'} onChange={e => setEditForm(f=>({...f,ll_passed:e.target.value}))}><option value="0">No</option><option value="1">Yes</option></select></div>
              <div><label className="block text-xs font-medium mb-1 text-slate-600">DL Test Date</label><input type="date" className="input w-full" value={editForm.dl_test_date??''} onChange={e => setEditForm(f=>({...f,dl_test_date:e.target.value}))} /></div>
              <div><label className="block text-xs font-medium mb-1 text-slate-600">DL Passed</label><select className="input w-full" value={editForm.dl_passed??'0'} onChange={e => setEditForm(f=>({...f,dl_passed:e.target.value}))}><option value="0">No</option><option value="1">Yes</option></select></div>
              {editForm.dl_passed === '1' && <div className="col-span-2"><label className="block text-xs font-medium mb-1 text-slate-600">DL Number</label><input className="input w-full" value={editForm.dl_no??''} onChange={e => setEditForm(f=>({...f,dl_no:e.target.value}))} /></div>}
              <div className="col-span-2"><label className="block text-xs font-medium mb-1 text-slate-600">Status</label><select className="input w-full" value={editForm.status??'active'} onChange={e => setEditForm(f=>({...f,status:e.target.value}))}><option value="active">Active</option><option value="completed">Completed</option><option value="inactive">Inactive</option></select></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditOpen(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => updateStudent.mutate({ ll_test_date: editForm.ll_test_date||null, ll_passed: parseInt(editForm.ll_passed||'0'), dl_test_date: editForm.dl_test_date||null, dl_passed: parseInt(editForm.dl_passed||'0'), dl_no: editForm.dl_no||'', status: editForm.status } as any)} disabled={updateStudent.isPending} className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50" style={{ background: '#2563eb' }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Fees */}
      <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Fees</h2>
        <div className="grid grid-cols-3 gap-3 text-sm mb-4">
          <div><p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Total</p><p className="font-bold" style={{ color: 'var(--text-primary)' }}>₹{student.fees_total.toLocaleString('en-IN')}</p></div>
          <div><p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Paid</p><p className="font-bold text-green-600">₹{student.fees_paid.toLocaleString('en-IN')}</p></div>
          <div><p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Due</p><p className={`font-bold ${due > 0 ? 'text-orange-600' : 'text-green-600'}`}>₹{due.toLocaleString('en-IN')}</p></div>
        </div>
        {due > 0 && (
          <div className="space-y-3 pt-3 border-t" style={{ borderColor: 'var(--surface-border)' }}>
            <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Record Payment</p>
            <div className="grid grid-cols-2 gap-3">
              <input type="number" className="input w-full text-sm" placeholder="Amount (₹)" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
              <select className="input w-full text-sm" value={payMode} onChange={e => setPayMode(e.target.value)}>
                {['cash','UPI','card','cheque'].map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
              </select>
            </div>
            <input className="input w-full text-sm" placeholder="Notes (optional)" value={payNotes} onChange={e => setPayNotes(e.target.value)} />
            <button onClick={() => recordPayment.mutate()} disabled={!payAmount || recordPayment.isPending} className="w-full py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50" style={{ background: '#2563eb' }}>
              <Plus className="inline h-4 w-4 mr-1" />Record Payment
            </button>
          </div>
        )}
        {payments.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Payment History</p>
            {payments.map(p => (
              <div key={p.id} className="flex justify-between text-xs rounded-lg px-3 py-2" style={{ background: 'var(--surface-2)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{p.date} · {p.payment_mode.toUpperCase()}</span>
                <span className="font-semibold text-green-600">₹{p.amount.toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sessions */}
      <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Sessions ({sessions.length})</h2>
        </div>
        {sessions.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: 'var(--text-tertiary)' }}>No sessions yet</p>
        ) : (
          <div className="space-y-2">
            {sessions.slice(0,10).map(s => (
              <div key={s.id} className="flex items-center justify-between text-sm rounded-lg px-3 py-2" style={{ background: 'var(--surface-2)' }}>
                <div>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{s.session_date}</p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{s.vehicle_reg ? `${s.vehicle_reg} · ` : ''}{s.instructor_name ?? ''} · {s.duration_mins}min</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${s.status === 'completed' ? 'text-green-600 bg-green-100' : s.status === 'cancelled' ? 'text-red-600 bg-red-100' : 'text-blue-600 bg-blue-100'}`}>{s.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

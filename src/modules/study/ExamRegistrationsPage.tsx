// [study] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ClipboardCheck } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listExamRegistrations, addExamRegistration, updateExamRegStatus, deleteExamRegistration, StudyExamRegistration } from '@/lib/db/study';

type Status = StudyExamRegistration['status'];

const STATUS_STYLE: Record<Status, { label: string; bg: string; color: string }> = {
  pending:    { label: 'Pending',    bg: '#fef3c7', color: '#d97706' },
  registered: { label: 'Registered', bg: '#dcfce7', color: '#16a34a' },
  missed:     { label: 'Missed',     bg: '#fee2e2', color: '#dc2626' },
};

function daysUntil(d: string) { return Math.ceil((new Date(d).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000); }

export function ExamRegistrationsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ exam_name:'', registration_deadline:'', exam_date:'', fee:'', status:'pending' as Status, notes:'' });

  const { data: regs = [] } = useQuery({ queryKey: ['study-regs', tenantId], queryFn: () => listExamRegistrations(tenantId), enabled: !!tenantId });

  const addMutation = useMutation({
    mutationFn: () => addExamRegistration(tenantId, { ...form, exam_date: form.exam_date || null, fee: form.fee.trim() || null, notes: form.notes.trim() || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['study-regs'] }); setShowAdd(false); setForm({ exam_name:'', registration_deadline:'', exam_date:'', fee:'', status:'pending', notes:'' }); },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Status }) => updateExamRegStatus(tenantId, id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study-regs'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteExamRegistration(tenantId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study-regs'] }),
  });

  const pending = regs.filter(r => r.status === 'pending');
  const urgent = pending.filter(r => daysUntil(r.registration_deadline) <= 7).length;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: '#ede9fe' }}>
            <ClipboardCheck className="h-5 w-5" style={{ color: '#7c3aed' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Exam Registrations</h1>
            <p className="text-xs" style={{ color: urgent > 0 ? '#dc2626' : 'var(--text-tertiary)' }}>
              {urgent > 0 ? `⚠️ ${urgent} deadline within 7 days!` : `${pending.length} pending registrations`}
            </p>
          </div>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white" style={{ background: 'var(--accent)' }}>
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>

      {regs.length === 0 && (
        <div className="rounded-2xl p-10 flex flex-col items-center gap-3 text-center" style={{ background: 'var(--surface)', border: '2px dashed var(--surface-border)' }}>
          <p className="text-4xl">📋</p>
          <p className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>No registrations tracked</p>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Track JEE, NEET, board exam registration deadlines</p>
        </div>
      )}

      <div className="space-y-3">
        {regs.map(r => {
          const days = daysUntil(r.registration_deadline);
          const ss = STATUS_STYLE[r.status];
          return (
            <div key={r.id} className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: `2px solid ${r.status === 'pending' && days <= 7 ? '#fecaca' : 'var(--surface-border)'}` }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate" style={{ color: 'var(--text-primary)' }}>{r.exam_name}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: ss.bg, color: ss.color }}>{ss.label}</span>
                    {r.fee && <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Fee: ₹{r.fee}</span>}
                  </div>
                </div>
                <button onClick={() => deleteMutation.mutate(r.id)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-red-50 text-red-400 flex-shrink-0">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-xl p-3" style={{ background: r.status === 'pending' && days <= 3 ? '#fee2e2' : 'var(--surface-2)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Registration Deadline</p>
                  <p className="font-bold text-sm" style={{ color: r.status === 'pending' && days <= 3 ? '#dc2626' : 'var(--text-primary)' }}>
                    {new Date(r.registration_deadline).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
                  </p>
                  {r.status === 'pending' && <p className="text-xs font-semibold" style={{ color: days <= 0 ? '#dc2626' : days <= 7 ? '#d97706' : '#16a34a' }}>
                    {days < 0 ? 'Overdue' : days === 0 ? 'Today!' : `${days}d left`}
                  </p>}
                </div>
                {r.exam_date && (
                  <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Exam Date</p>
                    <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{new Date(r.exam_date).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}</p>
                  </div>
                )}
              </div>

              {r.status === 'pending' && (
                <div className="flex gap-2 mt-3">
                  <button onClick={() => statusMutation.mutate({ id: r.id, status: 'registered' })}
                    className="flex-1 py-2 rounded-xl text-sm font-semibold" style={{ background: '#dcfce7', color: '#16a34a' }}>✓ Mark Registered</button>
                  <button onClick={() => statusMutation.mutate({ id: r.id, status: 'missed' })}
                    className="flex-1 py-2 rounded-xl text-sm font-semibold" style={{ background: '#f1f5f9', color: '#64748b' }}>Missed</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-3" style={{ background: 'var(--bg)' }}>
            <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Add Exam Registration</h2>
            <input value={form.exam_name} onChange={e => setForm(f=>({...f,exam_name:e.target.value}))} placeholder="Exam name (e.g. JEE Mains 2025)"
              className="w-full px-4 py-3 rounded-xl text-sm border outline-none" style={{ background:'var(--surface)',borderColor:'var(--surface-border)',color:'var(--text-primary)' }} />
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color:'var(--text-tertiary)' }}>Registration Deadline *</label>
              <input type="date" value={form.registration_deadline} onChange={e => setForm(f=>({...f,registration_deadline:e.target.value}))}
                className="w-full px-4 py-3 rounded-xl text-sm border outline-none" style={{ background:'var(--surface)',borderColor:'var(--surface-border)',color:'var(--text-primary)' }} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color:'var(--text-tertiary)' }}>Exam Date (optional)</label>
              <input type="date" value={form.exam_date} onChange={e => setForm(f=>({...f,exam_date:e.target.value}))}
                className="w-full px-4 py-3 rounded-xl text-sm border outline-none" style={{ background:'var(--surface)',borderColor:'var(--surface-border)',color:'var(--text-primary)' }} />
            </div>
            <input value={form.fee} onChange={e => setForm(f=>({...f,fee:e.target.value}))} placeholder="Fee (e.g. 1000)"
              className="w-full px-4 py-3 rounded-xl text-sm border outline-none" style={{ background:'var(--surface)',borderColor:'var(--surface-border)',color:'var(--text-primary)' }} />
            <div className="flex gap-3">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-3 rounded-xl font-semibold text-sm border" style={{ borderColor:'var(--surface-border)',color:'var(--text-secondary)' }}>Cancel</button>
              <button onClick={() => addMutation.mutate()} disabled={!form.exam_name.trim() || !form.registration_deadline || addMutation.isPending}
                className="flex-1 py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-50" style={{ background:'var(--accent)' }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// [study] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, GraduationCap } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listExams, addExam, deleteExam, StudyExam } from '@/lib/db/study';

function daysUntil(dateStr: string): number {
  const exam = new Date(dateStr); exam.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((exam.getTime() - today.getTime()) / 86400000);
}

function urgencyColor(days: number): { bg: string; color: string; label: string } {
  if (days < 0) return { bg: '#f1f5f9', color: '#94a3b8', label: 'Past' };
  if (days === 0) return { bg: '#fee2e2', color: '#dc2626', label: 'Today!' };
  if (days <= 3) return { bg: '#fee2e2', color: '#dc2626', label: `${days}d left` };
  if (days <= 7) return { bg: '#fef3c7', color: '#d97706', label: `${days}d left` };
  if (days <= 14) return { bg: '#dbeafe', color: '#2563eb', label: `${days}d left` };
  return { bg: '#dcfce7', color: '#16a34a', label: `${days}d left` };
}

export function ExamsPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ subject: '', exam_name: '', exam_date: '', notes: '' });

  const { data: exams = [] } = useQuery({
    queryKey: ['study-exams', tenantId],
    queryFn: () => listExams(tenantId),
    enabled: !!tenantId,
  });

  const addMutation = useMutation({
    mutationFn: () => addExam(tenantId, form.subject.trim(), form.exam_name.trim(), form.exam_date, form.notes.trim() || null),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['study-exams'] }); setShowAdd(false); setForm({ subject: '', exam_name: '', exam_date: '', notes: '' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteExam(tenantId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study-exams'] }),
  });

  const upcoming = exams.filter(e => daysUntil(e.exam_date) >= 0).sort((a, b) => daysUntil(a.exam_date) - daysUntil(b.exam_date));
  const past = exams.filter(e => daysUntil(e.exam_date) < 0);

  const nextExam = upcoming[0];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: '#fef3c7' }}>
            <GraduationCap className="h-5 w-5" style={{ color: '#d97706' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Exam Countdown</h1>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Track all upcoming exams</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white"
          style={{ background: 'var(--accent)' }}>
          <Plus className="h-4 w-4" /> Add Exam
        </button>
      </div>

      {/* Next exam hero card */}
      {nextExam && (() => {
        const days = daysUntil(nextExam.exam_date);
        const urg = urgencyColor(days);
        return (
          <div className="rounded-2xl p-6" style={{ background: urg.bg, border: `2px solid ${urg.color}20` }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: urg.color }}>Next Exam</p>
            <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{nextExam.exam_name}</h2>
            <p className="font-medium mt-0.5" style={{ color: 'var(--text-secondary)' }}>{nextExam.subject}</p>
            <div className="flex items-end gap-4 mt-4">
              <div>
                <p className="text-5xl font-black tabular-nums" style={{ color: urg.color }}>{days === 0 ? '🎯' : days}</p>
                {days > 0 && <p className="text-sm font-semibold mt-0.5" style={{ color: urg.color }}>days left</p>}
              </div>
              <div className="pb-1">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {new Date(nextExam.exam_date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* All upcoming */}
      {upcoming.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-bold text-sm" style={{ color: 'var(--text-secondary)' }}>Upcoming ({upcoming.length})</h2>
          {upcoming.map(exam => {
            const days = daysUntil(exam.exam_date);
            const urg = urgencyColor(days);
            return (
              <ExamCard key={exam.id} exam={exam} days={days} urg={urg} onDelete={() => deleteMutation.mutate(exam.id)} />
            );
          })}
        </div>
      )}

      {upcoming.length === 0 && (
        <div className="rounded-2xl p-10 flex flex-col items-center gap-3 text-center"
          style={{ background: 'var(--surface)', border: '2px dashed var(--surface-border)' }}>
          <p className="text-4xl">🎓</p>
          <p className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>No upcoming exams</p>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Add exams to track countdowns</p>
        </div>
      )}

      {/* Past exams */}
      {past.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-bold text-sm" style={{ color: 'var(--text-tertiary)' }}>Past ({past.length})</h2>
          {past.slice(0, 5).map(exam => {
            const days = daysUntil(exam.exam_date);
            const urg = urgencyColor(days);
            return <ExamCard key={exam.id} exam={exam} days={days} urg={urg} onDelete={() => deleteMutation.mutate(exam.id)} />;
          })}
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ background: 'var(--bg)' }}>
            <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Add Exam</h2>
            <div className="space-y-3">
              <input value={form.exam_name} onChange={e => setForm(f => ({ ...f, exam_name: e.target.value }))}
                placeholder="Exam name (e.g. Maths Unit Test)"
                className="w-full px-4 py-3 rounded-xl text-sm border outline-none"
                style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
              <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                placeholder="Subject"
                className="w-full px-4 py-3 rounded-xl text-sm border outline-none"
                style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-tertiary)' }}>Exam Date</label>
                <input type="date" value={form.exam_date} onChange={e => setForm(f => ({ ...f, exam_date: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl text-sm border outline-none"
                  style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
              </div>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Notes (optional)"
                rows={2}
                className="w-full px-4 py-3 rounded-xl text-sm border outline-none resize-none"
                style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAdd(false)}
                className="flex-1 py-3 rounded-xl font-semibold text-sm border"
                style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Cancel</button>
              <button onClick={() => addMutation.mutate()}
                disabled={!form.exam_name.trim() || !form.subject.trim() || !form.exam_date || addMutation.isPending}
                className="flex-1 py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-50"
                style={{ background: 'var(--accent)' }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ExamCard({ exam, days, urg, onDelete }: { exam: StudyExam; days: number; urg: { bg: string; color: string; label: string }; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl p-4"
      style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
      <div className="h-14 w-14 rounded-xl flex flex-col items-center justify-center flex-shrink-0"
        style={{ background: urg.bg }}>
        <p className="text-lg font-black tabular-nums leading-none" style={{ color: urg.color }}>
          {days < 0 ? '✓' : days === 0 ? '!' : days}
        </p>
        <p className="text-xs font-semibold mt-0.5" style={{ color: urg.color }}>
          {days < 0 ? 'done' : days === 0 ? 'today' : 'days'}
        </p>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold truncate" style={{ color: 'var(--text-primary)' }}>{exam.exam_name}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{exam.subject}</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
          {new Date(exam.exam_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </div>
      <button onClick={onDelete}
        className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

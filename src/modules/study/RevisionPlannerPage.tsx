// [study] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Map, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listExams, listChapters, getRevisionPlan, generateRevisionPlan, markRevisionDone } from '@/lib/db/study';

export function RevisionPlannerPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [selectedExamId, setSelectedExamId] = useState('');
  const [generating, setGenerating] = useState(false);

  const { data: exams = [] } = useQuery({ queryKey: ['study-exams', tenantId], queryFn: () => listExams(tenantId), enabled: !!tenantId });
  const { data: chapters = [] } = useQuery({ queryKey: ['study-chapters', tenantId], queryFn: () => listChapters(tenantId), enabled: !!tenantId });
  const { data: plan = [] } = useQuery({ queryKey: ['study-revision-plan', tenantId, selectedExamId], queryFn: () => getRevisionPlan(tenantId, selectedExamId || undefined), enabled: !!tenantId });

  const selectedExam = exams.find(e => e.id === selectedExamId);

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedExam) return;
      const relevantChapters = chapters.filter(c => c.subject === selectedExam.subject).map(c => c.chapter_name);
      if (!relevantChapters.length) throw new Error(`No chapters found for ${selectedExam.subject}. Add chapters in Chapter Checklist first.`);
      setGenerating(true);
      await generateRevisionPlan(tenantId, selectedExam.id, selectedExam.exam_date, selectedExam.subject, relevantChapters);
      qc.invalidateQueries({ queryKey: ['study-revision-plan'] });
    },
    onSettled: () => setGenerating(false),
  });

  const doneMutation = useMutation({
    mutationFn: (id: string) => markRevisionDone(tenantId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study-revision-plan'] }),
  });

  const today = new Date().toISOString().slice(0, 10);
  const grouped = plan.reduce<Record<string, typeof plan>>((acc, p) => {
    if (!acc[p.plan_date]) acc[p.plan_date] = [];
    acc[p.plan_date].push(p);
    return acc;
  }, {});

  const doneCount = plan.filter(p => p.status === 'done').length;
  const totalCount = plan.length;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: '#dbeafe' }}>
          <Map className="h-5 w-5" style={{ color: '#2563eb' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Revision Planner</h1>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Auto-schedule revision from exam date + your chapters</p>
        </div>
      </div>

      {exams.length === 0 && (
        <div className="rounded-2xl p-8 text-center" style={{ background: '#fef3c7', border: '2px solid #fde68a' }}>
          <p className="text-2xl mb-2">📅</p>
          <p className="font-bold" style={{ color: '#92400e' }}>No exams added yet</p>
          <p className="text-sm mt-1" style={{ color: '#b45309' }}>Add exams in the Exams page first, then come back here to auto-generate a revision plan</p>
        </div>
      )}

      {exams.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <label className="text-sm font-semibold block mb-2" style={{ color: 'var(--text-secondary)' }}>Select Exam</label>
          <select value={selectedExamId} onChange={e => setSelectedExamId(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm border outline-none"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}>
            <option value="">Choose an exam…</option>
            {exams.map(e => (
              <option key={e.id} value={e.id}>{e.exam_name} — {e.subject} ({e.exam_date})</option>
            ))}
          </select>

          {selectedExamId && (
            <div className="mt-4">
              {plan.length === 0 ? (
                <div className="text-center">
                  <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                    No plan yet for <strong>{selectedExam?.exam_name}</strong>. Generate one from your {selectedExam?.subject} chapters.
                  </p>
                  <button onClick={() => generateMutation.mutate()} disabled={generating || generateMutation.isPending}
                    className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white disabled:opacity-60 flex items-center gap-2 mx-auto"
                    style={{ background: 'var(--accent)' }}>
                    {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</> : '🗓️ Generate Revision Plan'}
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{doneCount}/{totalCount} sessions done</p>
                  <button onClick={() => generateMutation.mutate()} disabled={generating}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold border" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
                    Regenerate
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Plan by day */}
      {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([date, items]) => {
        const isToday = date === today;
        const isPast = date < today;
        const allDone = items.every(i => i.status === 'done');
        return (
          <div key={date} className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--surface)', border: isToday ? '2px solid var(--accent)' : '1px solid var(--surface-border)', opacity: isPast && allDone ? 0.65 : 1 }}>
            <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: isToday ? 'var(--accent-soft)' : 'var(--surface-2)', borderBottom: '1px solid var(--surface-border)' }}>
              <p className="font-bold text-sm" style={{ color: isToday ? 'var(--accent)' : 'var(--text-primary)' }}>
                {isToday ? '⭐ Today — ' : ''}{new Date(date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
              </p>
              <span className="ml-auto text-xs font-semibold" style={{ color: allDone ? '#16a34a' : 'var(--text-tertiary)' }}>{items.filter(i => i.status === 'done').length}/{items.length}</span>
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--surface-border)' }}>
              {items.map(item => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <button onClick={() => item.status === 'pending' && doneMutation.mutate(item.id)}
                    style={{ color: item.status === 'done' ? '#16a34a' : 'var(--text-tertiary)' }}>
                    {item.status === 'done' ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                  </button>
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)', textDecoration: item.status === 'done' ? 'line-through' : 'none' }}>
                      {item.chapter_or_topic}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{item.subject}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

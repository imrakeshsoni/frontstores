// [study] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Target } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listGoals, addGoal, deleteGoal, getGoalProgress, StudyGoal } from '@/lib/db/study';

function GoalCard({ goal, tenantId, onDelete }: { goal: StudyGoal; tenantId: string; onDelete: () => void }) {
  const { data: achieved = 0 } = useQuery({
    queryKey: ['study-goal-progress', goal.id],
    queryFn: () => getGoalProgress(tenantId, goal),
  });

  const pct = Math.min(100, Math.round((achieved / (goal.target_minutes || 1)) * 100));
  const done = pct >= 100;

  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: done ? '2px solid #16a34a' : '1px solid var(--surface-border)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{goal.title}</p>
            {done && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#dcfce7', color: '#16a34a' }}>Done! 🎉</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {goal.subject && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--text-tertiary)' }}>{goal.subject}</span>}
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{goal.period === 'weekly' ? 'This week' : 'This month'}</span>
          </div>
        </div>
        <button onClick={onDelete} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-red-50 text-red-400 hover:text-red-600 flex-shrink-0">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-xs mb-1.5">
          <span style={{ color: 'var(--text-secondary)' }}>{achieved}m / {goal.target_minutes}m</span>
          <span className="font-bold" style={{ color: done ? '#16a34a' : 'var(--accent)' }}>{pct}%</span>
        </div>
        <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: done ? '#16a34a' : 'var(--accent)' }} />
        </div>
      </div>
    </div>
  );
}

export function GoalsPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', subject: '', target_hours: '2', period: 'weekly' as 'weekly' | 'monthly' });

  const { data: goals = [] } = useQuery({
    queryKey: ['study-goals', tenantId],
    queryFn: () => listGoals(tenantId),
    enabled: !!tenantId,
  });

  const addMutation = useMutation({
    mutationFn: () => addGoal(tenantId, form.title.trim(), form.subject.trim() || null, Math.round(parseFloat(form.target_hours) * 60), form.period),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['study-goals'] }); setShowAdd(false); setForm({ title: '', subject: '', target_hours: '2', period: 'weekly' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteGoal(tenantId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study-goals'] }),
  });

  const weekly = goals.filter(g => g.period === 'weekly');
  const monthly = goals.filter(g => g.period === 'monthly');

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: '#dbeafe' }}>
            <Target className="h-5 w-5" style={{ color: '#2563eb' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Study Goals</h1>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Set weekly & monthly study targets</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white"
          style={{ background: 'var(--accent)' }}>
          <Plus className="h-4 w-4" /> Add Goal
        </button>
      </div>

      {goals.length === 0 && (
        <div className="rounded-2xl p-10 flex flex-col items-center gap-3 text-center"
          style={{ background: 'var(--surface)', border: '2px dashed var(--surface-border)' }}>
          <p className="text-4xl">🎯</p>
          <p className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>No goals yet</p>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Set a study goal to stay motivated</p>
        </div>
      )}

      {weekly.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-bold text-sm" style={{ color: 'var(--text-secondary)' }}>This Week</h2>
          {weekly.map(g => <GoalCard key={g.id} goal={g} tenantId={tenantId} onDelete={() => deleteMutation.mutate(g.id)} />)}
        </div>
      )}

      {monthly.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-bold text-sm" style={{ color: 'var(--text-secondary)' }}>This Month</h2>
          {monthly.map(g => <GoalCard key={g.id} goal={g} tenantId={tenantId} onDelete={() => deleteMutation.mutate(g.id)} />)}
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ background: 'var(--bg)' }}>
            <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>New Goal</h2>
            <div className="space-y-3">
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Goal title (e.g. Study 10 hours this week)"
                className="w-full px-4 py-3 rounded-xl text-sm border outline-none"
                style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
              <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                placeholder="Subject (optional — leave blank for all)"
                className="w-full px-4 py-3 rounded-xl text-sm border outline-none"
                style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-tertiary)' }}>Target study hours</label>
                <input type="number" min="0.5" max="100" step="0.5" value={form.target_hours}
                  onChange={e => setForm(f => ({ ...f, target_hours: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl text-sm border outline-none"
                  style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-2" style={{ color: 'var(--text-tertiary)' }}>Period</label>
                <div className="flex gap-2">
                  {(['weekly', 'monthly'] as const).map(p => (
                    <button key={p} onClick={() => setForm(f => ({ ...f, period: p }))}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold capitalize transition-all"
                      style={form.period === p
                        ? { background: 'var(--accent)', color: '#fff' }
                        : { background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAdd(false)}
                className="flex-1 py-3 rounded-xl font-semibold text-sm border"
                style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Cancel</button>
              <button onClick={() => addMutation.mutate()}
                disabled={!form.title.trim() || !form.target_hours || addMutation.isPending}
                className="flex-1 py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-50"
                style={{ background: 'var(--accent)' }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

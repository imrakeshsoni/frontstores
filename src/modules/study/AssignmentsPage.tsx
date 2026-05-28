// [study] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, CheckCircle2, Circle, ClipboardCheck } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listAssignments, addAssignment, toggleAssignment, deleteAssignment, StudyAssignment } from '@/lib/db/study';

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / 86400000);
}

function dueBadge(days: number | null): { label: string; bg: string; color: string } | null {
  if (days === null) return null;
  if (days < 0) return { label: 'Overdue', bg: '#fee2e2', color: '#dc2626' };
  if (days === 0) return { label: 'Due today', bg: '#fee2e2', color: '#dc2626' };
  if (days === 1) return { label: 'Due tomorrow', bg: '#fef3c7', color: '#d97706' };
  if (days <= 3) return { label: `Due in ${days}d`, bg: '#fef3c7', color: '#d97706' };
  return { label: `Due ${new Date(Date.now() + days * 86400000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`, bg: '#f1f5f9', color: '#64748b' };
}

export function AssignmentsPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState<'pending' | 'done'>('pending');
  const [form, setForm] = useState({ subject: '', title: '', due_date: '', notes: '' });

  const { data: assignments = [] } = useQuery({
    queryKey: ['study-assignments', tenantId],
    queryFn: () => listAssignments(tenantId),
    enabled: !!tenantId,
  });

  const addMutation = useMutation({
    mutationFn: () => addAssignment(tenantId, form.subject.trim(), form.title.trim(), form.due_date || null, form.notes.trim() || null),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['study-assignments'] }); setShowAdd(false); setForm({ subject: '', title: '', due_date: '', notes: '' }); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'pending' | 'done' }) => toggleAssignment(tenantId, id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study-assignments'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAssignment(tenantId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study-assignments'] }),
  });

  const pending = assignments.filter(a => a.status === 'pending');
  const done = assignments.filter(a => a.status === 'done');
  const shown = filter === 'pending' ? pending : done;

  const overdueCount = pending.filter(a => { const d = daysUntil(a.due_date); return d !== null && d < 0; }).length;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: '#dcfce7' }}>
            <ClipboardCheck className="h-5 w-5" style={{ color: '#16a34a' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Assignments</h1>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {pending.length} pending{overdueCount > 0 ? `, ${overdueCount} overdue` : ''}
            </p>
          </div>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white"
          style={{ background: 'var(--accent)' }}>
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['pending', 'done'] as const).map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className="px-5 py-2 rounded-xl text-sm font-semibold transition-all capitalize"
            style={filter === t
              ? { background: 'var(--accent)', color: '#fff' }
              : { background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
            {t} {t === 'pending' ? `(${pending.length})` : `(${done.length})`}
          </button>
        ))}
      </div>

      {/* Assignment list */}
      <div className="space-y-3">
        {shown.length === 0 && (
          <div className="rounded-2xl p-10 flex flex-col items-center gap-3 text-center"
            style={{ background: 'var(--surface)', border: '2px dashed var(--surface-border)' }}>
            <p className="text-4xl">{filter === 'pending' ? '📋' : '🎉'}</p>
            <p className="font-bold" style={{ color: 'var(--text-primary)' }}>
              {filter === 'pending' ? 'No pending assignments' : 'No completed assignments yet'}
            </p>
          </div>
        )}
        {shown.map(a => {
          const days = daysUntil(a.due_date);
          const badge = dueBadge(days);
          return (
            <div key={a.id} className="flex items-center gap-4 rounded-2xl p-4 transition-opacity"
              style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', opacity: a.status === 'done' ? 0.65 : 1 }}>
              <button onClick={() => toggleMutation.mutate({ id: a.id, status: a.status === 'pending' ? 'done' : 'pending' })}
                className="flex-shrink-0 transition-colors" style={{ color: a.status === 'done' ? '#16a34a' : 'var(--text-tertiary)' }}>
                {a.status === 'done' ? <CheckCircle2 className="h-6 w-6" /> : <Circle className="h-6 w-6" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold ${a.status === 'done' ? 'line-through' : ''}`} style={{ color: 'var(--text-primary)' }}>{a.title}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{a.subject}</p>
                {badge && (
                  <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
                )}
              </div>
              <button onClick={() => deleteMutation.mutate(a.id)}
                className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors flex-shrink-0">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ background: 'var(--bg)' }}>
            <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Add Assignment</h2>
            <div className="space-y-3">
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Assignment title"
                className="w-full px-4 py-3 rounded-xl text-sm border outline-none"
                style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
              <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                placeholder="Subject"
                className="w-full px-4 py-3 rounded-xl text-sm border outline-none"
                style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-tertiary)' }}>Due Date (optional)</label>
                <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
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
                disabled={!form.title.trim() || !form.subject.trim() || addMutation.isPending}
                className="flex-1 py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-50"
                style={{ background: 'var(--accent)' }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// [study] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Timer, Plus, Flame, BookOpen } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import {
  logSession, getSessionsByDate, getStreak, getTodayStudyTime, getWeeklySubjectBreakdown,
  getStreakFreeze, awardFreezeToken, useFreezeToken, addXP,
} from '@/lib/db/study';

const SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography', 'English', 'Economics', 'Science', 'Hindi', 'Other'];
const DURATIONS = [15, 30, 45, 60, 90, 120];
function minToHr(m: number) { if (m < 60) return `${m} min`; return `${Math.floor(m / 60)}h ${m % 60 > 0 ? m % 60 + 'm' : ''}`; }

export function StudyTrackerPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [subject, setSubject]   = useState(SUBJECTS[0]);
  const [duration, setDuration] = useState(30);
  const [notes, setNotes]       = useState('');
  const [showForm, setShowForm] = useState(false);
  const [viewDate, setViewDate] = useState(new Date().toISOString().slice(0, 10));

  const { data: streak }   = useQuery({ queryKey: ['study-streak', tenantId], queryFn: () => getStreak(tenantId), enabled: !!tenantId });
  const { data: todayMin } = useQuery({ queryKey: ['study-today', tenantId], queryFn: () => getTodayStudyTime(tenantId), enabled: !!tenantId });
  const { data: weekly }   = useQuery({ queryKey: ['study-subjects', tenantId], queryFn: () => getWeeklySubjectBreakdown(tenantId), enabled: !!tenantId });
  const { data: freeze }   = useQuery({ queryKey: ['study-freeze', tenantId], queryFn: () => getStreakFreeze(tenantId), enabled: !!tenantId });
  const { data: sessions = [] } = useQuery({
    queryKey: ['study-sessions', tenantId, viewDate],
    queryFn: () => {
      const from = new Date(viewDate); from.setDate(from.getDate() - 6);
      return getSessionsByDate(tenantId, from.toISOString().slice(0, 10), viewDate);
    },
    enabled: !!tenantId,
  });

  const logMutation = useMutation({
    mutationFn: async () => {
      await logSession(tenantId, subject, duration, notes || null);
      await addXP(tenantId, 'session_logged');
      // Award freeze token every 7-day streak milestone
      if (streak && streak.current > 0 && streak.current % 7 === 0) {
        await awardFreezeToken(tenantId);
      }
    },
    onSuccess: () => {
      toast.success(`Logged ${minToHr(duration)} of ${subject}`);
      setShowForm(false); setNotes('');
      qc.invalidateQueries({ queryKey: ['study-sessions'] });
      qc.invalidateQueries({ queryKey: ['study-today'] });
      qc.invalidateQueries({ queryKey: ['study-streak'] });
      qc.invalidateQueries({ queryKey: ['study-subjects'] });
      qc.invalidateQueries({ queryKey: ['study-xp'] });
      qc.invalidateQueries({ queryKey: ['study-freeze'] });
    },
    onError: (e: any) => toast.error(e?.message),
  });

  const freezeMutation = useMutation({
    mutationFn: () => useFreezeToken(tenantId),
    onSuccess: (used) => {
      if (used) { toast.success('Streak freeze used! Your streak is protected.'); qc.invalidateQueries({ queryKey: ['study-freeze'] }); }
      else toast.error('No freeze tokens available');
    },
  });

  const grouped: Record<string, typeof sessions> = {};
  for (const s of sessions) {
    if (!grouped[s.session_date]) grouped[s.session_date] = [];
    grouped[s.session_date].push(s);
  }

  const maxMin = Math.max(...(weekly?.map(s => s.minutes) ?? []), 1);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>StudyMate</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Study Tracker</h1>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white"
          style={{ background: 'var(--accent)' }}>
          <Plus className="h-4 w-4" /> Log Session
        </button>
      </div>

      {/* Streak cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: '#fef3c7', color: '#d97706' }}><Flame size={18} /></div>
          <div><p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Current Streak</p><p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{streak?.current ?? 0} 🔥</p></div>
        </div>
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: '#ede9fe', color: '#7c3aed' }}><Flame size={18} /></div>
          <div><p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Best Streak</p><p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{streak?.longest ?? 0} days</p></div>
        </div>
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: '#dbeafe', color: '#2563eb' }}><Timer size={18} /></div>
          <div><p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Today</p><p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{minToHr(todayMin ?? 0)}</p></div>
        </div>
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: '#dcfce7', color: '#16a34a' }}><BookOpen size={18} /></div>
          <div><p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Total Days</p><p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{streak?.totalDays ?? 0}</p></div>
        </div>
      </div>

      {/* Streak Freeze */}
      <div className="rounded-2xl p-4 flex items-center gap-4" style={{ background: '#dbeafe', border: '1px solid #93c5fd' }}>
        <span className="text-2xl">🧊</span>
        <div className="flex-1">
          <p className="font-bold text-sm" style={{ color: '#1e40af' }}>Streak Freeze</p>
          <p className="text-xs" style={{ color: '#2563eb' }}>
            {freeze?.tokens ?? 0} token{(freeze?.tokens ?? 0) !== 1 ? 's' : ''} available · Earn 1 every 7-day streak · Protects 1 missed day
          </p>
        </div>
        {(freeze?.tokens ?? 0) > 0 && (
          <button onClick={() => freezeMutation.mutate()} disabled={freezeMutation.isPending}
            className="px-4 py-2 rounded-xl text-sm font-bold text-white flex-shrink-0 disabled:opacity-60"
            style={{ background: '#2563eb' }}>Use Freeze</button>
        )}
      </div>

      {/* Weekly subject chart */}
      {weekly && weekly.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>This Week by Subject</h2>
          <div className="space-y-3">
            {weekly.map(s => (
              <div key={s.subject}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{s.subject}</span>
                  <span style={{ color: 'var(--text-tertiary)' }}>{minToHr(s.minutes)}</span>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                  <div className="h-full rounded-full" style={{ width: `${(s.minutes / maxMin) * 100}%`, background: 'var(--accent)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Session history */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Recent Sessions</h2>
          <input type="date" value={viewDate} onChange={e => setViewDate(e.target.value)}
            className="rounded-xl border px-3 py-1.5 text-sm outline-none"
            style={{ borderColor: 'var(--surface-border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
        </div>
        {Object.keys(grouped).length === 0 && (
          <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <p className="text-3xl mb-2">📚</p>
            <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>No sessions logged yet</p>
            <button onClick={() => setShowForm(true)} className="mt-3 px-5 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>Log Your First Session</button>
          </div>
        )}
        {Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0])).map(([date, svcs]) => (
          <div key={date} className="mb-4">
            <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
              {date === new Date().toISOString().slice(0, 10) ? 'Today' : new Date(date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
              {' · '}{minToHr(svcs.reduce((s, x) => s + x.duration_minutes, 0))} total
            </p>
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
              {svcs.map((s, idx) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3"
                  style={{ borderBottom: idx < svcs.length - 1 ? '1px solid var(--surface-border)' : 'none' }}>
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--surface-2)' }}>
                    <BookOpen className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{s.subject}</p>
                    {s.notes && <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>{s.notes}</p>}
                  </div>
                  <span className="text-sm font-bold flex-shrink-0" style={{ color: 'var(--accent)' }}>{minToHr(s.duration_minutes)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Log session modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="rounded-2xl p-6 w-full max-w-sm space-y-4" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Log Study Session</h2>
              <button onClick={() => setShowForm(false)} className="text-sm px-3 py-1.5 rounded-lg border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Close</button>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Subject</label>
              <select value={subject} onChange={e => setSubject(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }}>
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Duration</label>
              <div className="grid grid-cols-3 gap-2">
                {DURATIONS.map(d => (
                  <button key={d} onClick={() => setDuration(d)}
                    className="py-2 rounded-xl text-sm font-semibold border transition-all"
                    style={duration === d ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: 'white' } : { borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                    {minToHr(d)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Notes (optional)</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="What did you study?"
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
            </div>
            <button onClick={() => logMutation.mutate()} disabled={logMutation.isPending}
              className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-60" style={{ background: 'var(--accent)' }}>
              {logMutation.isPending ? 'Logging…' : `Log ${minToHr(duration)} of ${subject}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// [study] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Lock, Unlock, BookOpen, Flame, ClipboardList, Brain, Printer } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import {
  getStudyConfig, saveStudyConfig, getStreak, getTodayStudyTime,
  getWeeklySubjectBreakdown, getTestStats, listMockTests,
} from '@/lib/db/study';

function minToHr(m: number) { if (!m) return '0 min'; if (m < 60) return `${m} min`; return `${Math.floor(m / 60)}h ${m % 60 > 0 ? m % 60 + 'm' : ''}`; }

export function ParentReportPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin]           = useState('');
  const [settingPin, setSettingPin] = useState(false);
  const [newPin, setNewPin]     = useState('');
  const [error, setError]       = useState('');

  const { data: config } = useQuery({ queryKey: ['study-config', tenantId], queryFn: () => getStudyConfig(tenantId), enabled: !!tenantId });
  const { data: streak } = useQuery({ queryKey: ['study-streak', tenantId], queryFn: () => getStreak(tenantId), enabled: !!tenantId && unlocked });
  const { data: todayMin } = useQuery({ queryKey: ['study-today', tenantId], queryFn: () => getTodayStudyTime(tenantId), enabled: !!tenantId && unlocked });
  const { data: weekly }  = useQuery({ queryKey: ['study-subjects', tenantId], queryFn: () => getWeeklySubjectBreakdown(tenantId), enabled: !!tenantId && unlocked });
  const { data: testStats } = useQuery({ queryKey: ['study-test-stats', tenantId], queryFn: () => getTestStats(tenantId), enabled: !!tenantId && unlocked });
  const { data: tests = [] } = useQuery({ queryKey: ['study-tests', tenantId], queryFn: () => listMockTests(tenantId), enabled: !!tenantId && unlocked });

  const setPinMutation = useMutation({
    mutationFn: () => saveStudyConfig(tenantId, { parent_pin: newPin }),
    onSuccess: () => { setSettingPin(false); setNewPin(''); setUnlocked(true); },
  });

  function handleUnlock() {
    if (!config?.parent_pin) { setUnlocked(true); return; }
    if (pin === config.parent_pin) { setUnlocked(true); setError(''); }
    else { setError('Wrong PIN. Try again.'); }
  }

  const maxMin = Math.max(...(weekly?.map(s => s.minutes) ?? []), 1);
  const recentTests = tests.slice(0, 5);
  const studentName = config?.student_name || 'Your child';

  // ── Lock screen ─────────────────────────────────────────────────────────────
  if (!unlocked) return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
      <div className="text-center">
        <div className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--surface-2)' }}>
          <Lock className="h-8 w-8" style={{ color: 'var(--accent)' }} />
        </div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Parent View</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
          {config?.parent_pin ? 'Enter your PIN to view the report' : 'No PIN set — tap to view'}
        </p>
      </div>

      {config?.parent_pin ? (
        <div className="w-full max-w-xs space-y-3">
          <input type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder="Enter PIN"
            onKeyDown={e => e.key === 'Enter' && handleUnlock()}
            className="w-full rounded-xl border px-4 py-3 text-center text-lg tracking-widest outline-none"
            style={{ borderColor: 'var(--surface-border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
          {error && <p className="text-xs text-center text-red-500">{error}</p>}
          <button onClick={handleUnlock} className="w-full py-3 rounded-xl font-bold text-sm text-white" style={{ background: 'var(--accent)' }}>
            <Unlock className="inline h-4 w-4 mr-2" />Unlock
          </button>
        </div>
      ) : (
        <div className="w-full max-w-xs space-y-3">
          {!settingPin ? (
            <>
              <button onClick={() => setUnlocked(true)} className="w-full py-3 rounded-xl font-bold text-sm text-white" style={{ background: 'var(--accent)' }}>View Report</button>
              <button onClick={() => setSettingPin(true)} className="w-full py-2.5 rounded-xl font-semibold text-sm border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Set a PIN</button>
            </>
          ) : (
            <>
              <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>Set a 4–6 digit PIN for parent view</p>
              <input type="password" value={newPin} onChange={e => setNewPin(e.target.value)} placeholder="Enter new PIN" maxLength={6}
                className="w-full rounded-xl border px-4 py-3 text-center text-lg tracking-widest outline-none"
                style={{ borderColor: 'var(--surface-border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
              <button onClick={() => setPinMutation.mutate()} disabled={newPin.length < 4}
                className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-50" style={{ background: 'var(--accent)' }}>Save PIN & Open</button>
            </>
          )}
        </div>
      )}
    </div>
  );

  // ── Report screen ─────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Parent View</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{studentName}'s Report</h1>
          {config?.class_grade && <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Class {config.class_grade} · {config.school || ''}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--surface)' }}>
            <Printer className="h-4 w-4" /> Export PDF
          </button>
          <button onClick={() => { setUnlocked(false); setPin(''); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border"
            style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>
            <Lock className="h-4 w-4" /> Lock
          </button>
        </div>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Flame size={18} />} bg="#fef3c7" color="#d97706"
          label="Study Streak" value={`${streak?.current ?? 0} days`} sub={`Best: ${streak?.longest ?? 0} days`} />
        <StatCard icon={<BookOpen size={18} />} bg="#dbeafe" color="#2563eb"
          label="Today" value={minToHr(todayMin ?? 0)} sub="studied today" />
        <StatCard icon={<ClipboardList size={18} />} bg="#dcfce7" color="#16a34a"
          label="Tests Done" value={String(testStats?.completed ?? 0)} sub={testStats?.avg_score ? `Avg ${Math.round(testStats.avg_score)}%` : '—'} />
        <StatCard icon={<Brain size={18} />} bg="#ede9fe" color="#7c3aed"
          label="Days Studied" value={String(streak?.totalDays ?? 0)} sub="total" />
      </div>

      {/* Subject breakdown */}
      {weekly && weekly.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>This Week — Time per Subject</h2>
          <div className="space-y-3">
            {weekly.map(s => (
              <div key={s.subject}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{s.subject}</span>
                  <span className="font-semibold" style={{ color: 'var(--accent)' }}>{minToHr(s.minutes)}</span>
                </div>
                <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                  <div className="h-full rounded-full" style={{ width: `${(s.minutes / maxMin) * 100}%`, background: 'var(--accent)' }} />
                </div>
              </div>
            ))}
          </div>
          {weekly.length === 0 && <p className="text-sm text-center py-4" style={{ color: 'var(--text-tertiary)' }}>No study sessions logged this week</p>}
        </div>
      )}

      {/* Recent test results */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <div className="px-4 py-3" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--surface-border)' }}>
          <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Recent Mock Tests</p>
        </div>
        {recentTests.length === 0 && (
          <p className="text-sm text-center py-6" style={{ color: 'var(--text-tertiary)' }}>No tests taken yet</p>
        )}
        {recentTests.map((t, idx) => {
          const pct = t.score !== null ? Math.round((t.score / t.total_questions) * 100) : null;
          return (
            <div key={t.id} className="flex items-center gap-4 px-4 py-3"
              style={{ borderBottom: idx < recentTests.length - 1 ? '1px solid var(--surface-border)' : 'none' }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t.subject} · {t.chapter || 'General'}</p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t.total_questions} questions · {new Date(t.created_at).toLocaleDateString('en-IN')}</p>
              </div>
              {pct !== null ? (
                <div className="text-right">
                  <p className="font-bold text-sm" style={{ color: pct >= 80 ? '#16a34a' : pct >= 60 ? '#d97706' : '#dc2626' }}>{pct}%</p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t.score}/{t.total_questions}</p>
                </div>
              ) : (
                <span className="text-xs px-2 py-1 rounded-full" style={{ background: '#fef3c7', color: '#d97706' }}>Pending</span>
              )}
            </div>
          );
        })}
      </div>

      {/* PIN management */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <p className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Change Parent PIN</p>
        <div className="flex gap-3">
          <input type="password" value={newPin} onChange={e => setNewPin(e.target.value)} placeholder="New PIN (4–6 digits)" maxLength={6}
            className="flex-1 rounded-xl border px-3 py-2 text-sm outline-none"
            style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
          <button onClick={() => setPinMutation.mutate()} disabled={newPin.length < 4}
            className="px-4 py-2 rounded-xl font-semibold text-sm text-white disabled:opacity-50" style={{ background: 'var(--accent)' }}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, bg, color, label, value, sub }: { icon: React.ReactNode; bg: string; color: string; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
      <div className="flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: bg, color }}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
        <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
        {sub && <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{sub}</p>}
      </div>
    </div>
  );
}

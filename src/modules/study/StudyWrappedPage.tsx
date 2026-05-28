// [study] [all tenants]
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { getMonthlyReport, getEarnedBadges, getTotalXP, xpToLevel, getStreak } from '@/lib/db/study';

const BADGE_EMOJI: Record<string, string> = {
  streak_3: '🔥', streak_7: '🏆', streak_14: '⚡', streak_30: '👑',
  first_test: '📝', test_10: '🎯', test_50: '💎',
  first_session: '🌱', session_10: '📚', session_50: '🦋',
  hour_1: '⏰', hour_10: '🕐', hour_50: '🚀',
};

const BADGE_LABELS: Record<string, string> = {
  streak_3: '3-Day Streak', streak_7: '7-Day Streak', streak_14: '14-Day Streak', streak_30: '30-Day Streak',
  first_test: 'First Test', test_10: '10 Tests', test_50: '50 Tests',
  first_session: 'First Session', session_10: '10 Sessions', session_50: '50 Sessions',
  hour_1: '1 Hour Studied', hour_10: '10 Hours Studied', hour_50: '50 Hours Studied',
};

function minToHr(m: number) {
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function StudyWrappedPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const yearMonth = `${year}-${String(month).padStart(2, '0')}`;

  const { data: report } = useQuery({
    queryKey: ['monthly-report', tenantId, yearMonth],
    queryFn: () => getMonthlyReport(tenantId, yearMonth),
    enabled: !!tenantId,
  });
  const { data: badges = [] } = useQuery({
    queryKey: ['study-badges', tenantId],
    queryFn: () => getEarnedBadges(tenantId),
    enabled: !!tenantId,
  });
  const { data: totalXP = 0 } = useQuery({
    queryKey: ['study-xp', tenantId],
    queryFn: () => getTotalXP(tenantId),
    enabled: !!tenantId,
  });
  const { data: streak } = useQuery({
    queryKey: ['study-streak', tenantId],
    queryFn: () => getStreak(tenantId),
    enabled: !!tenantId,
  });

  const level = xpToLevel(totalXP);
  const topSubject = report?.subjects?.[0]?.subject ?? '—';
  const monthName = new Date(year, month - 1, 1).toLocaleString('en-IN', { month: 'long' });

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (year === now.getFullYear() && month === now.getMonth() + 1) return;
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  function copyShareText() {
    const text = `📚 My StudyMate ${monthName} ${year} Report
⏱️ Total Study Time: ${minToHr(report?.total_minutes ?? 0)}
📅 Sessions: ${report?.sessions ?? 0}
📆 Active Days: ${report?.streak_days ?? 0}
📝 Tests Done: ${report?.tests_done ?? 0}
📊 Avg Score: ${report?.avg_test_score ?? 0}%
🏆 Top Subject: ${topSubject}
⭐ Level: ${level.level} (${level.title})
🔥 Streak: ${streak?.current ?? 0} days

Keep learning with StudyMate!`;
    navigator.clipboard.writeText(text);
    toast.success('Summary copied to clipboard!');
  }

  const STAT_CARDS = [
    { emoji: '⏱️', label: 'Total Study Time', value: minToHr(report?.total_minutes ?? 0), bg: '#dbeafe', color: '#2563eb' },
    { emoji: '📅', label: 'Study Sessions', value: String(report?.sessions ?? 0), bg: '#dcfce7', color: '#16a34a' },
    { emoji: '📆', label: 'Active Days', value: String(report?.streak_days ?? 0), bg: '#fef3c7', color: '#d97706' },
    { emoji: '📝', label: 'Tests Done', value: String(report?.tests_done ?? 0), bg: '#ede9fe', color: '#7c3aed' },
    { emoji: '📊', label: 'Avg Test Score', value: report?.tests_done ? `${report.avg_test_score}%` : '—', bg: '#fce7f3', color: '#be185d' },
    { emoji: '🏆', label: 'Top Subject', value: topSubject, bg: '#ccfbf1', color: '#0d9488' },
    { emoji: '⭐', label: 'Current Level', value: `Lv.${level.level} ${level.title}`, bg: '#fef9c3', color: '#b45309' },
    { emoji: '🔥', label: 'Current Streak', value: `${streak?.current ?? 0} days`, bg: '#fee2e2', color: '#dc2626' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Month Nav */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Study Wrapped</h1>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Your monthly learning highlights</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="h-9 w-9 rounded-xl flex items-center justify-center border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}>‹</button>
          <span className="font-bold text-sm w-28 text-center" style={{ color: 'var(--text-primary)' }}>{monthName} {year}</span>
          <button onClick={nextMonth} disabled={isCurrentMonth} className="h-9 w-9 rounded-xl flex items-center justify-center border disabled:opacity-40" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}>›</button>
        </div>
      </div>

      {/* Hero card */}
      <div className="rounded-3xl p-7 text-center space-y-2 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, var(--accent) 0%, #7c3aed 100%)' }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 80%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <p className="text-5xl mb-2">📚</p>
        <h2 className="text-2xl font-black text-white">{monthName} {year}</h2>
        <p className="text-white/80 text-sm">Your Study Wrapped is here!</p>
        <div className="mt-4 inline-block px-6 py-2 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }}>
          <p className="text-white font-black text-xl">{minToHr(report?.total_minutes ?? 0)}</p>
          <p className="text-white/80 text-xs">total study time</p>
        </div>
      </div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {STAT_CARDS.map(card => (
          <div key={card.label} className="rounded-2xl p-4 flex flex-col items-start gap-2" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <div className="h-12 w-12 rounded-2xl flex items-center justify-center text-2xl" style={{ background: card.bg }}>{card.emoji}</div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{card.label}</p>
              <p className="font-black text-lg leading-tight" style={{ color: card.color }}>{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Subject breakdown */}
      {report && report.subjects.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Time by Subject</h2>
          <div className="space-y-3">
            {(() => {
              const max = Math.max(...report.subjects.map(s => s.minutes), 1);
              const colors = ['#2563eb', '#7c3aed', '#16a34a', '#d97706', '#dc2626', '#0d9488'];
              return report.subjects.map((s, i) => (
                <div key={s.subject}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{s.subject}</span>
                    <span style={{ color: 'var(--text-tertiary)' }}>{minToHr(s.minutes)}</span>
                  </div>
                  <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                    <div className="h-full rounded-full" style={{ width: `${(s.minutes / max) * 100}%`, background: colors[i % colors.length] }} />
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* Badges */}
      {badges.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Badges Earned</h2>
          <div className="flex flex-wrap gap-3">
            {badges.map(b => (
              <div key={b} className="flex flex-col items-center gap-1 p-3 rounded-2xl" style={{ background: 'var(--surface-2)', minWidth: 72 }}>
                <span className="text-2xl">{BADGE_EMOJI[b] ?? '🏅'}</span>
                <p className="text-xs text-center font-semibold" style={{ color: 'var(--text-secondary)' }}>{BADGE_LABELS[b] ?? b}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* XP Card */}
      <div className="rounded-2xl p-5 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <div className="flex items-center gap-3">
          <span className="text-3xl">⭐</span>
          <div>
            <p className="font-black text-xl" style={{ color: 'var(--text-primary)' }}>Level {level.level} — {level.title}</p>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{totalXP} total XP · {level.xpNeeded - level.xpInLevel} XP to next level</p>
          </div>
        </div>
        <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
          <div className="h-full rounded-full" style={{ width: `${Math.round((level.xpInLevel / level.xpNeeded) * 100)}%`, background: 'linear-gradient(90deg, var(--accent), #7c3aed)' }} />
        </div>
      </div>

      {/* Share */}
      <button onClick={copyShareText}
        className="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2"
        style={{ background: 'linear-gradient(90deg, var(--accent), #7c3aed)', color: '#fff' }}>
        📋 Copy Share Summary
      </button>
    </div>
  );
}

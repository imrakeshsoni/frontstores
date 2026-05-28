// [study] [all tenants]
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getEarnedBadges, checkAndAwardBadges } from '@/lib/db/study';

interface BadgeDef {
  key: string;
  icon: string;
  title: string;
  description: string;
  category: string;
}

const ALL_BADGES: BadgeDef[] = [
  // Streaks
  { key: 'streak_3',  icon: '🔥', title: '3-Day Streak',   description: 'Study 3 days in a row',           category: 'Streak' },
  { key: 'streak_7',  icon: '🔥', title: '7-Day Streak',   description: 'Study 7 days in a row',           category: 'Streak' },
  { key: 'streak_14', icon: '⚡', title: '2-Week Streak',  description: 'Study 14 days in a row',          category: 'Streak' },
  { key: 'streak_30', icon: '💎', title: 'Month Champion',  description: 'Study 30 days in a row',          category: 'Streak' },
  // Sessions
  { key: 'first_session', icon: '🚀', title: 'First Session', description: 'Log your first study session', category: 'Sessions' },
  { key: 'session_10',    icon: '📚', title: '10 Sessions',   description: 'Log 10 study sessions',        category: 'Sessions' },
  { key: 'session_50',    icon: '🏆', title: '50 Sessions',   description: 'Log 50 study sessions',        category: 'Sessions' },
  // Time
  { key: 'hour_1',   icon: '⏰', title: '1 Hour Club',    description: 'Study for a total of 1 hour',   category: 'Time' },
  { key: 'hour_10',  icon: '⏱️', title: '10 Hours',       description: 'Study for a total of 10 hours', category: 'Time' },
  { key: 'hour_50',  icon: '🌟', title: '50 Hours',       description: 'Study for a total of 50 hours', category: 'Time' },
  // Tests
  { key: 'first_test', icon: '📝', title: 'First Test',   description: 'Complete your first mock test',  category: 'Tests' },
  { key: 'test_10',    icon: '🎯', title: '10 Tests',     description: 'Complete 10 mock tests',         category: 'Tests' },
  { key: 'test_50',    icon: '🏅', title: '50 Tests',     description: 'Complete 50 mock tests',         category: 'Tests' },
];

const CATEGORIES = ['Streak', 'Sessions', 'Time', 'Tests'];

export function BadgesPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();

  const { data: earned = [] } = useQuery({
    queryKey: ['study-badges', tenantId],
    queryFn: () => getEarnedBadges(tenantId),
    enabled: !!tenantId,
  });

  const checkMutation = useMutation({
    mutationFn: () => checkAndAwardBadges(tenantId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study-badges'] }),
  });

  useEffect(() => {
    if (tenantId) checkMutation.mutate();
  }, [tenantId]);

  const earnedSet = new Set(earned);
  const earnedCount = ALL_BADGES.filter(b => earnedSet.has(b.key)).length;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: '#fef3c7' }}>
          <Trophy className="h-5 w-5" style={{ color: '#d97706' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Achievements</h1>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{earnedCount} / {ALL_BADGES.length} badges earned</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <div className="flex justify-between text-sm mb-2">
          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Overall Progress</span>
          <span className="font-bold" style={{ color: 'var(--accent)' }}>{earnedCount}/{ALL_BADGES.length}</span>
        </div>
        <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${(earnedCount / ALL_BADGES.length) * 100}%`, background: 'var(--accent)' }} />
        </div>
        {earnedCount === ALL_BADGES.length && (
          <p className="text-sm font-bold mt-3 text-center" style={{ color: '#d97706' }}>🏆 All badges unlocked! Amazing!</p>
        )}
      </div>

      {/* Badges by category */}
      {CATEGORIES.map(cat => {
        const catBadges = ALL_BADGES.filter(b => b.category === cat);
        const catEarned = catBadges.filter(b => earnedSet.has(b.key)).length;
        return (
          <div key={cat}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>{cat}</h2>
              <span className="text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{catEarned}/{catBadges.length}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {catBadges.map(badge => {
                const isEarned = earnedSet.has(badge.key);
                return (
                  <div key={badge.key}
                    className="rounded-2xl p-4 flex flex-col items-center gap-2 text-center transition-all"
                    style={{
                      background: isEarned ? 'var(--surface)' : 'var(--surface)',
                      border: isEarned ? '2px solid var(--accent)' : '1px solid var(--surface-border)',
                      opacity: isEarned ? 1 : 0.45,
                    }}>
                    <div className="text-3xl"
                      style={{ filter: isEarned ? 'none' : 'grayscale(1)' }}>
                      {badge.icon}
                    </div>
                    <div>
                      <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{badge.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{badge.description}</p>
                    </div>
                    {isEarned && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>Earned ✓</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

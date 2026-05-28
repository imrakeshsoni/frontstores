// [study] [all tenants]
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Brain, Flame, BookOpen, ClipboardList, Zap, Clock } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getStudyConfig, getStreak, getTodayStudyTime, getWeeklySubjectBreakdown, getTestStats } from '@/lib/db/study';
import { checkAIAvailable } from '@/lib/study/studyAI';

function minToHr(m: number) {
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

const QUICK_ACTIONS = [
  { label: 'Ask AI Anything', icon: '🤖', to: '/study/ask',       bg: '#ede9fe', color: '#7c3aed' },
  { label: 'Take Mock Test',  icon: '📝', to: '/study/mock-tests', bg: '#dcfce7', color: '#16a34a' },
  { label: 'Review Flashcards', icon: '🃏', to: '/study/flashcards', bg: '#fef3c7', color: '#d97706' },
  { label: 'Log Study Time', icon: '⏱️', to: '/study/tracker',    bg: '#dbeafe', color: '#2563eb' },
];

export function StudyDashboard() {
  const tenantId  = useAppStore((s) => s.config?.tenant_id ?? '');
  const navigate  = useNavigate();
  const [aiOnline, setAiOnline] = useState<boolean | null>(null);

  useEffect(() => {
    checkAIAvailable().then(setAiOnline);
  }, []);

  const { data: config }  = useQuery({ queryKey: ['study-config', tenantId], queryFn: () => getStudyConfig(tenantId), enabled: !!tenantId });
  const { data: streak }  = useQuery({ queryKey: ['study-streak', tenantId], queryFn: () => getStreak(tenantId), enabled: !!tenantId, refetchInterval: 30000 });
  const { data: todayMin } = useQuery({ queryKey: ['study-today', tenantId], queryFn: () => getTodayStudyTime(tenantId), enabled: !!tenantId, refetchInterval: 30000 });
  const { data: subjects } = useQuery({ queryKey: ['study-subjects', tenantId], queryFn: () => getWeeklySubjectBreakdown(tenantId), enabled: !!tenantId });
  const { data: testStats } = useQuery({ queryKey: ['study-test-stats', tenantId], queryFn: () => getTestStats(tenantId), enabled: !!tenantId });

  const studentName = config?.student_name || 'Student';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>{greeting},</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{studentName} 👋</h1>
          {config?.class_grade && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Class {config.class_grade} · {config.school || 'StudyMate'}</p>
          )}
        </div>
        {/* AI status pill */}
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold`}
          style={{ background: aiOnline === true ? '#dcfce7' : aiOnline === false ? '#fee2e2' : '#f1f5f9', color: aiOnline === true ? '#16a34a' : aiOnline === false ? '#dc2626' : '#64748b' }}>
          <div className={`h-1.5 w-1.5 rounded-full ${aiOnline === true ? 'bg-green-500 animate-pulse' : aiOnline === false ? 'bg-red-400' : 'bg-slate-400'}`} />
          {aiOnline === true ? 'AI Online' : aiOnline === false ? 'AI Offline' : 'Checking…'}
        </div>
      </div>

      {/* Streak + today stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Flame size={18} />} bg="#fef3c7" color="#d97706"
          label="Study Streak" value={`${streak?.current ?? 0} days`} sub={`Best: ${streak?.longest ?? 0} days`} />
        <StatCard icon={<Clock size={18} />} bg="#dbeafe" color="#2563eb"
          label="Today" value={minToHr(todayMin ?? 0)} sub="studied today" />
        <StatCard icon={<ClipboardList size={18} />} bg="#dcfce7" color="#16a34a"
          label="Tests Taken" value={String(testStats?.completed ?? 0)} sub={testStats?.avg_score ? `Avg ${Math.round(testStats.avg_score)}%` : 'No tests yet'} />
        <StatCard icon={<BookOpen size={18} />} bg="#ede9fe" color="#7c3aed"
          label="Days Studied" value={String(streak?.totalDays ?? 0)} sub="total days" />
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="font-bold mb-3" style={{ color: 'var(--text-primary)' }}>What do you want to do?</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {QUICK_ACTIONS.map(a => (
            <button key={a.to} onClick={() => navigate(a.to)}
              className="rounded-2xl p-4 flex flex-col items-start gap-3 text-left hover:shadow-md transition-all"
              style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
              <div className="h-10 w-10 rounded-xl flex items-center justify-center text-lg" style={{ background: a.bg }}>
                {a.icon}
              </div>
              <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{a.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Weekly subject breakdown */}
      {subjects && subjects.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Brain className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>This Week by Subject</h2>
          </div>
          <div className="space-y-3">
            {(() => {
              const max = Math.max(...subjects.map(s => s.minutes), 1);
              return subjects.map(s => (
                <div key={s.subject}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{s.subject}</span>
                    <span style={{ color: 'var(--text-tertiary)' }}>{minToHr(s.minutes)}</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${(s.minutes / max) * 100}%`, background: 'var(--accent)' }} />
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* Empty state — first time */}
      {!streak?.totalDays && (
        <div className="rounded-2xl p-8 flex flex-col items-center gap-3 text-center"
          style={{ background: 'var(--surface)', border: '2px dashed var(--surface-border)' }}>
          <p className="text-4xl">🚀</p>
          <p className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Start your learning journey!</p>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Ask a question, take a mock test, or log your first study session.</p>
          <div className="flex gap-3 mt-2">
            <button onClick={() => navigate('/study/ask')}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white" style={{ background: 'var(--accent)' }}>
              <Zap className="inline h-4 w-4 mr-1" />Ask AI
            </button>
            <button onClick={() => navigate('/study/setup')}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>
              Set Up Profile
            </button>
          </div>
        </div>
      )}
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

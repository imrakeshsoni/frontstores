// [study] [all tenants]
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Brain, Flame, BookOpen, ClipboardList, Zap, Clock, GraduationCap, AlertCircle, Settings2 } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import {
  getStudyConfig, getStreak, getTodayStudyTime, getWeeklySubjectBreakdown, getTestStats,
  getUpcomingExams, getDueAssignments, getTodayChallenge, saveDailyChallenge, answerDailyChallenge,
  checkAndAwardBadges, getTotalXP, xpToLevel, getDashboardPrefs, setDashboardPrefs,
} from '@/lib/db/study';
import { checkAIAvailable, generateMockTest } from '@/lib/study/studyAI';

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
  const { data: totalXP = 0 } = useQuery({ queryKey: ['study-xp', tenantId], queryFn: () => getTotalXP(tenantId), enabled: !!tenantId });
  const { data: hiddenWidgets = [], refetch: refetchPrefs } = useQuery({ queryKey: ['study-dash-prefs', tenantId], queryFn: () => getDashboardPrefs(tenantId), enabled: !!tenantId });
  const [showCustomize, setShowCustomize] = useState(false);
  const { data: upcomingExams = [] } = useQuery({ queryKey: ['study-upcoming-exams', tenantId], queryFn: () => getUpcomingExams(tenantId, 14), enabled: !!tenantId });
  const { data: dueAssignments = [] } = useQuery({ queryKey: ['study-due-assignments', tenantId], queryFn: () => getDueAssignments(tenantId), enabled: !!tenantId });
  const { data: todayChallenge, refetch: refetchChallenge } = useQuery({ queryKey: ['study-daily-challenge', tenantId], queryFn: () => getTodayChallenge(tenantId), enabled: !!tenantId });
  const qc = useQueryClient();

  const [challengeAnswer, setChallengeAnswer] = useState('');
  const [generatingChallenge, setGeneratingChallenge] = useState(false);

  const generateChallengeMutation = useMutation({
    mutationFn: async () => {
      if (!config?.subjects) return;
      const subjects = config.subjects.split(',').map((s: string) => s.trim()).filter(Boolean);
      const subject = subjects[Math.floor(Math.random() * subjects.length)] || 'General Knowledge';
      setGeneratingChallenge(true);
      const qs = await generateMockTest(tenantId, subject, '', 1, config?.class_grade ?? null);
      if (qs.length === 0) throw new Error('No question generated');
      const q = qs[0];
      await saveDailyChallenge(tenantId, q.question + '\nA: ' + q.option_a + '\nB: ' + q.option_b + '\nC: ' + q.option_c + '\nD: ' + q.option_d, q.correct_answer + ': ' + q[`option_${q.correct_answer.toLowerCase()}` as 'option_a'], subject);
      return refetchChallenge();
    },
    onSettled: () => setGeneratingChallenge(false),
  });

  const answerChallengeMutation = useMutation({
    mutationFn: async (answer: string) => {
      if (!todayChallenge) return;
      await answerDailyChallenge(tenantId, todayChallenge.id, answer);
      await checkAndAwardBadges(tenantId);
      qc.invalidateQueries({ queryKey: ['study-daily-challenge'] });
      qc.invalidateQueries({ queryKey: ['study-badges'] });
    },
  });

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
        <button onClick={() => setShowCustomize(true)} className="h-9 w-9 rounded-xl flex items-center justify-center border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-tertiary)' }}>
          <Settings2 className="h-4 w-4" />
        </button>
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

      {/* XP level + Daily Goal Ring */}
      {!hiddenWidgets.includes('xp_ring') && (
        <XPRingWidget xp={totalXP} todayMin={todayMin ?? 0} goalMin={60} />
      )}

      {/* Motivational quote */}
      {!hiddenWidgets.includes('quote') && <QuoteWidget />}

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
      {!hiddenWidgets.includes('subjects') && subjects && subjects.length > 0 && (
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

      {/* Daily Challenge widget */}
      {!hiddenWidgets.includes('daily_challenge') && <DailyChallengeWidget
        challenge={todayChallenge ?? null}
        generating={generatingChallenge || generateChallengeMutation.isPending}
        answer={challengeAnswer}
        setAnswer={setChallengeAnswer}
        onGenerate={() => generateChallengeMutation.mutate()}
        onSubmit={(ans) => answerChallengeMutation.mutate(ans)}
        hasSubjects={!!(config?.subjects)}
      />}

      {/* Upcoming exams */}
      {!hiddenWidgets.includes('exams') && upcomingExams.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4" style={{ color: '#d97706' }} />
              <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Upcoming Exams</h2>
            </div>
            <button onClick={() => navigate('/study/exams')} className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>View all →</button>
          </div>
          <div className="space-y-2">
            {upcomingExams.slice(0, 3).map(exam => {
              const days = Math.ceil((new Date(exam.exam_date).getTime() - new Date().setHours(0,0,0,0)) / 86400000);
              return (
                <div key={exam.id} className="flex items-center gap-3 rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
                  <div className="h-10 w-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0"
                    style={{ background: days <= 3 ? '#fee2e2' : days <= 7 ? '#fef3c7' : '#dbeafe' }}>
                    <p className="text-sm font-black leading-none" style={{ color: days <= 3 ? '#dc2626' : days <= 7 ? '#d97706' : '#2563eb' }}>{days}</p>
                    <p className="text-xs" style={{ color: days <= 3 ? '#dc2626' : days <= 7 ? '#d97706' : '#2563eb' }}>days</p>
                  </div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{exam.exam_name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{exam.subject} · {new Date(exam.exam_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Due assignments */}
      {!hiddenWidgets.includes('assignments') && dueAssignments.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" style={{ color: '#dc2626' }} />
              <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Due Soon</h2>
            </div>
            <button onClick={() => navigate('/study/assignments')} className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>View all →</button>
          </div>
          <div className="space-y-2">
            {dueAssignments.map(a => {
              const days = a.due_date ? Math.ceil((new Date(a.due_date).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000) : null;
              return (
                <div key={a.id} className="flex items-center gap-3 rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
                  <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: days !== null && days <= 0 ? '#dc2626' : '#f97316' }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{a.title}</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{a.subject}{days !== null ? ` · ${days <= 0 ? 'Overdue' : days === 1 ? 'Due tomorrow' : `Due in ${days}d`}` : ''}</p>
                  </div>
                </div>
              );
            })}
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

      {/* Customize widgets modal */}
      {showCustomize && (
        <CustomizeModal
          hidden={hiddenWidgets}
          onSave={async (h) => { await setDashboardPrefs(tenantId, h); refetchPrefs(); setShowCustomize(false); }}
          onClose={() => setShowCustomize(false)} />
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

import type { StudyDailyChallenge } from '@/lib/db/study';

function DailyChallengeWidget({ challenge, generating, answer, setAnswer, onGenerate, onSubmit, hasSubjects }: {
  challenge: StudyDailyChallenge | null;
  generating: boolean;
  answer: string;
  setAnswer: (a: string) => void;
  onGenerate: () => void;
  onSubmit: (a: string) => void;
  hasSubjects: boolean;
}) {
  if (!hasSubjects) return null;
  const answered = !!challenge?.user_answer;
  const correct = answered && challenge?.user_answer?.startsWith(challenge?.correct_answer?.[0] ?? '');

  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '2px solid var(--accent)20' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚡</span>
          <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Daily Challenge</h2>
        </div>
        {challenge?.subject && <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: 'var(--surface-2)', color: 'var(--text-tertiary)' }}>{challenge.subject}</span>}
      </div>
      {!challenge && (
        <div className="text-center py-4">
          <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>Get today's challenge question!</p>
          <button onClick={onGenerate} disabled={generating}
            className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white disabled:opacity-60 flex items-center gap-2 mx-auto"
            style={{ background: 'var(--accent)' }}>
            {generating ? <><span className="animate-spin">⏳</span> Generating…</> : '⚡ Get Today\'s Challenge'}
          </button>
        </div>
      )}
      {challenge && !answered && (
        <div className="space-y-3">
          <p className="text-sm font-medium whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>{challenge.question}</p>
          <div className="flex gap-2">
            {['A', 'B', 'C', 'D'].map(opt => (
              <button key={opt} onClick={() => setAnswer(opt)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                style={answer === opt
                  ? { background: 'var(--accent)', color: '#fff' }
                  : { background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--surface-border)' }}>
                {opt}
              </button>
            ))}
          </div>
          <button onClick={() => onSubmit(answer)} disabled={!answer}
            className="w-full py-2.5 rounded-xl font-semibold text-sm text-white disabled:opacity-50"
            style={{ background: 'var(--accent)' }}>Submit Answer</button>
        </div>
      )}
      {challenge && answered && (
        <div className="space-y-2">
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{challenge.question.split('\n')[0]}</p>
          <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: correct ? '#f0fdf4' : '#fef2f2' }}>
            <span className="text-xl">{correct ? '✅' : '❌'}</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: correct ? '#16a34a' : '#dc2626' }}>
                {correct ? 'Correct!' : 'Not quite'}
              </p>
              <p className="text-xs" style={{ color: correct ? '#15803d' : '#b91c1c' }}>Answer: {challenge.correct_answer}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const QUOTES = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela" },
  { text: "The beautiful thing about learning is that no one can take it away from you.", author: "B.B. King" },
  { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
  { text: "The more that you read, the more things you will know.", author: "Dr. Seuss" },
  { text: "Do something today that your future self will thank you for.", author: "Unknown" },
  { text: "Hard work beats talent when talent doesn't work hard.", author: "Tim Notke" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "The expert in anything was once a beginner.", author: "Helen Hayes" },
];

function QuoteWidget() {
  const [idx] = useState(() => Math.floor(Math.random() * QUOTES.length));
  const q = QUOTES[idx];
  return (
    <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: '#ede9fe', border: '1px solid #c4b5fd' }}>
      <span className="text-2xl flex-shrink-0">💡</span>
      <div>
        <p className="text-sm font-medium italic" style={{ color: '#4c1d95' }}>"{q.text}"</p>
        <p className="text-xs mt-1 font-semibold" style={{ color: '#6d28d9' }}>— {q.author}</p>
      </div>
    </div>
  );
}

function XPRingWidget({ xp, todayMin, goalMin }: { xp: number; todayMin: number; goalMin: number }) {
  const level = xpToLevel(xp);
  const goalPct = Math.min(100, Math.round((todayMin / goalMin) * 100));
  const r = 36;
  const circ = 2 * Math.PI * r;
  const goalDash = circ * (1 - goalPct / 100);
  return (
    <div className="rounded-2xl p-5 flex items-center gap-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
      {/* Goal ring */}
      <div className="relative flex-shrink-0">
        <svg width="88" height="88" className="rotate-[-90deg]">
          <circle cx="44" cy="44" r={r} fill="none" strokeWidth="8" stroke="var(--surface-2)" />
          <circle cx="44" cy="44" r={r} fill="none" strokeWidth="8" stroke="var(--accent)"
            strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={goalDash}
            style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-lg font-black" style={{ color: 'var(--accent)' }}>{goalPct}%</p>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>goal</p>
        </div>
      </div>
      {/* XP / Level */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">⭐</span>
          <p className="font-black text-lg" style={{ color: 'var(--text-primary)' }}>Level {level.level}</p>
          <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>{level.title}</span>
        </div>
        <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>{xp} XP total · {level.xpNeeded - level.xpInLevel} to next level</p>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
          <div className="h-full rounded-full" style={{ width: `${Math.round((level.xpInLevel / level.xpNeeded) * 100)}%`, background: 'var(--accent)' }} />
        </div>
      </div>
    </div>
  );
}

const ALL_WIDGETS = [
  { key: 'xp_ring', label: 'XP Level & Goal Ring' },
  { key: 'quote', label: 'Motivational Quote' },
  { key: 'daily_challenge', label: 'Daily Challenge' },
  { key: 'exams', label: 'Upcoming Exams' },
  { key: 'assignments', label: 'Due Assignments' },
  { key: 'subjects', label: 'Weekly Subjects Breakdown' },
];

function CustomizeModal({ hidden, onSave, onClose }: { hidden: string[]; onSave: (h: string[]) => void; onClose: () => void }) {
  const [localHidden, setLocalHidden] = useState<string[]>(hidden);
  const toggle = (key: string) => setLocalHidden(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ background: 'var(--bg)' }}>
        <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Customize Dashboard</h2>
        <div className="space-y-2">
          {ALL_WIDGETS.map(w => (
            <label key={w.key} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer" style={{ background: 'var(--surface)' }}>
              <input type="checkbox" checked={!localHidden.includes(w.key)} onChange={() => toggle(w.key)} className="h-4 w-4 accent-[var(--accent)]" />
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{w.label}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl font-semibold text-sm border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Cancel</button>
          <button onClick={() => onSave(localHidden)} className="flex-1 py-3 rounded-xl font-semibold text-sm text-white" style={{ background: 'var(--accent)' }}>Save</button>
        </div>
      </div>
    </div>
  );
}

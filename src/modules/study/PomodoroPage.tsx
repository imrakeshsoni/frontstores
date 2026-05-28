// [study] [all tenants]
import { useState, useEffect, useRef, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Play, Pause, RotateCcw, Coffee, BookOpen } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { logSession } from '@/lib/db/study';

type Phase = 'focus' | 'short_break' | 'long_break';

const BREAK_ACTIVITIES = [
  '💪 Do 10 push-ups', '🧘 Take 5 deep breaths', '🚶 Walk around for 2 minutes',
  '💧 Drink a glass of water', '👀 Look 20 feet away for 20 seconds (20-20-20 rule)',
  '🤸 Stretch your neck and shoulders', '🌿 Step outside for fresh air',
  '😊 Smile — you\'re making progress!', '🍎 Grab a healthy snack',
  '👐 Shake out your hands and wrists', '🏃 March in place for 1 minute',
  '🎵 Hum your favourite song', '💆 Close your eyes and rest them',
  '✏️ Doodle something random', '🫁 4-7-8 breathing: inhale 4s, hold 7s, exhale 8s',
];

const PRESETS: Record<Phase, number> = { focus: 25, short_break: 5, long_break: 15 };
const PHASE_LABELS: Record<Phase, string> = { focus: 'Focus', short_break: 'Short Break', long_break: 'Long Break' };
const PHASE_COLORS: Record<Phase, string> = { focus: '#7c3aed', short_break: '#16a34a', long_break: '#2563eb' };
const PHASE_BG: Record<Phase, string> = { focus: '#ede9fe', short_break: '#dcfce7', long_break: '#dbeafe' };

export function PomodoroPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const [phase, setPhase] = useState<Phase>('focus');
  const [remaining, setRemaining] = useState(PRESETS.focus * 60);
  const [running, setRunning] = useState(false);
  const [round, setRound] = useState(1);
  const [subject, setSubject] = useState('');
  const [completedFocus, setCompletedFocus] = useState(0);
  const [totalFocusMin, setTotalFocusMin] = useState(0);
  const [breakActivity] = useState(() => BREAK_ACTIVITIES[Math.floor(Math.random() * BREAK_ACTIVITIES.length)]);
  const [activityIdx, setActivityIdx] = useState(Math.floor(Math.random() * BREAK_ACTIVITIES.length));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const logMutation = useMutation({
    mutationFn: (minutes: number) => logSession(tenantId, subject || 'General', minutes, `Pomodoro session (${round} rounds)`),
  });

  const resetTimer = useCallback((p: Phase = phase) => {
    setRunning(false);
    setRemaining(PRESETS[p] * 60);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [phase]);

  const switchPhase = useCallback((next: Phase) => {
    setPhase(next);
    setRunning(false);
    setRemaining(PRESETS[next] * 60);
  }, []);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          clearInterval(intervalRef.current!);
          setRunning(false);
          if (phase === 'focus') {
            const mins = PRESETS.focus;
            setCompletedFocus(c => c + 1);
            setTotalFocusMin(t => t + mins);
            if (tenantId && subject) logMutation.mutate(mins);
            const newRound = round + 1;
            setRound(newRound);
            const nextPhase = newRound % 4 === 0 ? 'long_break' : 'short_break';
            switchPhase(nextPhase);
          } else {
            setActivityIdx(Math.floor(Math.random() * BREAK_ACTIVITIES.length));
            switchPhase('focus');
          }
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current!);
  }, [running, phase, round, tenantId, subject, switchPhase]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const progress = 1 - remaining / (PRESETS[phase] * 60);
  const circumference = 2 * Math.PI * 90;
  const strokeDash = circumference * (1 - progress);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: '#fee2e2' }}>
          <span className="text-xl">🍅</span>
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Pomodoro Timer</h1>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Focus in 25-minute bursts, break for 5</p>
        </div>
      </div>

      {/* Phase tabs */}
      <div className="flex gap-2">
        {(['focus', 'short_break', 'long_break'] as Phase[]).map(p => (
          <button key={p} onClick={() => { switchPhase(p); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={phase === p
              ? { background: PHASE_BG[p], color: PHASE_COLORS[p] }
              : { background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
            {p === 'focus' ? <BookOpen className="h-3.5 w-3.5" /> : <Coffee className="h-3.5 w-3.5" />}
            {PHASE_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Timer circle */}
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <svg width="220" height="220" className="rotate-[-90deg]">
            <circle cx="110" cy="110" r="90" fill="none" strokeWidth="10"
              stroke="var(--surface-2)" />
            <circle cx="110" cy="110" r="90" fill="none" strokeWidth="10"
              stroke={PHASE_COLORS[phase]}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDash}
              style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-5xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </p>
            <p className="text-sm font-semibold mt-1" style={{ color: PHASE_COLORS[phase] }}>
              {PHASE_LABELS[phase]}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Round {round}</p>
          </div>
        </div>

        {/* Subject input */}
        <input value={subject} onChange={e => setSubject(e.target.value)}
          placeholder="What are you studying? (optional)"
          className="w-full max-w-xs px-4 py-3 rounded-xl text-sm text-center border outline-none"
          style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />

        {/* Controls */}
        <div className="flex items-center gap-4">
          <button onClick={() => resetTimer(phase)}
            className="h-12 w-12 rounded-full flex items-center justify-center border transition-colors hover:bg-opacity-80"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
            <RotateCcw className="h-5 w-5" />
          </button>
          <button onClick={() => setRunning(r => !r)}
            className="h-16 w-16 rounded-full flex items-center justify-center text-white shadow-lg transition-all active:scale-95"
            style={{ background: PHASE_COLORS[phase] }}>
            {running ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7 ml-0.5" />}
          </button>
          <div className="h-12 w-12" />
        </div>
      </div>

      {/* Today's stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Completed', value: completedFocus, icon: '🍅', bg: '#fee2e2', color: '#dc2626' },
          { label: 'Focus Time', value: `${totalFocusMin}m`, icon: '⏱️', bg: '#dbeafe', color: '#2563eb' },
          { label: 'Round', value: round, icon: '🔄', bg: '#dcfce7', color: '#16a34a' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4 flex flex-col items-center gap-2 text-center"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <div className="h-10 w-10 rounded-xl flex items-center justify-center text-lg" style={{ background: s.bg }}>{s.icon}</div>
            <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{s.value}</p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Break activity suggestion */}
      {phase !== 'focus' && (
        <div className="rounded-2xl p-5 flex items-center gap-4" style={{ background: '#dcfce7', border: '2px solid #bbf7d0' }}>
          <span className="text-3xl flex-shrink-0">{BREAK_ACTIVITIES[activityIdx].split(' ')[0]}</span>
          <div className="flex-1">
            <p className="text-xs font-semibold mb-0.5" style={{ color: '#15803d' }}>Break Activity</p>
            <p className="font-bold" style={{ color: '#166534' }}>{BREAK_ACTIVITIES[activityIdx].split(' ').slice(1).join(' ')}</p>
          </div>
          <button onClick={() => setActivityIdx(i => (i + 1) % BREAK_ACTIVITIES.length)}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: '#bbf7d0', color: '#166534' }}>
            Different
          </button>
        </div>
      )}

      {/* Tips */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>Pomodoro Tips</h3>
        <div className="space-y-2">
          {[
            'Put your phone away during focus time',
            'Every 4 rounds, take a 15-minute long break',
            'One task per Pomodoro — stay focused',
            'Study sessions are auto-logged to your tracker',
          ].map(tip => (
            <div key={tip} className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{tip}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

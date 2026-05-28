// [study] [all tenants]
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import {
  listWritingPractice, saveWritingPractice, deleteWritingPractice,
  type StudyWritingPractice,
} from '@/lib/db/study';

const SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography', 'English', 'Computer Science', 'Economics', 'Other'];
const DURATIONS = [5, 10, 15, 20, 30];

type Mode = 'list' | 'setup' | 'writing' | 'done' | 'view';

export function WritingPracticePage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>('list');
  const [viewEntry, setViewEntry] = useState<StudyWritingPractice | null>(null);

  // Setup state
  const [setupTitle, setSetupTitle] = useState('');
  const [setupSubject, setSetupSubject] = useState('');
  const [setupDuration, setSetupDuration] = useState(10);

  // Writing state
  const [content, setContent] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [doneStats, setDoneStats] = useState<{ words: number; seconds: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: practices = [] } = useQuery({
    queryKey: ['writing-practice', tenantId],
    queryFn: () => listWritingPractice(tenantId),
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: (data: Parameters<typeof saveWritingPractice>[1]) => saveWritingPractice(tenantId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['writing-practice', tenantId] });
      toast.success('Practice saved!');
    },
    onError: () => toast.error('Failed to save'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteWritingPractice(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['writing-practice', tenantId] }); toast.success('Deleted'); },
  });

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  function startWriting() {
    const secs = setupDuration * 60;
    setSecondsLeft(secs);
    setTotalSeconds(secs);
    setContent('');
    setStartTime(Date.now());
    setMode('writing');
  }

  useEffect(() => {
    if (mode !== 'writing') {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          finishSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [mode]);

  function finishSession() {
    if (timerRef.current) clearInterval(timerRef.current);
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    setDoneStats({ words, seconds: elapsed });
    setMode('done');
    const today = new Date().toISOString().slice(0, 10);
    saveMutation.mutate({
      title: setupTitle, content, subject: setupSubject || null,
      time_taken_seconds: elapsed, word_count: words, practice_date: today,
    });
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  }

  function formatDuration(s: number) {
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    return `${m}m ${s % 60}s`;
  }

  const progress = totalSeconds > 0 ? ((totalSeconds - secondsLeft) / totalSeconds) * 100 : 0;

  if (mode === 'setup') {
    return (
      <div className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
        <div className="w-full max-w-sm space-y-5">
          <div className="text-center">
            <p className="text-4xl mb-2">✍️</p>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>New Writing Practice</h1>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Set up your timed writing session</p>
          </div>
          <input value={setupTitle} onChange={e => setSetupTitle(e.target.value)}
            placeholder="Practice title *" className="w-full px-4 py-2.5 rounded-xl border text-sm"
            style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
          <select value={setupSubject} onChange={e => setSetupSubject(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border text-sm"
            style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: setupSubject ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
            <option value="">Subject (optional)</option>
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Duration</p>
            <div className="grid grid-cols-5 gap-2">
              {DURATIONS.map(d => (
                <button key={d} onClick={() => setSetupDuration(d)}
                  className="py-2.5 rounded-xl text-sm font-bold"
                  style={d === setupDuration ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--surface-border)' }}>
                  {d}m
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setMode('list')} className="flex-1 py-3 rounded-xl font-semibold text-sm border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Cancel</button>
            <button onClick={startWriting} disabled={!setupTitle.trim()}
              className="flex-1 py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-60"
              style={{ background: 'var(--accent)' }}>Start Writing</button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'writing') {
    const urgent = secondsLeft <= 60;
    return (
      <div className="flex-1 flex flex-col p-6 gap-4">
        {/* Timer bar */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{setupTitle}</p>
            {setupSubject && <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{setupSubject}</p>}
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{wordCount} words</p>
            <div className="px-4 py-2 rounded-xl font-black text-lg"
              style={{ background: urgent ? '#fee2e2' : 'var(--surface)', color: urgent ? '#dc2626' : 'var(--text-primary)', border: '1px solid var(--surface-border)' }}>
              {formatTime(secondsLeft)}
            </div>
          </div>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: urgent ? '#dc2626' : 'var(--accent)' }} />
        </div>
        <textarea
          value={content} onChange={e => setContent(e.target.value)}
          placeholder="Start writing… timer is running"
          className="flex-1 p-4 rounded-2xl text-base resize-none outline-none"
          style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)', minHeight: 300 }}
          autoFocus
        />
        <button onClick={finishSession} className="w-full py-3 rounded-xl font-semibold text-sm text-white"
          style={{ background: '#dc2626' }}>
          Stop & Save
        </button>
      </div>
    );
  }

  if (mode === 'done' && doneStats) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-5 text-center">
          <p className="text-6xl">🎉</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Practice Complete!</h1>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
              <p className="text-3xl font-black" style={{ color: 'var(--accent)' }}>{doneStats.words}</p>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>words written</p>
            </div>
            <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
              <p className="text-3xl font-black" style={{ color: '#16a34a' }}>{formatDuration(doneStats.seconds)}</p>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>time taken</p>
            </div>
          </div>
          <button onClick={() => setMode('list')} className="w-full py-3 rounded-xl font-semibold text-sm text-white" style={{ background: 'var(--accent)' }}>
            Back to List
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'view' && viewEntry) {
    return (
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setMode('list')} className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>← Back</button>
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{viewEntry.title}</h1>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {viewEntry.subject ?? 'General'} · {new Date(viewEntry.practice_date).toLocaleDateString('en-IN')} · {viewEntry.word_count} words · {formatDuration(viewEntry.time_taken_seconds)}
          </p>
        </div>
        <div className="rounded-2xl p-5 whitespace-pre-wrap text-sm" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)', lineHeight: 1.8 }}>
          {viewEntry.content}
        </div>
      </div>
    );
  }

  // List mode
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Writing Practice</h1>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{practices.length} sessions completed</p>
        </div>
        <button onClick={() => { setSetupTitle(''); setSetupSubject(''); setSetupDuration(10); setMode('setup'); }}
          className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white" style={{ background: 'var(--accent)' }}>
          + Start Practice
        </button>
      </div>

      {practices.length === 0 && (
        <div className="text-center py-16 space-y-2">
          <p className="text-4xl">✍️</p>
          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>No writing sessions yet</p>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Start a timed writing session to practice your skills</p>
        </div>
      )}

      <div className="space-y-3">
        {practices.map(p => (
          <div key={p.id} className="rounded-2xl p-4 flex items-center gap-4" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <div className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 text-xl" style={{ background: 'var(--accent-soft)' }}>✍️</div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{p.title}</p>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {p.subject ?? 'General'} · {new Date(p.practice_date).toLocaleDateString('en-IN')} · {p.word_count} words · {formatDuration(p.time_taken_seconds)}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setViewEntry(p); setMode('view'); }}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>View</button>
              <button onClick={() => { if (confirm('Delete this practice?')) deleteMutation.mutate(p.id); }}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                style={{ background: '#fee2e2', color: '#dc2626' }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

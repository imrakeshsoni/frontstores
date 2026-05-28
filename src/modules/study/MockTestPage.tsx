// [study] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ClipboardList, Plus, ChevronRight, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import {
  listMockTests, createMockTest, getTestWithQuestions, submitTestAnswer, completeTest,
  getStudyConfig, getWeakTopics, type StudyMockQuestion,
} from '@/lib/db/study';
import { generateMockTest } from '@/lib/study/studyAI';

const SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography', 'English', 'Economics', 'Science', 'Hindi'];

type Screen = 'list' | 'setup' | 'taking' | 'result';

export function MockTestPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [screen, setScreen]         = useState<Screen>('list');
  const [activeTestId, setActiveTestId] = useState<string | null>(null);
  const [subject, setSubject]       = useState(SUBJECTS[0]);
  const [chapter, setChapter]       = useState('');
  const [qCount, setQCount]         = useState(10);
  const [answers, setAnswers]       = useState<Record<string, string>>({});
  const [submitted, setSubmitted]   = useState(false);
  const [questions, setQuestions]   = useState<StudyMockQuestion[]>([]);
  const [currentQ, setCurrentQ]     = useState(0);

  const { data: config } = useQuery({ queryKey: ['study-config', tenantId], queryFn: () => getStudyConfig(tenantId), enabled: !!tenantId });
  const { data: tests = [], isLoading } = useQuery({ queryKey: ['study-tests', tenantId], queryFn: () => listMockTests(tenantId), enabled: !!tenantId });

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!chapter.trim()) throw new Error('Enter the chapter / topic name');
      toast.loading('AI is generating your test…', { id: 'gen' });
      const generated = await generateMockTest(tenantId, subject, chapter, qCount, config?.class_grade ?? null);
      if (!generated.length) throw new Error('AI returned no questions. Try again.');
      const id = await createMockTest(tenantId, subject, chapter, generated);
      toast.dismiss('gen');
      return id;
    },
    onSuccess: async (testId) => {
      toast.success('Test ready!');
      qc.invalidateQueries({ queryKey: ['study-tests'] });
      const result = await getTestWithQuestions(testId);
      if (result) { setActiveTestId(testId); setQuestions(result.questions); setAnswers({}); setSubmitted(false); setCurrentQ(0); setScreen('taking'); }
    },
    onError: (e: any) => { toast.dismiss('gen'); toast.error(e?.message ?? 'Generation failed'); },
  });

  async function loadTest(testId: string) {
    const result = await getTestWithQuestions(testId);
    if (!result) return;
    const ans: Record<string, string> = {};
    for (const q of result.questions) if (q.user_answer) ans[q.id] = q.user_answer;
    setActiveTestId(testId);
    setQuestions(result.questions);
    setAnswers(ans);
    setSubmitted(result.test.status === 'completed');
    setCurrentQ(0);
    setScreen(result.test.status === 'completed' ? 'result' : 'taking');
  }

  async function handleSubmit() {
    for (const q of questions) {
      if (answers[q.id]) await submitTestAnswer(q.id, answers[q.id]);
    }
    const score = questions.filter(q => answers[q.id] === q.correct_answer).length;
    await completeTest(tenantId, activeTestId!, score);
    qc.invalidateQueries({ queryKey: ['study-tests'] });
    qc.invalidateQueries({ queryKey: ['study-test-stats'] });
    setSubmitted(true);
    setScreen('result');
  }

  const q = questions[currentQ];
  const score = submitted ? questions.filter(q => answers[q.id] === q.correct_answer).length : 0;
  const pct   = submitted ? Math.round((score / questions.length) * 100) : 0;

  if (screen === 'setup') return (
    <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
      <div className="w-full max-w-md space-y-5">
        <button onClick={() => setScreen('list')} className="text-sm flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>← Back</button>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Generate Mock Test</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>AI will create questions based on the topic you enter</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Subject</label>
          <select value={subject} onChange={e => setSubject(e.target.value)}
            className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            style={{ borderColor: 'var(--surface-border)', background: 'var(--surface)', color: 'var(--text-primary)' }}>
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Chapter / Topic *</label>
          <input value={chapter} onChange={e => setChapter(e.target.value)} placeholder="e.g. Photosynthesis, Quadratic Equations, World War II"
            className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            style={{ borderColor: 'var(--surface-border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Number of Questions</label>
          <div className="flex gap-2">
            {[5, 10, 15, 20].map(n => (
              <button key={n} onClick={() => setQCount(n)}
                className="flex-1 py-2 rounded-xl text-sm font-semibold border transition-all"
                style={qCount === n ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: 'white' } : { borderColor: 'var(--surface-border)', background: 'var(--surface)', color: 'var(--text-secondary)' }}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}
          className="w-full py-3.5 rounded-xl font-bold text-sm text-white disabled:opacity-60 flex items-center justify-center gap-2"
          style={{ background: 'var(--accent)' }}>
          {generateMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</> : '🤖 Generate Test with AI'}
        </button>
        <p className="text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>Takes 15-30 seconds · Requires internet</p>
      </div>
    </div>
  );

  if (screen === 'taking' && q) return (
    <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
      <div className="w-full max-w-2xl space-y-5">
        {/* Progress */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Question {currentQ + 1} of {questions.length}</p>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{subject} · {chapter}</p>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${((currentQ + 1) / questions.length) * 100}%`, background: 'var(--accent)' }} />
        </div>

        {/* Question */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <p className="font-semibold text-base leading-relaxed" style={{ color: 'var(--text-primary)' }}>{q.question}</p>
          <div className="space-y-2">
            {(['A', 'B', 'C', 'D'] as const).map(opt => {
              const text = q[`option_${opt.toLowerCase()}` as 'option_a'] ?? '';
              if (!text) return null;
              const selected = answers[q.id] === opt;
              return (
                <button key={opt} onClick={() => setAnswers(a => ({ ...a, [q.id]: opt }))}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all"
                  style={selected ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: 'white' } : { borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }}>
                  <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${selected ? 'bg-white/20' : 'bg-white border border-slate-200'}`}
                    style={selected ? { color: 'white' } : { color: 'var(--text-secondary)' }}>{opt}</span>
                  <span className="text-sm">{text}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          {currentQ > 0 && (
            <button onClick={() => setCurrentQ(c => c - 1)}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm border"
              style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>← Previous</button>
          )}
          <div className="flex-1" />
          {currentQ < questions.length - 1 ? (
            <button onClick={() => setCurrentQ(c => c + 1)} disabled={!answers[q.id]}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white disabled:opacity-50 flex items-center gap-1"
              style={{ background: 'var(--accent)' }}>Next <ChevronRight className="h-4 w-4" /></button>
          ) : (
            <button onClick={handleSubmit} disabled={Object.keys(answers).length < questions.length}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white disabled:opacity-50"
              style={{ background: '#16a34a' }}>
              Submit Test ({Object.keys(answers).length}/{questions.length} answered)
            </button>
          )}
        </div>

        {/* Question dots */}
        <div className="flex flex-wrap gap-2 justify-center">
          {questions.map((_, i) => (
            <button key={i} onClick={() => setCurrentQ(i)}
              className="h-7 w-7 rounded-full text-xs font-semibold transition-all"
              style={i === currentQ ? { background: 'var(--accent)', color: 'white' } : answers[questions[i].id] ? { background: '#dcfce7', color: '#16a34a' } : { background: 'var(--surface-2)', color: 'var(--text-tertiary)' }}>
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  if (screen === 'result') return (
    <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
      <div className="w-full max-w-2xl space-y-5">
        <button onClick={() => setScreen('list')} className="text-sm flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>← All Tests</button>
        <div className="rounded-2xl p-6 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <p className="text-5xl mb-2">{pct >= 80 ? '🏆' : pct >= 60 ? '👍' : '💪'}</p>
          <p className="text-4xl font-bold mb-1" style={{ color: pct >= 80 ? '#16a34a' : pct >= 60 ? '#d97706' : '#dc2626' }}>{pct}%</p>
          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{score} / {questions.length} correct</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>{subject} · {chapter}</p>
          <p className="text-sm mt-2 font-medium" style={{ color: 'var(--text-secondary)' }}>
            {pct >= 80 ? 'Excellent work! 🎉' : pct >= 60 ? 'Good job! Keep practicing.' : 'Keep studying — you\'ll get it! 💪'}
          </p>
        </div>

        {/* Answer review */}
        <div className="space-y-3">
          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Review Answers</p>
          {questions.map((q, i) => {
            const ua = answers[q.id]; const correct = ua === q.correct_answer;
            return (
              <div key={q.id} className="rounded-xl p-4 space-y-2" style={{ background: correct ? '#f0fdf4' : '#fef2f2', border: `1px solid ${correct ? '#bbf7d0' : '#fecaca'}` }}>
                <div className="flex items-start gap-2">
                  {correct ? <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-500" /> : <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-red-500" />}
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{i + 1}. {q.question}</p>
                </div>
                {!correct && ua && <p className="text-xs ml-6" style={{ color: '#dc2626' }}>Your answer: {ua} — {q[`option_${ua.toLowerCase()}` as 'option_a']}</p>}
                <p className="text-xs ml-6" style={{ color: '#16a34a' }}>Correct: {q.correct_answer} — {q[`option_${q.correct_answer.toLowerCase()}` as 'option_a']}</p>
                {q.explanation && <p className="text-xs ml-6 italic" style={{ color: 'var(--text-tertiary)' }}>{q.explanation}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>StudyMate</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Mock Tests</h1>
        </div>
        <button onClick={() => setScreen('setup')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white"
          style={{ background: 'var(--accent)' }}>
          <Plus className="h-4 w-4" /> New Test
        </button>
      </div>

      <WeakTopicsPanel tenantId={tenantId} onRetake={(subj, chap) => { setSubject(subj); setChapter(chap); setScreen('setup'); }} />

      {isLoading && Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: 'var(--surface)' }} />)}

      {!isLoading && tests.length === 0 && (
        <div className="rounded-2xl p-10 flex flex-col items-center gap-3 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <p className="text-4xl">📝</p>
          <p className="font-semibold" style={{ color: 'var(--text-secondary)' }}>No tests yet</p>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Generate your first AI-powered mock test in seconds</p>
          <button onClick={() => setScreen('setup')} className="mt-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white" style={{ background: 'var(--accent)' }}>
            Generate First Test
          </button>
        </div>
      )}

      <div className="space-y-3">
        {tests.map(t => {
          const pct = t.score !== null ? Math.round((t.score / t.total_questions) * 100) : null;
          return (
            <div key={t.id} onClick={() => loadTest(t.id)}
              className="rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow"
              style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
              <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: t.status === 'completed' ? '#dcfce7' : '#fef3c7' }}>
                <ClipboardList className="h-5 w-5" style={{ color: t.status === 'completed' ? '#16a34a' : '#d97706' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{t.subject} · {t.chapter || 'General'}</p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t.total_questions} questions · {new Date(t.created_at).toLocaleDateString('en-IN')}</p>
              </div>
              <div className="text-right flex-shrink-0">
                {pct !== null ? (
                  <p className="font-bold text-sm" style={{ color: pct >= 80 ? '#16a34a' : pct >= 60 ? '#d97706' : '#dc2626' }}>{pct}%</p>
                ) : (
                  <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: '#fef3c7', color: '#d97706' }}>Pending</span>
                )}
              </div>
              <ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeakTopicsPanel({ tenantId, onRetake }: { tenantId: string; onRetake: (subject: string, chapter: string) => void }) {
  const { data: weakTopics = [] } = useQuery({
    queryKey: ['study-weak-topics', tenantId],
    queryFn: () => getWeakTopics(tenantId),
    enabled: !!tenantId,
  });

  if (!weakTopics.length) return null;

  const needsWork = weakTopics.filter(t => t.avg_score < 60);
  if (!needsWork.length) return null;

  return (
    <div className="rounded-2xl p-5" style={{ background: '#fef2f2', border: '2px solid #fecaca' }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">🎯</span>
        <p className="font-bold" style={{ color: '#dc2626' }}>Topics That Need Work</p>
      </div>
      <p className="text-xs mb-4" style={{ color: '#b91c1c' }}>Based on your test history — retake these to improve</p>
      <div className="space-y-2">
        {needsWork.map(t => (
          <div key={`${t.subject}-${t.chapter}`}
            className="flex items-center gap-3 rounded-xl p-3"
            style={{ background: 'rgba(255,255,255,0.7)' }}>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm" style={{ color: '#7f1d1d' }}>{t.chapter}</p>
              <p className="text-xs" style={{ color: '#b91c1c' }}>{t.subject} · {t.attempts} attempt{t.attempts > 1 ? 's' : ''} · Avg {Math.round(t.avg_score)}%</p>
            </div>
            <div className="h-2 w-16 rounded-full overflow-hidden" style={{ background: '#fee2e2' }}>
              <div className="h-full rounded-full" style={{ width: `${t.avg_score}%`, background: t.avg_score < 40 ? '#dc2626' : '#f97316' }} />
            </div>
            <button onClick={() => onRetake(t.subject, t.chapter)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white flex-shrink-0"
              style={{ background: '#dc2626' }}>Retake</button>
          </div>
        ))}
      </div>
    </div>
  );
}

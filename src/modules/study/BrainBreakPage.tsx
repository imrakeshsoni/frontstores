// [study] [all tenants]
import { useState, useCallback } from 'react';

// ── Mental Math ───────────────────────────────────────────────────────────────

type Difficulty = 'Easy' | 'Medium' | 'Hard';
type Op = '+' | '-' | '×' | '÷';

function generateMathQ(difficulty: Difficulty): { question: string; answer: number } {
  const ops: Op[] = difficulty === 'Easy' ? ['+', '-'] : difficulty === 'Medium' ? ['+', '-', '×'] : ['+', '-', '×', '÷'];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a: number, b: number, answer: number, question: string;

  if (difficulty === 'Easy') {
    a = Math.floor(Math.random() * 9) + 1;
    b = Math.floor(Math.random() * 9) + 1;
  } else if (difficulty === 'Medium') {
    a = Math.floor(Math.random() * 90) + 10;
    b = Math.floor(Math.random() * 90) + 10;
  } else {
    a = Math.floor(Math.random() * 90) + 10;
    b = Math.floor(Math.random() * 90) + 10;
  }

  switch (op) {
    case '+': answer = a + b; question = `${a} + ${b} = ?`; break;
    case '-': { const [big, small] = a >= b ? [a, b] : [b, a]; answer = big - small; question = `${big} - ${small} = ?`; break; }
    case '×': { const x = difficulty === 'Hard' ? Math.floor(Math.random() * 9) + 2 : Math.floor(Math.random() * 8) + 2; a = Math.floor(Math.random() * (difficulty === 'Hard' ? 19 : 9)) + 2; answer = a * x; question = `${a} × ${x} = ?`; break; }
    case '÷': { const divisor = Math.floor(Math.random() * 8) + 2; const quotient = Math.floor(Math.random() * (difficulty === 'Hard' ? 15 : 9)) + 2; a = divisor * quotient; answer = quotient; question = `${a} ÷ ${divisor} = ?`; break; }
    default: answer = a + b; question = `${a} + ${b} = ?`;
  }
  return { question, answer };
}

function MentalMathGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
  const [started, setStarted] = useState(false);
  const [round, setRound] = useState<{ question: string; answer: number } | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [score, setScore] = useState(0);
  const [qNum, setQNum] = useState(0);
  const [qStart, setQStart] = useState(0);
  const [times, setTimes] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);
  const [correctAnswer, setCorrectAnswer] = useState<number | null>(null);

  const nextQuestion = useCallback(() => {
    setRound(generateMathQ(difficulty));
    setUserAnswer('');
    setFeedback(null);
    setCorrectAnswer(null);
    setQStart(Date.now());
  }, [difficulty]);

  function startGame() {
    setScore(0); setQNum(1); setTimes([]); setFinished(false);
    setRound(generateMathQ(difficulty));
    setUserAnswer(''); setFeedback(null); setCorrectAnswer(null);
    setQStart(Date.now());
    setStarted(true);
  }

  function submitAnswer() {
    if (!round || feedback) return;
    const elapsed = (Date.now() - qStart) / 1000;
    const isCorrect = parseInt(userAnswer, 10) === round.answer;
    setFeedback(isCorrect ? 'correct' : 'wrong');
    setCorrectAnswer(round.answer);
    if (isCorrect) setScore(s => s + 1);
    setTimes(t => [...t, elapsed]);
    setTimeout(() => {
      if (qNum >= 10) { setFinished(true); setStarted(false); }
      else { setQNum(n => n + 1); nextQuestion(); }
    }, 1200);
  }

  const avgTime = times.length ? (times.reduce((a, b) => a + b, 0) / times.length).toFixed(1) : '—';

  if (finished) return (
    <div className="text-center space-y-4 py-8">
      <p className="text-5xl">🎯</p>
      <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Round Complete!</h3>
      <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
        <div className="rounded-xl p-4" style={{ background: 'var(--surface)' }}>
          <p className="text-2xl font-black" style={{ color: score >= 8 ? '#16a34a' : score >= 5 ? '#d97706' : '#dc2626' }}>{score}/10</p>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Score</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--surface)' }}>
          <p className="text-2xl font-black" style={{ color: 'var(--accent)' }}>{avgTime}s</p>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Avg time</p>
        </div>
      </div>
      <button onClick={startGame} className="px-8 py-3 rounded-xl font-semibold text-sm text-white" style={{ background: 'var(--accent)' }}>Play Again</button>
    </div>
  );

  if (!started) return (
    <div className="text-center space-y-5 py-8">
      <p className="text-5xl">🧮</p>
      <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Mental Math</h3>
      <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>10 questions — answer as fast as you can!</p>
      <div className="flex gap-2 justify-center">
        {(['Easy', 'Medium', 'Hard'] as Difficulty[]).map(d => (
          <button key={d} onClick={() => setDifficulty(d)}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={d === difficulty ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--surface-border)' }}>
            {d}
          </button>
        ))}
      </div>
      <button onClick={startGame} className="px-10 py-3 rounded-xl font-semibold text-white" style={{ background: 'var(--accent)' }}>Start</button>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-tertiary)' }}>Q {qNum} / 10</p>
        <p className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>Score: {score}</p>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>{difficulty}</span>
      </div>
      <div className="h-1 rounded-full" style={{ background: 'var(--surface-2)' }}>
        <div className="h-full rounded-full" style={{ width: `${(qNum / 10) * 100}%`, background: 'var(--accent)' }} />
      </div>
      <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--surface)', border: '2px solid var(--accent)30' }}>
        <p className="text-3xl font-black" style={{ color: 'var(--text-primary)' }}>{round?.question}</p>
      </div>
      {feedback && (
        <div className="rounded-xl p-3 text-center" style={{ background: feedback === 'correct' ? '#f0fdf4' : '#fef2f2' }}>
          <p className="font-bold" style={{ color: feedback === 'correct' ? '#16a34a' : '#dc2626' }}>
            {feedback === 'correct' ? '✅ Correct!' : `❌ Wrong — Answer: ${correctAnswer}`}
          </p>
        </div>
      )}
      <div className="flex gap-3">
        <input value={userAnswer} onChange={e => setUserAnswer(e.target.value.replace(/[^0-9-]/g, ''))}
          onKeyDown={e => e.key === 'Enter' && submitAnswer()}
          placeholder="Your answer…" type="number" autoFocus
          className="flex-1 px-4 py-3 rounded-xl border text-lg font-bold text-center"
          style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}
          disabled={!!feedback} />
        <button onClick={submitAnswer} disabled={!userAnswer || !!feedback}
          className="px-6 py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-50"
          style={{ background: 'var(--accent)' }}>Submit</button>
      </div>
    </div>
  );
}

// ── Word Scramble ─────────────────────────────────────────────────────────────

const WORD_LIST = [
  { word: 'photosynthesis', hint: 'Biology' }, { word: 'equation', hint: 'Mathematics' },
  { word: 'democracy', hint: 'Social Studies' }, { word: 'molecule', hint: 'Chemistry' },
  { word: 'gravity', hint: 'Physics' }, { word: 'algorithm', hint: 'Computer Science' },
  { word: 'evolution', hint: 'Biology' }, { word: 'velocity', hint: 'Physics' },
  { word: 'hypothesis', hint: 'Science' }, { word: 'metaphor', hint: 'English' },
  { word: 'fraction', hint: 'Mathematics' }, { word: 'chromosome', hint: 'Biology' },
  { word: 'parliament', hint: 'Civics' }, { word: 'oxidation', hint: 'Chemistry' },
  { word: 'frequency', hint: 'Physics' }, { word: 'variable', hint: 'Mathematics' },
  { word: 'membrane', hint: 'Biology' }, { word: 'longitude', hint: 'Geography' },
  { word: 'polynomial', hint: 'Mathematics' }, { word: 'amplitude', hint: 'Physics' },
  { word: 'nitrogen', hint: 'Chemistry' }, { word: 'democracy', hint: 'History' },
  { word: 'isotope', hint: 'Chemistry' }, { word: 'ecosystem', hint: 'Biology' },
  { word: 'latitude', hint: 'Geography' }, { word: 'calculus', hint: 'Mathematics' },
  { word: 'synapse', hint: 'Biology' }, { word: 'electron', hint: 'Physics' },
  { word: 'perimeter', hint: 'Mathematics' }, { word: 'catalyst', hint: 'Chemistry' },
];

function scramble(word: string): string {
  const arr = word.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const result = arr.join('');
  return result === word ? scramble(word) : result;
}

function WordScrambleGame() {
  const [score, setScore] = useState(0);
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * WORD_LIST.length));
  const [scrambled, setScrambled] = useState(() => scramble(WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)].word));
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [total, setTotal] = useState(0);
  const [revealedWord, setRevealedWord] = useState('');

  function loadWord(newIdx: number) {
    setIdx(newIdx);
    setScrambled(scramble(WORD_LIST[newIdx].word));
    setAnswer('');
    setFeedback(null);
    setRevealedWord('');
  }

  function nextWord() {
    const newIdx = Math.floor(Math.random() * WORD_LIST.length);
    loadWord(newIdx);
  }

  function submitGuess() {
    if (!answer.trim()) return;
    const correct = answer.trim().toLowerCase() === WORD_LIST[idx].word.toLowerCase();
    setFeedback(correct ? 'correct' : 'wrong');
    setRevealedWord(WORD_LIST[idx].word);
    setTotal(t => t + 1);
    if (correct) setScore(s => s + 1);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-tertiary)' }}>Words solved: {score} / {total}</p>
        <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>Word Scramble</span>
      </div>
      <div className="rounded-2xl p-8 text-center space-y-3" style={{ background: 'var(--surface)', border: '2px solid var(--accent)30' }}>
        <p className="text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Hint: {WORD_LIST[idx].hint}</p>
        <p className="text-3xl font-black tracking-widest" style={{ color: 'var(--accent)', letterSpacing: '0.2em' }}>
          {scrambled.toUpperCase()}
        </p>
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{WORD_LIST[idx].word.length} letters</p>
      </div>
      {feedback && (
        <div className="rounded-xl p-3 text-center" style={{ background: feedback === 'correct' ? '#f0fdf4' : '#fef2f2' }}>
          <p className="font-bold" style={{ color: feedback === 'correct' ? '#16a34a' : '#dc2626' }}>
            {feedback === 'correct' ? '✅ Correct!' : `❌ Wrong — Answer: ${revealedWord}`}
          </p>
        </div>
      )}
      <div className="flex gap-3">
        <input value={answer} onChange={e => setAnswer(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (feedback ? nextWord() : submitGuess())}
          placeholder="Unscramble the word…" autoFocus
          className="flex-1 px-4 py-3 rounded-xl border text-base"
          style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}
          disabled={!!feedback} />
        {!feedback
          ? <button onClick={submitGuess} disabled={!answer.trim()} className="px-6 py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-50" style={{ background: 'var(--accent)' }}>Submit</button>
          : <button onClick={nextWord} className="px-6 py-3 rounded-xl font-semibold text-sm text-white" style={{ background: '#16a34a' }}>Next</button>
        }
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function BrainBreakPage() {
  const [tab, setTab] = useState<'math' | 'scramble'>('math');

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Brain Break</h1>
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Quick mental games to refresh your mind</p>
      </div>
      <div className="flex gap-2">
        {(['math', 'scramble'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-5 py-2.5 rounded-xl font-semibold text-sm"
            style={tab === t ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--surface-border)' }}>
            {t === 'math' ? '🧮 Mental Math' : '🔤 Word Scramble'}
          </button>
        ))}
      </div>
      <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        {tab === 'math' ? <MentalMathGame /> : <WordScrambleGame />}
      </div>
    </div>
  );
}

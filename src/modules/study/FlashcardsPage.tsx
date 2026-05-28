// [study] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, ChevronLeft, ChevronRight, Loader2, Layers } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import {
  listDecks, createDeck, deleteDeck, getCards, addCard, addCards, recordCardReview, deleteCard,
  getDueCards, updateCardSM2,
  type StudyFlashcardDeck, type StudyFlashcard,
} from '@/lib/db/study';
import { generateFlashcards } from '@/lib/study/studyAI';

const SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography', 'English', 'Economics', 'Science', 'Hindi', 'Other'];

function DeckMasteryBadge({ tenantId, deckId, cardCount }: { tenantId: string; deckId: string; cardCount: number }) {
  const { data: cards = [] } = useQuery({
    queryKey: ['study-mastery', tenantId, deckId],
    queryFn: () => getCards(tenantId, deckId),
    enabled: !!tenantId && cardCount > 0,
  });
  if (!cards.length) return <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{cardCount} cards</p>;
  const mastered = cards.filter(c => (c as any).interval_days >= 7).length;
  const pct = Math.round((mastered / cards.length) * 100);
  return (
    <div className="mt-1">
      <p className="text-xs mb-0.5" style={{ color: 'var(--text-tertiary)' }}>{cardCount} cards · {pct}% mastered</p>
      <div className="h-1.5 w-24 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct === 100 ? '#16a34a' : 'var(--accent)' }} />
      </div>
    </div>
  );
}

type Screen = 'decks' | 'cards' | 'review' | 'smart-review';

export function FlashcardsPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();

  const [screen, setScreen]       = useState<Screen>('decks');
  const [activeDeck, setActiveDeck] = useState<StudyFlashcardDeck | null>(null);
  const [flipped, setFlipped]     = useState(false);
  const [reviewIdx, setReviewIdx] = useState(0);
  const [reviewDone, setReviewDone] = useState<{ correct: number; wrong: number }>({ correct: 0, wrong: 0 });

  // New deck form
  const [showDeckForm, setShowDeckForm] = useState(false);
  const [deckName, setDeckName]   = useState('');
  const [deckSubject, setDeckSubject] = useState('');

  // New card form
  const [showCardForm, setShowCardForm] = useState(false);
  const [front, setFront]         = useState('');
  const [back, setBack]           = useState('');

  // AI generate
  const [showAIForm, setShowAIForm] = useState(false);
  const [notes, setNotes]         = useState('');
  const [aiSubject, setAiSubject] = useState('');

  const { data: decks = [], isLoading: decksLoading } = useQuery({
    queryKey: ['study-decks', tenantId],
    queryFn:  () => listDecks(tenantId),
    enabled:  !!tenantId,
  });

  const { data: cards = [], isLoading: cardsLoading } = useQuery({
    queryKey: ['study-cards', tenantId, activeDeck?.id],
    queryFn:  () => activeDeck ? getCards(tenantId, activeDeck.id) : [],
    enabled:  !!activeDeck,
  });

  const { data: dueCards = [] } = useQuery({
    queryKey: ['study-due-cards', tenantId, activeDeck?.id],
    queryFn:  () => activeDeck ? getDueCards(tenantId, activeDeck.id) : [],
    enabled:  !!activeDeck,
  });

  const createDeckMutation = useMutation({
    mutationFn: () => createDeck(tenantId, deckName.trim(), deckSubject || null).then(() => {}),
    onSuccess: () => { toast.success('Deck created'); setShowDeckForm(false); setDeckName(''); setDeckSubject(''); qc.invalidateQueries({ queryKey: ['study-decks'] }); },
    onError: (e: any) => toast.error(e?.message),
  });

  const deleteDeckMutation = useMutation({
    mutationFn: (id: string) => deleteDeck(tenantId, id),
    onSuccess: () => { toast.success('Deck deleted'); qc.invalidateQueries({ queryKey: ['study-decks'] }); },
  });

  const addCardMutation = useMutation({
    mutationFn: () => addCard(tenantId, activeDeck!.id, front.trim(), back.trim()),
    onSuccess: () => { toast.success('Card added'); setFront(''); setBack(''); setShowCardForm(false); qc.invalidateQueries({ queryKey: ['study-cards'] }); qc.invalidateQueries({ queryKey: ['study-decks'] }); },
    onError: (e: any) => toast.error(e?.message),
  });

  const aiGenerateMutation = useMutation({
    mutationFn: async () => {
      if (!notes.trim()) throw new Error('Paste some notes first');
      toast.loading('AI is generating flashcards…', { id: 'ai-fc' });
      const generated = await generateFlashcards(tenantId, notes, aiSubject || null);
      if (!generated.length) throw new Error('No flashcards generated');
      await addCards(tenantId, activeDeck!.id, generated);
      toast.dismiss('ai-fc');
      return generated.length;
    },
    onSuccess: (count) => { toast.success(`${count} flashcards added!`); setNotes(''); setShowAIForm(false); qc.invalidateQueries({ queryKey: ['study-cards'] }); qc.invalidateQueries({ queryKey: ['study-decks'] }); },
    onError: (e: any) => { toast.dismiss('ai-fc'); toast.error(e?.message ?? 'Generation failed'); },
  });

  const deleteCardMutation = useMutation({
    mutationFn: (id: string) => deleteCard(tenantId, id),
    onSuccess: () => { toast.success('Card removed'); qc.invalidateQueries({ queryKey: ['study-cards'] }); qc.invalidateQueries({ queryKey: ['study-decks'] }); },
  });

  async function handleReview(correct: boolean) {
    const card = cards[reviewIdx];
    await recordCardReview(card.id, correct);
    setReviewDone(d => ({ correct: d.correct + (correct ? 1 : 0), wrong: d.wrong + (correct ? 0 : 1) }));
    setFlipped(false);
    if (reviewIdx + 1 < cards.length) setReviewIdx(i => i + 1);
    else setScreen('cards');
  }

  async function handleSM2Review(quality: number) {
    // quality: 1=Hard(1), 2=Okay(3), 3=Easy(5)
    const qMap = [0, 1, 3, 5];
    const card = dueCards[reviewIdx];
    await updateCardSM2(card.id, qMap[quality]);
    setReviewDone(d => ({ correct: d.correct + (quality >= 2 ? 1 : 0), wrong: d.wrong + (quality < 2 ? 1 : 0) }));
    setFlipped(false);
    if (reviewIdx + 1 < dueCards.length) setReviewIdx(i => i + 1);
    else { qc.invalidateQueries({ queryKey: ['study-due-cards'] }); qc.invalidateQueries({ queryKey: ['study-cards'] }); setScreen('cards'); }
  }

  function startReview() {
    setReviewIdx(0); setFlipped(false); setReviewDone({ correct: 0, wrong: 0 }); setScreen('review');
  }

  function startSmartReview() {
    setReviewIdx(0); setFlipped(false); setReviewDone({ correct: 0, wrong: 0 }); setScreen('smart-review');
  }

  // ── Review screen ──────────────────────────────────────────────────────────
  if (screen === 'review' && cards.length > 0) {
    const card = cards[reviewIdx];
    const done = reviewIdx + 1 > cards.length;
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
        <div className="w-full max-w-lg">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setScreen('cards')} className="text-sm" style={{ color: 'var(--text-tertiary)' }}>← Exit Review</button>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{reviewIdx + 1} / {cards.length}</p>
            <p className="text-sm">✅ {reviewDone.correct} · ❌ {reviewDone.wrong}</p>
          </div>
          <div className="h-2 rounded-full mb-6 overflow-hidden" style={{ background: 'var(--surface-2)' }}>
            <div className="h-full rounded-full" style={{ width: `${((reviewIdx) / cards.length) * 100}%`, background: 'var(--accent)' }} />
          </div>

          {/* Flashcard flip */}
          <div onClick={() => setFlipped(f => !f)}
            className="rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-lg transition-shadow min-h-[220px]"
            style={{ background: flipped ? 'var(--accent)' : 'var(--surface)', border: '2px solid var(--surface-border)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: flipped ? 'rgba(255,255,255,0.7)' : 'var(--text-tertiary)' }}>
              {flipped ? 'Answer' : 'Question — tap to reveal'}
            </p>
            <p className="text-lg font-semibold leading-relaxed" style={{ color: flipped ? 'white' : 'var(--text-primary)' }}>
              {flipped ? card.back : card.front}
            </p>
          </div>

          {flipped && (
            <div className="flex gap-3 mt-5">
              <button onClick={() => handleReview(false)}
                className="flex-1 py-3 rounded-xl font-bold text-sm"
                style={{ background: '#fef2f2', color: '#dc2626', border: '2px solid #fecaca' }}>
                ❌ Still Learning
              </button>
              <button onClick={() => handleReview(true)}
                className="flex-1 py-3 rounded-xl font-bold text-sm"
                style={{ background: '#f0fdf4', color: '#16a34a', border: '2px solid #bbf7d0' }}>
                ✅ Got It!
              </button>
            </div>
          )}
          {!flipped && (
            <p className="text-xs text-center mt-4" style={{ color: 'var(--text-tertiary)' }}>Tap the card to see the answer</p>
          )}
        </div>
      </div>
    );
  }

  // ── Smart Review (Spaced Repetition) ──────────────────────────────────────
  if (screen === 'smart-review') {
    if (dueCards.length === 0) return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4 text-center">
        <p className="text-5xl">🎉</p>
        <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>All caught up!</p>
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No cards due for review today. Come back tomorrow!</p>
        <button onClick={() => setScreen('cards')} className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white" style={{ background: 'var(--accent)' }}>Back to Deck</button>
      </div>
    );
    if (reviewIdx >= dueCards.length) return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4 text-center">
        <p className="text-5xl">🏆</p>
        <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Review Complete!</p>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>✅ {reviewDone.correct} got it · ❌ {reviewDone.wrong} need work</p>
        <button onClick={() => setScreen('cards')} className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white mt-2" style={{ background: 'var(--accent)' }}>Done</button>
      </div>
    );
    const card = dueCards[reviewIdx];
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
        <div className="w-full max-w-lg">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => setScreen('cards')} className="text-sm" style={{ color: 'var(--text-tertiary)' }}>← Exit</button>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: '#ede9fe', color: '#7c3aed' }}>🧠 Smart Review</span>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{reviewIdx + 1}/{dueCards.length}</p>
            </div>
            <p className="text-sm">✅ {reviewDone.correct} · ❌ {reviewDone.wrong}</p>
          </div>
          <div className="h-2 rounded-full mb-6 overflow-hidden" style={{ background: 'var(--surface-2)' }}>
            <div className="h-full rounded-full" style={{ width: `${(reviewIdx / dueCards.length) * 100}%`, background: '#7c3aed' }} />
          </div>
          <div onClick={() => setFlipped(f => !f)}
            className="rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-lg transition-shadow min-h-[220px]"
            style={{ background: flipped ? '#7c3aed' : 'var(--surface)', border: '2px solid var(--surface-border)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: flipped ? 'rgba(255,255,255,0.7)' : 'var(--text-tertiary)' }}>
              {flipped ? 'Answer' : 'Question — tap to reveal'}
            </p>
            <p className="text-lg font-semibold leading-relaxed" style={{ color: flipped ? 'white' : 'var(--text-primary)' }}>
              {flipped ? card.back : card.front}
            </p>
          </div>
          {flipped && (
            <div className="flex gap-2 mt-5">
              <button onClick={() => handleSM2Review(1)}
                className="flex-1 py-3 rounded-xl font-bold text-sm" style={{ background: '#fef2f2', color: '#dc2626', border: '2px solid #fecaca' }}>
                😓 Hard
              </button>
              <button onClick={() => handleSM2Review(2)}
                className="flex-1 py-3 rounded-xl font-bold text-sm" style={{ background: '#fef3c7', color: '#d97706', border: '2px solid #fde68a' }}>
                🤔 Okay
              </button>
              <button onClick={() => handleSM2Review(3)}
                className="flex-1 py-3 rounded-xl font-bold text-sm" style={{ background: '#f0fdf4', color: '#16a34a', border: '2px solid #bbf7d0' }}>
                ✅ Easy!
              </button>
            </div>
          )}
          {!flipped && <p className="text-xs text-center mt-4" style={{ color: 'var(--text-tertiary)' }}>Tap the card to see the answer</p>}
        </div>
      </div>
    );
  }

  // ── Cards screen ───────────────────────────────────────────────────────────
  if (screen === 'cards' && activeDeck) return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <button onClick={() => setScreen('decks')} className="text-sm mb-1 flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
            <ChevronLeft className="h-4 w-4" /> All Decks
          </button>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{activeDeck.name}</h1>
          {activeDeck.subject && <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{activeDeck.subject}</p>}
        </div>
        <div className="flex gap-2">
          {dueCards.length > 0 && (
            <button onClick={startSmartReview}
              className="px-4 py-2.5 rounded-xl font-semibold text-sm text-white relative"
              style={{ background: '#7c3aed' }}>
              🧠 Smart Review
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-bold" style={{ background: 'rgba(255,255,255,0.25)' }}>{dueCards.length}</span>
            </button>
          )}
          {cards.length > 0 && (
            <button onClick={startReview}
              className="px-4 py-2.5 rounded-xl font-semibold text-sm text-white"
              style={{ background: '#16a34a' }}>🃏 Review All</button>
          )}
          <button onClick={() => setShowAIForm(true)}
            className="px-4 py-2.5 rounded-xl font-semibold text-sm border"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>🤖 AI Generate</button>
          <button onClick={() => setShowCardForm(true)}
            className="px-4 py-2.5 rounded-xl font-semibold text-sm text-white"
            style={{ background: 'var(--accent)' }}>
            <Plus className="inline h-4 w-4 mr-1" />Add Card
          </button>
        </div>
      </div>

      {cardsLoading && Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />)}

      {!cardsLoading && cards.length === 0 && (
        <div className="rounded-2xl p-10 flex flex-col items-center gap-3 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <p className="text-4xl">🃏</p>
          <p className="font-semibold" style={{ color: 'var(--text-secondary)' }}>No cards yet</p>
          <div className="flex gap-2 mt-2">
            <button onClick={() => setShowAIForm(true)} className="px-4 py-2 rounded-xl text-sm font-semibold border" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>🤖 Generate from Notes</button>
            <button onClick={() => setShowCardForm(true)} className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>Add Manually</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {cards.map(card => (
          <div key={card.id} className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{card.front}</p>
                <p className="text-xs mt-1 border-t pt-1" style={{ color: 'var(--text-secondary)', borderColor: 'var(--surface-border)' }}>{card.back}</p>
                {card.times_reviewed > 0 && (
                  <p className="text-xs mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
                    Reviewed {card.times_reviewed}× · {Math.round((card.times_correct / card.times_reviewed) * 100)}% correct
                    {(card as any).next_review && <span className="ml-2">· Due {(card as any).next_review}</span>}
                  </p>
                )}
              </div>
              <button onClick={() => deleteCardMutation.mutate(card.id)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 flex-shrink-0">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add card modal */}
      {showCardForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="rounded-2xl p-6 w-full max-w-md space-y-4" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Add Flashcard</h2>
              <button onClick={() => setShowCardForm(false)} className="text-sm px-3 py-1.5 rounded-lg border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Close</button>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Front (Question / Term)</label>
              <textarea value={front} onChange={e => setFront(e.target.value)} rows={2} placeholder="What is…?"
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none resize-none"
                style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Back (Answer / Definition)</label>
              <textarea value={back} onChange={e => setBack(e.target.value)} rows={3} placeholder="Answer…"
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none resize-none"
                style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
            </div>
            <button onClick={() => addCardMutation.mutate()} disabled={!front.trim() || !back.trim() || addCardMutation.isPending}
              className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-60" style={{ background: 'var(--accent)' }}>
              Add Card
            </button>
          </div>
        </div>
      )}

      {/* AI generate modal */}
      {showAIForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="rounded-2xl p-6 w-full max-w-lg space-y-4" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>🤖 Generate from Notes</h2>
              <button onClick={() => setShowAIForm(false)} className="text-sm px-3 py-1.5 rounded-lg border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Close</button>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Paste your notes here</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={8} placeholder="Paste chapter notes, textbook paragraphs, or any study material…"
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none resize-none"
                style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
            </div>
            <button onClick={() => aiGenerateMutation.mutate()} disabled={!notes.trim() || aiGenerateMutation.isPending}
              className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-60 flex items-center justify-center gap-2" style={{ background: 'var(--accent)' }}>
              {aiGenerateMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</> : '🤖 Generate Flashcards'}
            </button>
            <p className="text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>AI will create 8–15 flashcards · Requires internet</p>
          </div>
        </div>
      )}
    </div>
  );

  // ── Decks screen ───────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>StudyMate</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Flashcards</h1>
        </div>
        <button onClick={() => setShowDeckForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white"
          style={{ background: 'var(--accent)' }}>
          <Plus className="h-4 w-4" /> New Deck
        </button>
      </div>

      {decksLoading && Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: 'var(--surface)' }} />)}

      {!decksLoading && decks.length === 0 && (
        <div className="rounded-2xl p-10 flex flex-col items-center gap-3 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <p className="text-4xl">🃏</p>
          <p className="font-semibold" style={{ color: 'var(--text-secondary)' }}>No flashcard decks yet</p>
          <button onClick={() => setShowDeckForm(true)} className="mt-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white" style={{ background: 'var(--accent)' }}>Create First Deck</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {decks.map(deck => (
          <div key={deck.id} onClick={() => { setActiveDeck(deck); setScreen('cards'); }}
            className="rounded-2xl p-5 cursor-pointer hover:shadow-md transition-shadow flex items-center gap-4"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <div className="h-12 w-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: 'var(--surface-2)' }}>🃏</div>
            <div className="flex-1 min-w-0">
              <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{deck.name}</p>
              {deck.subject && <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{deck.subject}</p>}
              <DeckMasteryBadge tenantId={tenantId} deckId={deck.id} cardCount={deck.card_count} />
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={e => { e.stopPropagation(); deleteDeckMutation.mutate(deck.id); }} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500">
                <Trash2 className="h-4 w-4" />
              </button>
              <ChevronRight className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
            </div>
          </div>
        ))}
      </div>

      {/* New deck modal */}
      {showDeckForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="rounded-2xl p-6 w-full max-w-sm space-y-4" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>New Deck</h2>
              <button onClick={() => setShowDeckForm(false)} className="text-sm px-3 py-1.5 rounded-lg border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Close</button>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Deck Name *</label>
              <input value={deckName} onChange={e => setDeckName(e.target.value)} placeholder="e.g. Physics Chapter 5"
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Subject</label>
              <select value={deckSubject} onChange={e => setDeckSubject(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }}>
                <option value="">Select subject</option>
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <button onClick={() => createDeckMutation.mutate()} disabled={!deckName.trim() || createDeckMutation.isPending}
              className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-60" style={{ background: 'var(--accent)' }}>
              Create Deck
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

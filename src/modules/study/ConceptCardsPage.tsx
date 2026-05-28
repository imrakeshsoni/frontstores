// [study] [all tenants]
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import {
  listConceptCards, addConceptCard, deleteConceptCard,
  type StudyConceptCard,
} from '@/lib/db/study';

const SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography', 'English', 'Computer Science', 'Economics', 'Other'];

interface AddForm {
  subject: string; deck_name: string; title: string; content: string; tags: string; image_data: string | null;
}

export function ConceptCardsPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [reviewDeck, setReviewDeck] = useState<string | null>(null);
  const [reviewIdx, setReviewIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [filterSubject, setFilterSubject] = useState('All');
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<AddForm>({ subject: '', deck_name: '', title: '', content: '', tags: '', image_data: null });

  const { data: cards = [] } = useQuery({
    queryKey: ['concept-cards', tenantId],
    queryFn: () => listConceptCards(tenantId),
    enabled: !!tenantId,
  });

  const addMutation = useMutation({
    mutationFn: () => addConceptCard(tenantId, {
      subject: form.subject, deck_name: form.deck_name.trim(), title: form.title.trim(),
      content: form.content.trim(), image_data: form.image_data, tags: form.tags.trim() || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['concept-cards', tenantId] });
      setShowForm(false);
      setForm({ subject: '', deck_name: '', title: '', content: '', tags: '', image_data: null });
      toast.success('Card added');
    },
    onError: () => toast.error('Failed to add card'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteConceptCard(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['concept-cards', tenantId] }); toast.success('Card deleted'); },
  });

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm(f => ({ ...f, image_data: reader.result as string }));
    reader.readAsDataURL(file);
  }

  // Group by subject + deck
  const subjects = ['All', ...Array.from(new Set(cards.map(c => c.subject)))];
  const filtered = filterSubject === 'All' ? cards : cards.filter(c => c.subject === filterSubject);

  const decks = Array.from(new Set(filtered.map(c => `${c.subject}:::${c.deck_name}`))).map(key => {
    const [subject, deck_name] = key.split(':::');
    return { key, subject, deck_name, cards: filtered.filter(c => c.subject === subject && c.deck_name === deck_name) };
  });

  // Review mode
  const reviewCards = reviewDeck ? (decks.find(d => d.key === reviewDeck)?.cards ?? []) : [];
  const currentCard = reviewCards[reviewIdx];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Concept Cards</h1>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{cards.length} cards across {decks.length} decks</p>
        </div>
        <button onClick={() => setShowForm(true)} className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white" style={{ background: 'var(--accent)' }}>+ Add Card</button>
      </div>

      {/* Subject filter */}
      <div className="flex flex-wrap gap-2">
        {subjects.map(s => (
          <button key={s} onClick={() => setFilterSubject(s)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold"
            style={filterSubject === s ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--surface-border)' }}>
            {s}
          </button>
        ))}
      </div>

      {/* Decks */}
      {decks.length === 0 && (
        <div className="text-center py-16 space-y-2">
          <p className="text-4xl">🃏</p>
          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>No concept cards yet</p>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Add cards to start building your knowledge decks</p>
        </div>
      )}

      <div className="space-y-6">
        {decks.map(deck => (
          <div key={deck.key} className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>{deck.deck_name}</h2>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{deck.subject} · {deck.cards.length} cards</p>
              </div>
              <button onClick={() => { setReviewDeck(deck.key); setReviewIdx(0); setFlipped(false); }}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                Review Mode
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {deck.cards.map(card => (
                <div key={card.id} className="rounded-xl p-4 space-y-2" style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{card.title}</p>
                    <button onClick={() => { if (confirm('Delete card?')) deleteMutation.mutate(card.id); }}
                      className="text-xs px-2 py-1 rounded-lg flex-shrink-0"
                      style={{ background: '#fee2e2', color: '#dc2626' }}>Delete</button>
                  </div>
                  <p className="text-xs whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{card.content}</p>
                  {card.image_data && (
                    <img src={card.image_data} alt="card" className="w-full rounded-lg object-cover max-h-32" />
                  )}
                  {card.tags && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {card.tags.split(',').map(t => t.trim()).filter(Boolean).map(t => (
                        <span key={t} className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Review Modal */}
      {reviewDeck && currentCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">{reviewIdx + 1} / {reviewCards.length}</p>
              <button onClick={() => setReviewDeck(null)} className="text-white text-sm">Close</button>
            </div>
            {/* Flip card */}
            <div className="rounded-2xl p-8 min-h-56 flex flex-col items-center justify-center gap-4 cursor-pointer"
              style={{ background: 'var(--bg)', border: '2px solid var(--accent)' }}
              onClick={() => setFlipped(f => !f)}>
              {!flipped ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Tap to reveal</p>
                  <p className="text-xl font-bold text-center" style={{ color: 'var(--text-primary)' }}>{currentCard.title}</p>
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--accent)' }}>Answer</p>
                  <p className="text-base text-center whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>{currentCard.content}</p>
                  {currentCard.image_data && (
                    <img src={currentCard.image_data} alt="card" className="max-h-40 rounded-xl object-contain" />
                  )}
                  {currentCard.tags && (
                    <div className="flex flex-wrap gap-1 justify-center">
                      {currentCard.tags.split(',').map(t => t.trim()).filter(Boolean).map(t => (
                        <span key={t} className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>{t}</span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setReviewIdx(i => Math.max(0, i - 1)); setFlipped(false); }}
                disabled={reviewIdx === 0}
                className="flex-1 py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-40"
                style={{ background: '#6366f1' }}>Previous</button>
              <button onClick={() => { setReviewIdx(i => Math.min(reviewCards.length - 1, i + 1)); setFlipped(false); }}
                disabled={reviewIdx === reviewCards.length - 1}
                className="flex-1 py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-40"
                style={{ background: 'var(--accent)' }}>Next</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" style={{ background: 'var(--bg)', border: '1px solid var(--surface-border)' }}>
            <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Add Concept Card</h2>
            <select value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl border text-sm"
              style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: form.subject ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
              <option value="">Select Subject *</option>
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input value={form.deck_name} onChange={e => setForm(f => ({ ...f, deck_name: e.target.value }))}
              placeholder="Deck name *" className="w-full px-4 py-2.5 rounded-xl border text-sm"
              style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Card title *" className="w-full px-4 py-2.5 rounded-xl border text-sm"
              style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
            <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder="Content / Answer *" rows={4} className="w-full px-4 py-2.5 rounded-xl border text-sm resize-none"
              style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
            <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
              placeholder="Tags (comma separated)" className="w-full px-4 py-2.5 rounded-xl border text-sm"
              style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
            <div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              {form.image_data
                ? <div className="relative"><img src={form.image_data} className="w-full rounded-xl max-h-32 object-cover" alt="preview" />
                    <button onClick={() => setForm(f => ({ ...f, image_data: null }))} className="absolute top-1 right-1 px-2 py-0.5 rounded text-xs" style={{ background: '#fee2e2', color: '#dc2626' }}>Remove</button></div>
                : <button onClick={() => fileRef.current?.click()} className="w-full py-2.5 rounded-xl border text-sm font-medium"
                    style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)', borderStyle: 'dashed' }}>
                    + Add Image (optional)
                  </button>
              }
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl font-semibold text-sm border"
                style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Cancel</button>
              <button onClick={() => addMutation.mutate()} disabled={!form.subject || !form.deck_name.trim() || !form.title.trim() || !form.content.trim() || addMutation.isPending}
                className="flex-1 py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-60"
                style={{ background: 'var(--accent)' }}>
                {addMutation.isPending ? 'Saving…' : 'Add Card'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

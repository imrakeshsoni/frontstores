// [study] [all tenants]
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Star, Search, BookA } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listVocab, addVocab, toggleVocabMastered, deleteVocab } from '@/lib/db/study';

const WORD_OF_DAY_LIST = [
  { word: 'Photosynthesis', meaning: 'Process by which plants use sunlight, water, and CO₂ to produce food and oxygen', example: 'Photosynthesis occurs in the chloroplasts of plant cells.' },
  { word: 'Osmosis', meaning: 'Movement of water molecules through a semipermeable membrane from a lower to higher solute concentration', example: 'Water enters root cells by osmosis.' },
  { word: 'Catalyst', meaning: 'A substance that speeds up a chemical reaction without being consumed in the process', example: 'Enzymes act as biological catalysts in the body.' },
  { word: 'Mitosis', meaning: 'Type of cell division resulting in two daughter cells with the same number of chromosomes as the parent cell', example: 'Skin cells reproduce by mitosis.' },
  { word: 'Entropy', meaning: 'A measure of disorder or randomness in a system', example: 'The entropy of the universe always increases over time.' },
  { word: 'Inertia', meaning: "A body's tendency to resist changes in its state of motion", example: 'A ball at rest stays at rest due to inertia.' },
  { word: 'Democracy', meaning: 'A system of government where power is vested in the people, exercised directly or through elected representatives', example: 'India is the world\'s largest democracy.' },
  { word: 'Ecosystem', meaning: 'A biological community of interacting organisms and their physical environment', example: 'A forest is a complex ecosystem.' },
  { word: 'Refraction', meaning: 'The bending of light as it passes from one medium to another of different density', example: 'A pencil appears bent in water due to refraction.' },
  { word: 'Hypothesis', meaning: 'A proposed explanation for an observation that can be tested through experiments', example: 'The scientist formed a hypothesis about the effect of sunlight on plant growth.' },
  { word: 'Inflation', meaning: 'The rate at which the general level of prices for goods and services rises over time', example: 'High inflation reduces the purchasing power of money.' },
  { word: 'Diffusion', meaning: 'The movement of molecules from a region of higher concentration to a region of lower concentration', example: 'The smell of perfume spreads through diffusion.' },
];

const SUBJECTS = ['English','Science','Mathematics','History','Geography','Economics','Biology','Chemistry','Other'];

export function VocabularyPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState<'all'|'learning'|'mastered'>('all');
  const [form, setForm] = useState({ word:'', meaning:'', example:'', subject:'' });

  const { data: words = [] } = useQuery({ queryKey: ['study-vocab', tenantId], queryFn: () => listVocab(tenantId), enabled: !!tenantId });

  const addMutation = useMutation({
    mutationFn: () => addVocab(tenantId, form.word.trim(), form.meaning.trim(), form.example.trim() || null, form.subject || null),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['study-vocab'] }); setShowAdd(false); setForm({ word:'', meaning:'', example:'', subject:'' }); },
  });

  const masterMutation = useMutation({
    mutationFn: ({ id, m }: { id:string; m:number }) => toggleVocabMastered(tenantId, id, m),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study-vocab'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVocab(tenantId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study-vocab'] }),
  });

  // Word of the day — based on day of year
  const wotd = useMemo(() => {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    return WORD_OF_DAY_LIST[dayOfYear % WORD_OF_DAY_LIST.length];
  }, []);

  const filtered = words.filter(w => {
    const q = search.toLowerCase();
    const matchSearch = !q || w.word.toLowerCase().includes(q) || w.meaning.toLowerCase().includes(q);
    const matchFilter = filter === 'all' || (filter === 'mastered' ? w.mastered : !w.mastered);
    return matchSearch && matchFilter;
  });

  const mastered = words.filter(w => w.mastered).length;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: '#fef3c7' }}>
            <BookA className="h-5 w-5" style={{ color: '#d97706' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Vocabulary Builder</h1>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{mastered}/{words.length} mastered</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white" style={{ background: 'var(--accent)' }}>
          <Plus className="h-4 w-4" /> Add Word
        </button>
      </div>

      {/* Word of the Day */}
      <div className="rounded-2xl p-5" style={{ background: '#fef3c7', border: '2px solid #fde68a' }}>
        <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#92400e' }}>⭐ Word of the Day</p>
        <p className="text-xl font-black" style={{ color: '#78350f' }}>{wotd.word}</p>
        <p className="text-sm mt-1" style={{ color: '#92400e' }}>{wotd.meaning}</p>
        <p className="text-xs mt-2 italic" style={{ color: '#b45309' }}>"{wotd.example}"</p>
        <button onClick={() => { setForm({ word: wotd.word, meaning: wotd.meaning, example: wotd.example, subject: '' }); setShowAdd(true); }}
          className="mt-3 px-4 py-1.5 rounded-xl text-xs font-bold" style={{ background: '#fde68a', color: '#78350f' }}>
          + Save to my bank
        </button>
      </div>

      {/* Search + filter */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search words…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border outline-none"
            style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
        </div>
        {(['all','learning','mastered'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-3 py-2 rounded-xl text-sm font-semibold capitalize"
            style={filter === f ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
            {f}
          </button>
        ))}
      </div>

      {words.length === 0 && (
        <div className="rounded-2xl p-10 flex flex-col items-center gap-3 text-center" style={{ background: 'var(--surface)', border: '2px dashed var(--surface-border)' }}>
          <p className="text-4xl">📚</p>
          <p className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>No words saved yet</p>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Build your personal vocabulary bank — save new words as you encounter them</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(w => (
          <div key={w.id} className="rounded-2xl p-4 flex items-start gap-3"
            style={{ background: w.mastered ? '#f0fdf4' : 'var(--surface)', border: `1px solid ${w.mastered ? '#bbf7d0' : 'var(--surface-border)'}` }}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-black text-lg" style={{ color: 'var(--text-primary)' }}>{w.word}</p>
                {w.subject && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--text-tertiary)' }}>{w.subject}</span>}
              </div>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{w.meaning}</p>
              {w.example && <p className="text-xs mt-1 italic" style={{ color: 'var(--text-tertiary)' }}>"{w.example}"</p>}
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={() => masterMutation.mutate({ id: w.id, m: w.mastered ? 0 : 1 })}
                className="h-8 w-8 rounded-lg flex items-center justify-center"
                style={{ color: w.mastered ? '#d97706' : 'var(--text-tertiary)', background: w.mastered ? '#fef3c7' : 'var(--surface-2)' }}>
                <Star className="h-4 w-4" fill={w.mastered ? 'currentColor' : 'none'} />
              </button>
              <button onClick={() => deleteMutation.mutate(w.id)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-red-50 text-red-400">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-3" style={{ background: 'var(--bg)' }}>
            <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Add Word</h2>
            <input value={form.word} onChange={e => setForm(f=>({...f,word:e.target.value}))} placeholder="Word"
              className="w-full px-4 py-3 rounded-xl text-sm border outline-none" style={{ background:'var(--surface)',borderColor:'var(--surface-border)',color:'var(--text-primary)' }} />
            <textarea value={form.meaning} onChange={e => setForm(f=>({...f,meaning:e.target.value}))} rows={3} placeholder="Meaning / Definition"
              className="w-full px-4 py-3 rounded-xl text-sm border outline-none resize-none" style={{ background:'var(--surface)',borderColor:'var(--surface-border)',color:'var(--text-primary)' }} />
            <input value={form.example} onChange={e => setForm(f=>({...f,example:e.target.value}))} placeholder="Example sentence (optional)"
              className="w-full px-4 py-3 rounded-xl text-sm border outline-none" style={{ background:'var(--surface)',borderColor:'var(--surface-border)',color:'var(--text-primary)' }} />
            <select value={form.subject} onChange={e => setForm(f=>({...f,subject:e.target.value}))}
              className="w-full px-4 py-3 rounded-xl text-sm border outline-none" style={{ background:'var(--surface)',borderColor:'var(--surface-border)',color:'var(--text-primary)' }}>
              <option value="">Subject (optional)</option>
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="flex gap-3">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-3 rounded-xl font-semibold text-sm border" style={{ borderColor:'var(--surface-border)',color:'var(--text-secondary)' }}>Cancel</button>
              <button onClick={() => addMutation.mutate()} disabled={!form.word.trim() || !form.meaning.trim() || addMutation.isPending}
                className="flex-1 py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-50" style={{ background:'var(--accent)' }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

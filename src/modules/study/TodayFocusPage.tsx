// [study] [all tenants]
import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Circle, Plus, Trash2, Target } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getTodayFocus, saveTodayFocus, StudyFocusItem } from '@/lib/db/study';

function genId() { return Math.random().toString(36).slice(2, 9); }

export function TodayFocusPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const [items, setItems] = useState<StudyFocusItem[]>([]);
  const [newText, setNewText] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    getTodayFocus(tenantId).then(data => { setItems(data); setLoaded(true); });
  }, [tenantId]);

  const saveMutation = useMutation({
    mutationFn: (updated: StudyFocusItem[]) => saveTodayFocus(tenantId, updated),
  });

  const update = (updated: StudyFocusItem[]) => {
    setItems(updated);
    saveMutation.mutate(updated);
  };

  const addItem = () => {
    if (!newText.trim()) return;
    update([...items, { id: genId(), text: newText.trim(), done: false }]);
    setNewText('');
  };

  const toggle = (id: string) => update(items.map(i => i.id === id ? { ...i, done: !i.done } : i));
  const remove = (id: string) => update(items.filter(i => i.id !== id));

  const doneCount = items.filter(i => i.done).length;
  const today = new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' });
  const allDone = items.length > 0 && doneCount === items.length;

  if (!loaded) return null;

  return (
    <div className="flex-1 flex flex-col items-center p-6">
      <div className="w-full max-w-md space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: '#dbeafe' }}>
            <Target className="h-5 w-5" style={{ color: '#2563eb' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Today's Focus</h1>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{today} · Resets at midnight</p>
          </div>
        </div>

        {/* Progress ring */}
        {items.length > 0 && (
          <div className="rounded-2xl p-6 flex items-center gap-5" style={{ background: allDone ? '#dcfce7' : 'var(--surface)', border: `2px solid ${allDone ? '#16a34a' : 'var(--surface-border)'}` }}>
            <div className="relative flex-shrink-0">
              <svg width="70" height="70" className="rotate-[-90deg]">
                <circle cx="35" cy="35" r="28" fill="none" strokeWidth="7" stroke="var(--surface-2)" />
                <circle cx="35" cy="35" r="28" fill="none" strokeWidth="7"
                  stroke={allDone ? '#16a34a' : 'var(--accent)'}
                  strokeDasharray={2 * Math.PI * 28}
                  strokeDashoffset={2 * Math.PI * 28 * (1 - (items.length > 0 ? doneCount/items.length : 0))}
                  strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-black" style={{ color: allDone ? '#16a34a' : 'var(--accent)' }}>{doneCount}</span>
              </div>
            </div>
            <div>
              {allDone
                ? <p className="font-bold text-lg" style={{ color: '#16a34a' }}>🎉 All done! Great work today!</p>
                : <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{doneCount} of {items.length} completed</p>}
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{items.length - doneCount} remaining</p>
            </div>
          </div>
        )}

        {items.length === 0 && (
          <div className="rounded-2xl p-8 flex flex-col items-center gap-3 text-center" style={{ background: 'var(--surface)', border: '2px dashed var(--surface-border)' }}>
            <p className="text-4xl">🎯</p>
            <p className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>What are you focusing on today?</p>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Add up to 5 things you want to accomplish today</p>
          </div>
        )}

        {/* Items */}
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-3 rounded-2xl p-4 transition-opacity"
              style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', opacity: item.done ? 0.65 : 1 }}>
              <button onClick={() => toggle(item.id)} style={{ color: item.done ? '#16a34a' : 'var(--text-tertiary)', flexShrink: 0 }}>
                {item.done ? <CheckCircle2 className="h-6 w-6" /> : <Circle className="h-6 w-6" />}
              </button>
              <p className="flex-1 font-medium" style={{ color: 'var(--text-primary)', textDecoration: item.done ? 'line-through' : 'none' }}>
                {item.text}
              </p>
              <button onClick={() => remove(item.id)} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-red-50 text-red-400 flex-shrink-0">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Add item */}
        {items.length < 5 && (
          <div className="flex gap-2">
            <input value={newText} onChange={e => setNewText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addItem()}
              placeholder={`Add focus item ${items.length + 1}/5…`}
              className="flex-1 px-4 py-3 rounded-xl text-sm border outline-none"
              style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
            <button onClick={addItem} disabled={!newText.trim()}
              className="h-12 w-12 rounded-xl flex items-center justify-center text-white disabled:opacity-50" style={{ background: 'var(--accent)' }}>
              <Plus className="h-5 w-5" />
            </button>
          </div>
        )}

        {items.length >= 5 && <p className="text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>Max 5 items — focus on what matters most</p>}
      </div>
    </div>
  );
}

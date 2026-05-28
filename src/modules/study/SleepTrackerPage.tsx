// [study] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { listSleepLog, logSleep, type StudySleepLog } from '@/lib/db/study';

const QUALITY_COLORS = ['', '#dc2626', '#f97316', '#eab308', '#22c55e', '#16a34a'];
const QUALITY_LABELS = ['', 'Terrible', 'Poor', 'Okay', 'Good', 'Excellent'];

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)}
          className="text-2xl transition-all"
          style={{ color: n <= value ? '#eab308' : 'var(--text-tertiary)', filter: n <= value ? 'none' : 'grayscale(1)' }}>
          ★
        </button>
      ))}
    </div>
  );
}

export function SleepTrackerPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ date: today, hours: 7.5, quality: 4, notes: '' });
  const [showForm, setShowForm] = useState(false);

  const { data: logs = [] } = useQuery({
    queryKey: ['sleep-log', tenantId],
    queryFn: () => listSleepLog(tenantId, 30),
    enabled: !!tenantId,
  });

  const logMutation = useMutation({
    mutationFn: () => logSleep(tenantId, form.date, form.hours, form.quality, form.notes.trim() || null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sleep-log', tenantId] });
      setShowForm(false);
      toast.success('Sleep logged');
    },
    onError: () => toast.error('Failed to log sleep'),
  });

  // Last 14 days for chart
  const last14: StudySleepLog[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const found = logs.find(l => l.sleep_date === dateStr);
    last14.push(found ?? { id: '', tenant_id: '', sleep_date: dateStr, hours_slept: 0, quality: 0, notes: null });
  }

  const maxHours = Math.max(...last14.map(l => l.hours_slept), 9);
  const recent7 = last14.slice(-7).filter(l => l.hours_slept > 0);
  const avgHours = recent7.length ? (recent7.reduce((s, l) => s + l.hours_slept, 0) / recent7.length) : 0;
  const lowSleep = avgHours > 0 && avgHours < 6;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Sleep Tracker</h1>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Track your sleep to study better</p>
        </div>
        <button onClick={() => setShowForm(true)} className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white" style={{ background: 'var(--accent)' }}>+ Log Sleep</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>7-Day Average</p>
          <p className="text-3xl font-black mt-1" style={{ color: avgHours >= 7 ? '#16a34a' : avgHours >= 6 ? '#d97706' : '#dc2626' }}>
            {avgHours > 0 ? avgHours.toFixed(1) : '—'}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>hours / night</p>
        </div>
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Days Tracked</p>
          <p className="text-3xl font-black mt-1" style={{ color: 'var(--text-primary)' }}>{logs.length}</p>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>total entries</p>
        </div>
      </div>

      {/* Low sleep warning */}
      {lowSleep && (
        <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
          <span className="text-xl">⚠️</span>
          <div>
            <p className="font-semibold text-sm" style={{ color: '#dc2626' }}>Low sleep may affect study performance</p>
            <p className="text-xs mt-0.5" style={{ color: '#b91c1c' }}>You're averaging only {avgHours.toFixed(1)} hours. Aim for 7–9 hours for optimal learning.</p>
          </div>
        </div>
      )}

      {/* Bar Chart */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Last 14 Days</h2>
        <div className="flex items-end gap-1.5" style={{ height: 120 }}>
          {last14.map((entry, i) => {
            const h = entry.hours_slept;
            const barH = h > 0 ? Math.max(4, Math.round((h / maxHours) * 100)) : 0;
            const color = h === 0 ? 'var(--surface-2)' : QUALITY_COLORS[entry.quality] ?? '#94a3b8';
            const dayLabel = new Date(entry.sleep_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }).split(' ')[0];
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                {h > 0 && (
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded-lg text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap pointer-events-none"
                    style={{ background: 'var(--bg)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }}>
                    {h}h · {QUALITY_LABELS[entry.quality]}
                  </div>
                )}
                <div className="w-full rounded-t-md transition-all" style={{ height: `${barH}%`, background: color, minHeight: h > 0 ? 4 : 0 }} />
                <p className="text-xs" style={{ color: 'var(--text-tertiary)', fontSize: 9 }}>{dayLabel}</p>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          {[1,2,3,4,5].map(q => (
            <div key={q} className="flex items-center gap-1">
              <div className="h-2.5 w-2.5 rounded-sm" style={{ background: QUALITY_COLORS[q] }} />
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{QUALITY_LABELS[q]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Log list */}
      <div className="space-y-3">
        <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Recent Logs</h2>
        {logs.slice(0, 14).map(l => (
          <div key={l.id} className="rounded-xl p-4 flex items-center gap-4" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <div className="h-12 w-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0"
              style={{ background: (QUALITY_COLORS[l.quality] ?? '#94a3b8') + '20' }}>
              <p className="text-lg font-black" style={{ color: QUALITY_COLORS[l.quality] ?? '#94a3b8' }}>{l.hours_slept}h</p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                {new Date(l.sleep_date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
              </p>
              <div className="flex items-center gap-1">
                {[1,2,3,4,5].map(n => (
                  <span key={n} style={{ color: n <= l.quality ? '#eab308' : 'var(--text-tertiary)', fontSize: 12 }}>★</span>
                ))}
                <span className="text-xs ml-1" style={{ color: 'var(--text-tertiary)' }}>{QUALITY_LABELS[l.quality]}</span>
              </div>
              {l.notes && <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-tertiary)' }}>{l.notes}</p>}
            </div>
          </div>
        ))}
        {logs.length === 0 && (
          <div className="text-center py-10">
            <p className="text-3xl mb-2">😴</p>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No sleep logs yet. Start tracking today!</p>
          </div>
        )}
      </div>

      {/* Log Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ background: 'var(--bg)', border: '1px solid var(--surface-border)' }}>
            <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Log Sleep</h2>
            <div>
              <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Date</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                max={today} className="w-full mt-1 px-4 py-2.5 rounded-xl border text-sm"
                style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Hours slept: <span style={{ color: 'var(--accent)' }}>{form.hours}h</span></label>
              <input type="range" min={0.5} max={12} step={0.5} value={form.hours}
                onChange={e => setForm(f => ({ ...f, hours: parseFloat(e.target.value) }))}
                className="w-full mt-2 accent-[var(--accent)]" />
              <div className="flex justify-between text-xs" style={{ color: 'var(--text-tertiary)' }}>
                <span>0.5h</span><span>12h</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>Sleep quality</label>
              <StarRating value={form.quality} onChange={q => setForm(f => ({ ...f, quality: q }))} />
              {form.quality > 0 && <p className="text-xs mt-1" style={{ color: QUALITY_COLORS[form.quality] }}>{QUALITY_LABELS[form.quality]}</p>}
            </div>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Notes (optional)" rows={2} className="w-full px-4 py-2.5 rounded-xl border text-sm resize-none"
              style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
            <div className="flex gap-3">
              <button onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl font-semibold text-sm border"
                style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Cancel</button>
              <button onClick={() => logMutation.mutate()} disabled={form.quality === 0 || logMutation.isPending}
                className="flex-1 py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-60"
                style={{ background: 'var(--accent)' }}>
                {logMutation.isPending ? 'Saving…' : 'Log Sleep'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

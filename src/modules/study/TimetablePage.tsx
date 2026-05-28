// [study] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Calendar } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getTimetable, addTimetableSlot, deleteTimetableSlot, StudyTimetableSlot } from '@/lib/db/study';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SLOT_COLORS = ['#ede9fe', '#dbeafe', '#dcfce7', '#fef3c7', '#fce7f3', '#fee2e2', '#f0fdf4'];
const SLOT_TEXT = ['#7c3aed', '#2563eb', '#16a34a', '#d97706', '#db2777', '#dc2626', '#15803d'];

const today = new Date().getDay();

export function TimetablePage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [activeDay, setActiveDay] = useState(today);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ subject: '', start_time: '09:00', end_time: '10:00', label: '', color: '#ede9fe' });

  const { data: slots = [] } = useQuery({
    queryKey: ['study-timetable', tenantId],
    queryFn: () => getTimetable(tenantId),
    enabled: !!tenantId,
  });

  const addMutation = useMutation({
    mutationFn: () => addTimetableSlot(tenantId, {
      day_of_week: activeDay,
      subject: form.subject.trim(),
      start_time: form.start_time,
      end_time: form.end_time,
      label: form.label.trim() || null,
      color: form.color,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['study-timetable'] }); setShowAdd(false); setForm({ subject: '', start_time: '09:00', end_time: '10:00', label: '', color: '#ede9fe' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTimetableSlot(tenantId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study-timetable'] }),
  });

  const daySlots = slots.filter(s => s.day_of_week === activeDay).sort((a, b) => a.start_time.localeCompare(b.start_time));

  const colorIdx = (color: string) => SLOT_COLORS.indexOf(color);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: '#ede9fe' }}>
            <Calendar className="h-5 w-5" style={{ color: '#7c3aed' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Weekly Timetable</h1>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Plan your study schedule for each day</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white"
          style={{ background: 'var(--accent)' }}>
          <Plus className="h-4 w-4" /> Add Slot
        </button>
      </div>

      {/* Day selector */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {DAYS.map((d, i) => (
          <button key={d} onClick={() => setActiveDay(i)}
            className="flex-shrink-0 flex flex-col items-center px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
            style={activeDay === i
              ? { background: 'var(--accent)', color: '#fff' }
              : { background: 'var(--surface)', border: '1px solid var(--surface-border)', color: i === today ? 'var(--accent)' : 'var(--text-secondary)' }}>
            <span className="text-xs mb-0.5" style={{ opacity: 0.75 }}>{d}</span>
            {i === today && <div className="h-1.5 w-1.5 rounded-full bg-current" />}
          </button>
        ))}
      </div>

      {/* Slots for active day */}
      <div className="space-y-3">
        <h2 className="font-semibold text-sm" style={{ color: 'var(--text-secondary)' }}>{FULL_DAYS[activeDay]}</h2>
        {daySlots.length === 0 && (
          <div className="rounded-2xl p-10 flex flex-col items-center gap-3 text-center"
            style={{ background: 'var(--surface)', border: '2px dashed var(--surface-border)' }}>
            <p className="text-3xl">📅</p>
            <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>No slots yet</p>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Add a study slot for {FULL_DAYS[activeDay]}</p>
          </div>
        )}
        {daySlots.map(slot => {
          const ci = SLOT_COLORS.indexOf(slot.color ?? '#ede9fe');
          const textColor = ci >= 0 ? SLOT_TEXT[ci] : '#7c3aed';
          return (
            <div key={slot.id} className="flex items-center gap-4 rounded-2xl p-4"
              style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
              <div className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 text-lg font-bold"
                style={{ background: slot.color ?? '#ede9fe', color: textColor }}>
                {slot.subject[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{slot.subject}</p>
                {slot.label && <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{slot.label}</p>}
                <p className="text-sm font-medium mt-1" style={{ color: textColor }}>{slot.start_time} – {slot.end_time}</p>
              </div>
              <button onClick={() => deleteMutation.mutate(slot.id)}
                className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Weekly overview mini grid */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Week at a Glance</h2>
        <div className="grid grid-cols-7 gap-1">
          {DAYS.map((d, i) => {
            const count = slots.filter(s => s.day_of_week === i).length;
            return (
              <button key={d} onClick={() => setActiveDay(i)} className="flex flex-col items-center gap-1 p-2 rounded-xl transition-colors"
                style={{ background: activeDay === i ? 'var(--accent-soft)' : 'transparent' }}>
                <span className="text-xs font-medium" style={{ color: i === today ? 'var(--accent)' : 'var(--text-tertiary)' }}>{d}</span>
                <div className="h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold"
                  style={{ background: count > 0 ? 'var(--accent)' : 'var(--surface-2)', color: count > 0 ? '#fff' : 'var(--text-tertiary)' }}>
                  {count > 0 ? count : '–'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Add slot modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ background: 'var(--bg)' }}>
            <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Add Slot — {FULL_DAYS[activeDay]}</h2>
            <div className="space-y-3">
              <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                placeholder="Subject (e.g. Mathematics)"
                className="w-full px-4 py-3 rounded-xl text-sm border outline-none"
                style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
              <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="Label (optional, e.g. Algebra revision)"
                className="w-full px-4 py-3 rounded-xl text-sm border outline-none"
                style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-tertiary)' }}>Start</label>
                  <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl text-sm border outline-none"
                    style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-tertiary)' }}>End</label>
                  <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl text-sm border outline-none"
                    style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium block mb-2" style={{ color: 'var(--text-tertiary)' }}>Color</label>
                <div className="flex gap-2">
                  {SLOT_COLORS.map((c, i) => (
                    <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                      className="h-8 w-8 rounded-full border-2 transition-all"
                      style={{ background: c, borderColor: form.color === c ? SLOT_TEXT[i] : 'transparent' }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAdd(false)}
                className="flex-1 py-3 rounded-xl font-semibold text-sm border"
                style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Cancel</button>
              <button onClick={() => addMutation.mutate()} disabled={!form.subject.trim() || addMutation.isPending}
                className="flex-1 py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-50"
                style={{ background: 'var(--accent)' }}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

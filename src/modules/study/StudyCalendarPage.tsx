// [study] [all tenants]
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getSessionsByDate, listExams, listAssignments } from '@/lib/db/study';

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

export function StudyCalendarPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const [current, setCurrent] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });
  const [selected, setSelected] = useState<string | null>(isoDate(new Date()));

  const firstDay = new Date(current.year, current.month, 1);
  const lastDay  = new Date(current.year, current.month + 1, 0);
  const from = isoDate(firstDay);
  const to   = isoDate(lastDay);

  const { data: sessions = [] } = useQuery({ queryKey: ['study-sessions-cal', tenantId, from, to], queryFn: () => getSessionsByDate(tenantId, from, to), enabled: !!tenantId });
  const { data: exams = [] }    = useQuery({ queryKey: ['study-exams', tenantId], queryFn: () => listExams(tenantId), enabled: !!tenantId });
  const { data: assignments = [] } = useQuery({ queryKey: ['study-assignments', tenantId], queryFn: () => listAssignments(tenantId), enabled: !!tenantId });

  // Build day → data map
  const sessionMap: Record<string, number> = {};
  sessions.forEach(s => { sessionMap[s.session_date] = (sessionMap[s.session_date] ?? 0) + s.duration_minutes; });
  const examMap: Record<string, string[]> = {};
  exams.forEach(e => { if (!examMap[e.exam_date]) examMap[e.exam_date] = []; examMap[e.exam_date].push(e.exam_name); });
  const assignMap: Record<string, string[]> = {};
  assignments.forEach(a => { if (a.due_date) { if (!assignMap[a.due_date]) assignMap[a.due_date] = []; assignMap[a.due_date].push(a.title); } });

  // Build calendar grid
  const startPad = firstDay.getDay(); // 0=Sun
  const days: (number | null)[] = [...Array(startPad).fill(null), ...Array.from({ length: lastDay.getDate() }, (_, i) => i + 1)];
  while (days.length % 7 !== 0) days.push(null);

  const today = isoDate(new Date());

  const prevMonth = () => setCurrent(c => c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 });
  const nextMonth = () => setCurrent(c => c.month === 11 ? { year: c.year + 1, month: 0 } : { ...c, month: c.month + 1 });

  const monthName = firstDay.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  // Selected day details
  const selectedSessions = selected ? sessions.filter(s => s.session_date === selected) : [];
  const selectedExams = selected ? (examMap[selected] ?? []) : [];
  const selectedAssigns = selected ? (assignMap[selected] ?? []) : [];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: '#dbeafe' }}>
          <CalendarDays className="h-5 w-5" style={{ color: '#2563eb' }} />
        </div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Study Calendar</h1>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="h-9 w-9 rounded-xl flex items-center justify-center border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}><ChevronLeft className="h-4 w-4" /></button>
        <p className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{monthName}</p>
        <button onClick={nextMonth} className="h-9 w-9 rounded-xl flex items-center justify-center border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}><ChevronRight className="h-4 w-4" /></button>
      </div>

      {/* Calendar grid */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        {/* Day headers */}
        <div className="grid grid-cols-7">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="text-center text-xs font-semibold py-2.5" style={{ color: 'var(--text-tertiary)', borderBottom: '1px solid var(--surface-border)' }}>{d}</div>
          ))}
        </div>
        {/* Days */}
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            if (!day) return <div key={i} className="h-16 border-b border-r" style={{ borderColor: 'var(--surface-border)' }} />;
            const dateStr = isoDate(new Date(current.year, current.month, day));
            const mins = sessionMap[dateStr] ?? 0;
            const hasExam = !!examMap[dateStr];
            const hasAssign = !!assignMap[dateStr];
            const isToday = dateStr === today;
            const isSelected = dateStr === selected;
            const intensity = mins > 0 ? Math.min(1, mins / 120) : 0;
            return (
              <button key={i} onClick={() => setSelected(dateStr)}
                className="h-16 flex flex-col items-center justify-start pt-1.5 gap-1 border-b border-r transition-colors hover:bg-opacity-80"
                style={{ borderColor: 'var(--surface-border)', background: isSelected ? 'var(--accent-soft)' : 'transparent' }}>
                <span className={`h-7 w-7 flex items-center justify-center rounded-full text-xs font-bold`}
                  style={isToday ? { background: 'var(--accent)', color: '#fff' } : { color: isSelected ? 'var(--accent)' : 'var(--text-primary)' }}>
                  {day}
                </span>
                <div className="flex gap-0.5 items-center">
                  {mins > 0 && (
                    <div className="h-1.5 rounded-full" style={{ width: `${Math.max(6, Math.round(intensity * 20))}px`, background: '#7c3aed', opacity: 0.7 + intensity * 0.3 }} />
                  )}
                  {hasExam && <div className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: '#d97706' }} />}
                  {hasAssign && <div className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: '#dc2626' }} />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs flex-wrap">
        {[
          { color: '#7c3aed', label: 'Study time' },
          { color: '#d97706', label: 'Exam' },
          { color: '#dc2626', label: 'Assignment due' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
            <span style={{ color: 'var(--text-tertiary)' }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Selected day detail */}
      {selected && (selectedSessions.length > 0 || selectedExams.length > 0 || selectedAssigns.length > 0) && (
        <div className="rounded-2xl p-5 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <p className="font-bold" style={{ color: 'var(--text-primary)' }}>
            {new Date(selected).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          {selectedSessions.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: '#7c3aed' }}>📚 Study Sessions</p>
              {selectedSessions.map(s => (
                <div key={s.id} className="flex items-center gap-3 rounded-xl px-3 py-2 mb-1" style={{ background: '#ede9fe' }}>
                  <span className="text-sm font-semibold" style={{ color: '#7c3aed' }}>{s.subject}</span>
                  <span className="text-xs ml-auto" style={{ color: '#6d28d9' }}>{s.duration_minutes}min</span>
                  {s.notes && <span className="text-xs" style={{ color: '#7c3aed', opacity: 0.75 }}>{s.notes}</span>}
                </div>
              ))}
            </div>
          )}
          {selectedExams.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: '#d97706' }}>🎓 Exam{selectedExams.length > 1 ? 's' : ''}</p>
              {selectedExams.map(e => (
                <div key={e} className="rounded-xl px-3 py-2 mb-1" style={{ background: '#fef3c7' }}>
                  <p className="text-sm font-semibold" style={{ color: '#92400e' }}>{e}</p>
                </div>
              ))}
            </div>
          )}
          {selectedAssigns.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: '#dc2626' }}>📋 Due Assignments</p>
              {selectedAssigns.map(a => (
                <div key={a} className="rounded-xl px-3 py-2 mb-1" style={{ background: '#fee2e2' }}>
                  <p className="text-sm font-semibold" style={{ color: '#991b1b' }}>{a}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

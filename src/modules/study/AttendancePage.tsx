// [study] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { markAttendance, getAttendanceBySubject, getAttendanceForMonth, StudyAttendance } from '@/lib/db/study';

const STATUS_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  present: { label: 'P', bg: '#dcfce7', color: '#16a34a' },
  absent:  { label: 'A', bg: '#fee2e2', color: '#dc2626' },
  late:    { label: 'L', bg: '#fef3c7', color: '#d97706' },
};

const SUBJECTS = ['Mathematics','Physics','Chemistry','Biology','History','Geography','English','Economics','Science','Hindi'];

export function AttendancePage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [activeSubject, setActiveSubject] = useState(SUBJECTS[0]);
  const [month, setMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; });
  const [customSubjects, setCustomSubjects] = useState<string[]>([]);
  const [newSubj, setNewSubj] = useState('');

  const allSubjects = [...new Set([...SUBJECTS, ...customSubjects])];

  const { data: overview = [] } = useQuery({ queryKey: ['study-att-overview', tenantId], queryFn: () => getAttendanceBySubject(tenantId), enabled: !!tenantId });
  const { data: monthData = [] } = useQuery({
    queryKey: ['study-att-month', tenantId, activeSubject, month],
    queryFn: () => getAttendanceForMonth(tenantId, activeSubject, month),
    enabled: !!tenantId && !!activeSubject,
  });

  const markMutation = useMutation({
    mutationFn: ({ date, status }: { date: string; status: 'present'|'absent'|'late' }) =>
      markAttendance(tenantId, activeSubject, date, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['study-att-month'] }); qc.invalidateQueries({ queryKey: ['study-att-overview'] }); },
  });

  const prevMonth = () => setMonth(m => { const [y,mo] = m.split('-').map(Number); return mo===1?`${y-1}-12`:`${y}-${String(mo-1).padStart(2,'0')}`; });
  const nextMonth = () => setMonth(m => { const [y,mo] = m.split('-').map(Number); return mo===12?`${y+1}-01`:`${y}-${String(mo+1).padStart(2,'0')}`; });

  const monthMap = monthData.reduce<Record<string, StudyAttendance>>((acc, a) => { acc[a.att_date] = a; return acc; }, {});

  const [y, mo] = month.split('-').map(Number);
  const firstDay = new Date(y, mo-1, 1).getDay();
  const daysInMonth = new Date(y, mo, 0).getDate();
  const monthName = new Date(y, mo-1).toLocaleDateString('en-IN', { month:'long', year:'numeric' });
  const today = new Date().toISOString().slice(0,10);

  const subjectStat = overview.find(o => o.subject === activeSubject);

  const cycleStatus = (date: string) => {
    const current = monthMap[date]?.status ?? null;
    const next = current === null ? 'present' : current === 'present' ? 'absent' : current === 'absent' ? 'late' : 'present';
    markMutation.mutate({ date, status: next });
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: '#dcfce7' }}>
          <UserCheck className="h-5 w-5" style={{ color: '#16a34a' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Attendance Tracker</h1>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Tap a date to mark P/A/L • Alert below 75%</p>
        </div>
      </div>

      {/* Subject overview chips */}
      <div className="space-y-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {allSubjects.map(s => {
            const stat = overview.find(o => o.subject === s);
            const pct = stat?.pct ?? null;
            return (
              <button key={s} onClick={() => setActiveSubject(s)}
                className="flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-xl transition-all"
                style={activeSubject === s ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
                <span className="text-xs font-semibold">{s.substring(0,5)}</span>
                {pct !== null && (
                  <span className="text-xs font-bold" style={{ color: activeSubject === s ? '#fff' : pct < 75 ? '#dc2626' : '#16a34a' }}>{pct}%</span>
                )}
              </button>
            );
          })}
        </div>
        {/* Add custom subject */}
        <div className="flex gap-2">
          <input value={newSubj} onChange={e => setNewSubj(e.target.value)} placeholder="Add subject…"
            className="flex-1 px-3 py-2 rounded-xl text-sm border outline-none"
            style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
          <button onClick={() => { if(newSubj.trim()) { setCustomSubjects(p => [...p, newSubj.trim()]); setActiveSubject(newSubj.trim()); setNewSubj(''); } }}
            disabled={!newSubj.trim()}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: 'var(--accent)' }}>Add</button>
        </div>
      </div>

      {/* Subject stats */}
      {subjectStat && (
        <div className="rounded-2xl p-4 flex items-center gap-4" style={{ background: subjectStat.pct < 75 ? '#fee2e2' : '#dcfce7', border: `2px solid ${subjectStat.pct < 75 ? '#fecaca' : '#bbf7d0'}` }}>
          <div>
            <p className="text-3xl font-black" style={{ color: subjectStat.pct < 75 ? '#dc2626' : '#16a34a' }}>{subjectStat.pct}%</p>
            <p className="text-xs font-semibold" style={{ color: subjectStat.pct < 75 ? '#b91c1c' : '#15803d' }}>{activeSubject}</p>
          </div>
          <div className="flex-1">
            {subjectStat.pct < 75 && <p className="text-sm font-bold" style={{ color: '#dc2626' }}>⚠️ Below 75% — attendance shortage!</p>}
            <p className="text-xs mt-1" style={{ color: subjectStat.pct < 75 ? '#b91c1c' : '#166534' }}>
              {subjectStat.present}P · {subjectStat.absent}A · {subjectStat.late}L · {subjectStat.total} total
            </p>
          </div>
        </div>
      )}

      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="h-9 w-9 rounded-xl flex items-center justify-center border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}><ChevronLeft className="h-4 w-4" /></button>
        <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{monthName}</p>
        <button onClick={nextMonth} className="h-9 w-9 rounded-xl flex items-center justify-center border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}><ChevronRight className="h-4 w-4" /></button>
      </div>

      {/* Calendar grid */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <div className="grid grid-cols-7">
          {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
            <div key={d} className="text-center text-xs font-semibold py-2" style={{ color: 'var(--text-tertiary)', borderBottom: '1px solid var(--surface-border)' }}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array(firstDay).fill(null).map((_,i) => <div key={`pad-${i}`} className="h-12 border-b border-r" style={{ borderColor: 'var(--surface-border)' }} />)}
          {Array.from({length: daysInMonth}, (_,i) => {
            const day = i+1;
            const dateStr = `${month}-${String(day).padStart(2,'0')}`;
            const att = monthMap[dateStr];
            const isToday = dateStr === today;
            const isFuture = dateStr > today;
            const style = att ? STATUS_STYLE[att.status] : null;
            return (
              <button key={day} onClick={() => !isFuture && cycleStatus(dateStr)}
                disabled={isFuture}
                className="h-12 flex flex-col items-center justify-center border-b border-r transition-colors"
                style={{ borderColor: 'var(--surface-border)', background: style ? style.bg : 'transparent', cursor: isFuture ? 'default' : 'pointer', opacity: isFuture ? 0.3 : 1 }}>
                <span className="text-xs font-semibold" style={{ color: isToday ? 'var(--accent)' : 'var(--text-primary)' }}>{day}</span>
                {style && <span className="text-xs font-black" style={{ color: style.color }}>{style.label}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-3 text-xs">
        {Object.entries(STATUS_STYLE).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <div className="h-5 w-5 rounded flex items-center justify-center font-bold text-xs" style={{ background: v.bg, color: v.color }}>{v.label}</div>
            <span style={{ color: 'var(--text-secondary)' }}>{k}</span>
          </div>
        ))}
        <span style={{ color: 'var(--text-tertiary)' }}>· Tap a date to cycle P→A→L→P</span>
      </div>
    </div>
  );
}

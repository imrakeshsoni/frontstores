// [study] [all tenants]
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getYearHeatmap, getSubjectHealthScores, getMonthlyReport } from '@/lib/db/study';

function minToHr(m: number) { if (m < 60) return `${m}m`; return `${Math.floor(m / 60)}h ${m % 60}m`; }

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function HeatmapPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const [tab, setTab] = useState<'heatmap' | 'health' | 'report'>('heatmap');
  const [reportMonth, setReportMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });

  const { data: heatmap = [] } = useQuery({ queryKey: ['study-heatmap', tenantId], queryFn: () => getYearHeatmap(tenantId), enabled: !!tenantId && tab === 'heatmap' });
  const { data: health = [] }  = useQuery({ queryKey: ['study-health', tenantId], queryFn: () => getSubjectHealthScores(tenantId), enabled: !!tenantId && tab === 'health' });
  const { data: report }       = useQuery({ queryKey: ['study-monthly-report', tenantId, reportMonth], queryFn: () => getMonthlyReport(tenantId, reportMonth), enabled: !!tenantId && tab === 'report' });

  const prevMonth = () => setReportMonth(m => { const [y, mo] = m.split('-').map(Number); return mo === 1 ? `${y-1}-12` : `${y}-${String(mo-1).padStart(2,'0')}`; });
  const nextMonth = () => setReportMonth(m => { const [y, mo] = m.split('-').map(Number); return mo === 12 ? `${y+1}-01` : `${y}-${String(mo+1).padStart(2,'0')}`; });

  // Build heatmap grid — last 52 weeks
  const heatmapMap: Record<string, number> = {};
  heatmap.forEach(h => { heatmapMap[h.date] = h.minutes; });
  const maxMinutes = Math.max(...heatmap.map(h => h.minutes), 1);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const startDate = new Date(today); startDate.setDate(today.getDate() - 364);
  // Align to Sunday
  while (startDate.getDay() !== 0) startDate.setDate(startDate.getDate() - 1);

  const weeks: { date: Date; dateStr: string; mins: number }[][] = [];
  let d = new Date(startDate);
  while (d <= today) {
    const week: { date: Date; dateStr: string; mins: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const ds = d.toISOString().slice(0, 10);
      week.push({ date: new Date(d), dateStr: ds, mins: heatmapMap[ds] ?? 0 });
      d.setDate(d.getDate() + 1);
    }
    weeks.push(week);
  }

  function heatColor(mins: number): string {
    if (mins === 0) return 'var(--surface-2)';
    const ratio = Math.min(1, mins / maxMinutes);
    if (ratio < 0.25) return '#c4b5fd';
    if (ratio < 0.5)  return '#a78bfa';
    if (ratio < 0.75) return '#7c3aed';
    return '#5b21b6';
  }

  const totalDaysStudied = heatmap.length;
  const totalMinutes = heatmap.reduce((s, h) => s + h.minutes, 0);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: '#ede9fe' }}>
          <BarChart3 className="h-5 w-5" style={{ color: '#7c3aed' }} />
        </div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Analytics</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['heatmap', 'health', 'report'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all"
            style={tab === t ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
            {t === 'heatmap' ? 'Year Heatmap' : t === 'health' ? 'Subject Health' : 'Monthly Report'}
          </button>
        ))}
      </div>

      {/* HEATMAP */}
      {tab === 'heatmap' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl p-4 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
              <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{totalDaysStudied}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Days studied (year)</p>
            </div>
            <div className="rounded-2xl p-4 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
              <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{minToHr(totalMinutes)}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Total study time</p>
            </div>
          </div>

          <div className="rounded-2xl p-5 overflow-x-auto" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-tertiary)' }}>Last 12 months — each cell = 1 day</p>
            <div className="flex gap-1">
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-1">
                  {week.map((day, di) => (
                    <div key={di}
                      className="h-3 w-3 rounded-sm flex-shrink-0"
                      style={{ background: day.date > today ? 'transparent' : heatColor(day.mins) }}
                      title={day.dateStr + (day.mins > 0 ? ` — ${minToHr(day.mins)}` : '')} />
                  ))}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Less</span>
              {['var(--surface-2)', '#c4b5fd', '#a78bfa', '#7c3aed', '#5b21b6'].map(c => (
                <div key={c} className="h-3 w-3 rounded-sm" style={{ background: c }} />
              ))}
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>More</span>
            </div>
          </div>
        </div>
      )}

      {/* SUBJECT HEALTH */}
      {tab === 'health' && (
        <div className="space-y-3">
          {health.length === 0 && (
            <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
              <p className="text-3xl mb-2">📊</p>
              <p className="font-semibold" style={{ color: 'var(--text-secondary)' }}>No data yet — start logging sessions and taking tests</p>
            </div>
          )}
          {health.map(s => (
            <div key={s.subject} className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
              <div className="flex items-center justify-between mb-3">
                <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{s.subject}</p>
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-full flex items-center justify-center font-black text-sm"
                    style={{ background: s.health >= 70 ? '#dcfce7' : s.health >= 40 ? '#fef3c7' : '#fee2e2', color: s.health >= 70 ? '#16a34a' : s.health >= 40 ? '#d97706' : '#dc2626' }}>
                    {s.health}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { label: 'Time Logged', value: s.time_score, color: '#7c3aed' },
                  { label: 'Test Avg', value: s.test_score, color: '#16a34a' },
                  { label: 'Flashcards', value: s.flashcard_score, color: '#d97706' },
                ].map(bar => (
                  <div key={bar.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ color: 'var(--text-tertiary)' }}>{bar.label}</span>
                      <span className="font-semibold" style={{ color: bar.color }}>{bar.value}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                      <div className="h-full rounded-full" style={{ width: `${bar.value}%`, background: bar.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MONTHLY REPORT */}
      {tab === 'report' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button onClick={prevMonth} className="h-9 w-9 rounded-xl flex items-center justify-center border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}><ChevronLeft className="h-4 w-4" /></button>
            <p className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
              {MONTH_NAMES[parseInt(reportMonth.split('-')[1]) - 1]} {reportMonth.split('-')[0]}
            </p>
            <button onClick={nextMonth} className="h-9 w-9 rounded-xl flex items-center justify-center border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}><ChevronRight className="h-4 w-4" /></button>
          </div>

          {report && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { label: 'Total Time', value: minToHr(report.total_minutes), icon: '⏱️', bg: '#dbeafe', color: '#2563eb' },
                  { label: 'Sessions', value: String(report.sessions), icon: '📚', bg: '#dcfce7', color: '#16a34a' },
                  { label: 'Days Active', value: String(report.streak_days), icon: '🔥', bg: '#fef3c7', color: '#d97706' },
                  { label: 'Tests Done', value: String(report.tests_done), icon: '📝', bg: '#ede9fe', color: '#7c3aed' },
                  { label: 'Avg Score', value: report.tests_done ? `${report.avg_test_score}%` : '—', icon: '🎯', bg: '#dcfce7', color: '#16a34a' },
                ].map(stat => (
                  <div key={stat.label} className="rounded-2xl p-4 flex items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: stat.bg }}>{stat.icon}</div>
                    <div>
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{stat.label}</p>
                      <p className="font-bold text-lg" style={{ color: stat.color }}>{stat.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {report.subjects.length > 0 && (
                <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
                  <p className="font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Time by Subject</p>
                  {(() => {
                    const max = Math.max(...report.subjects.map(s => s.minutes), 1);
                    return report.subjects.map(s => (
                      <div key={s.subject} className="mb-2">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{s.subject}</span>
                          <span style={{ color: 'var(--text-tertiary)' }}>{minToHr(s.minutes)}</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                          <div className="h-full rounded-full" style={{ width: `${(s.minutes / max) * 100}%`, background: 'var(--accent)' }} />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}

              {report.total_minutes === 0 && (
                <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
                  <p className="text-3xl mb-2">📊</p>
                  <p className="font-semibold" style={{ color: 'var(--text-secondary)' }}>No study data for this month</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

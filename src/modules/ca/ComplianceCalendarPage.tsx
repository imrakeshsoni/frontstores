// [ca] [all tenants]
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listCATasks, listCAClients } from '@/lib/db/ca';

// Standard Indian tax compliance due dates (recurring every year)
const COMPLIANCE_DEADLINES: { label: string; month: number; day: number; category: string; fy_sensitive?: boolean }[] = [
  // GST
  { label: 'GSTR-1 (Monthly)', month: 11, day: 11, category: 'GST' },
  { label: 'GSTR-3B (Monthly)', month: 20, day: 20, category: 'GST' },
  { label: 'GSTR-9 Annual Return', month: 12, day: 31, category: 'GST' },
  // TDS
  { label: 'TDS Q1 Return (Apr–Jun)', month: 7, day: 31, category: 'TDS' },
  { label: 'TDS Q2 Return (Jul–Sep)', month: 10, day: 31, category: 'TDS' },
  { label: 'TDS Q3 Return (Oct–Dec)', month: 1, day: 31, category: 'TDS' },
  { label: 'TDS Q4 Return (Jan–Mar)', month: 5, day: 31, category: 'TDS' },
  // Advance Tax
  { label: 'Advance Tax Instalment 1', month: 6, day: 15, category: 'Advance Tax' },
  { label: 'Advance Tax Instalment 2', month: 9, day: 15, category: 'Advance Tax' },
  { label: 'Advance Tax Instalment 3', month: 12, day: 15, category: 'Advance Tax' },
  { label: 'Advance Tax Instalment 4', month: 3, day: 15, category: 'Advance Tax' },
  // ITR
  { label: 'ITR Filing (Individuals)', month: 7, day: 31, category: 'ITR' },
  { label: 'ITR Filing (Audit Cases)', month: 10, day: 31, category: 'ITR' },
  { label: 'ITR Filing (TP Cases)', month: 11, day: 30, category: 'ITR' },
  // ROC / Company
  { label: 'Annual ROC Filing (AOC-4)', month: 10, day: 29, category: 'ROC' },
  { label: 'Annual ROC Filing (MGT-7)', month: 11, day: 28, category: 'ROC' },
  // Other
  { label: 'Tax Audit Report', month: 9, day: 30, category: 'Audit' },
  { label: 'Form 15CA/CB Deadline', month: 3, day: 31, category: 'Other' },
];

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  GST:          { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' },
  TDS:          { bg: '#fce7f3', text: '#9d174d', border: '#f9a8d4' },
  ITR:          { bg: '#dcfce7', text: '#166534', border: '#86efac' },
  'Advance Tax':{ bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  ROC:          { bg: '#ede9fe', text: '#5b21b6', border: '#c4b5fd' },
  Audit:        { bg: '#ffedd5', text: '#9a3412', border: '#fdba74' },
  Other:        { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' },
};

function daysUntil(month: number, day: number): number {
  const now = new Date();
  const year = now.getMonth() + 1 > month ? now.getFullYear() + 1 : now.getFullYear();
  const target = new Date(year, month - 1, day);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

export function CAComplianceCalendarPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const [filterCategory, setFilterCategory] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const { data: tasks = [] } = useQuery({
    queryKey: ['ca-tasks', tenantId],
    queryFn: () => listCATasks(tenantId),
    enabled: !!tenantId,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['ca-clients', tenantId, ''],
    queryFn: () => listCAClients(tenantId),
    enabled: !!tenantId,
  });

  // Group client tasks by month of due date
  const tasksByMonth: Record<number, typeof tasks> = {};
  for (const t of tasks) {
    if (t.due_date && t.status !== 'completed') {
      const m = new Date(t.due_date).getMonth() + 1;
      if (!tasksByMonth[m]) tasksByMonth[m] = [];
      tasksByMonth[m].push(t);
    }
  }

  const categories = Array.from(new Set(COMPLIANCE_DEADLINES.map(d => d.category)));

  const visibleDeadlines = COMPLIANCE_DEADLINES
    .filter(d => !filterCategory || d.category === filterCategory)
    .filter(d => !selectedMonth || d.month === selectedMonth)
    .sort((a, b) => {
      const da = daysUntil(a.month, a.day);
      const db = daysUntil(b.month, b.day);
      return da - db;
    });

  function clientName(id: string) { return clients.find(c => c.id === id)?.name ?? '—'; }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Compliance Calendar</h1>
        <p className="text-slate-400 text-sm mt-0.5">Indian tax & regulatory due dates</p>
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilterCategory('')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${!filterCategory ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-400'}`}>
          All
        </button>
        {categories.map(cat => {
          const c = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.Other;
          return (
            <button key={cat} onClick={() => setFilterCategory(filterCategory === cat ? '' : cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${filterCategory === cat ? '' : 'bg-white hover:opacity-80'}`}
              style={filterCategory === cat ? { background: c.bg, color: c.text, borderColor: c.border } : { borderColor: '#e2e8f0', color: '#475569' }}>
              {cat}
            </button>
          );
        })}
      </div>

      {/* Month strip */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {MONTH_NAMES.map((m, i) => {
          const mn = i + 1;
          const hasClientTasks = !!tasksByMonth[mn]?.length;
          const deadlineCount = COMPLIANCE_DEADLINES.filter(d => d.month === mn && (!filterCategory || d.category === filterCategory)).length;
          return (
            <button key={m} onClick={() => setSelectedMonth(selectedMonth === mn ? null : mn)}
              className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-xl text-xs font-medium transition-all border ${selectedMonth === mn ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'}`}>
              <span>{m}</span>
              {deadlineCount > 0 && <span className={`mt-0.5 text-[10px] font-bold ${selectedMonth === mn ? 'text-blue-100' : 'text-blue-500'}`}>{deadlineCount}</span>}
              {hasClientTasks && <span className={`mt-0.5 w-1.5 h-1.5 rounded-full ${selectedMonth === mn ? 'bg-amber-300' : 'bg-amber-400'}`} />}
            </button>
          );
        })}
      </div>

      {/* Deadlines list */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">
          {selectedMonth ? `${MONTH_NAMES[selectedMonth - 1]} Deadlines` : 'All Deadlines'} — sorted by nearest first
        </h2>
        {visibleDeadlines.map((d, i) => {
          const days = daysUntil(d.month, d.day);
          const c = CATEGORY_COLORS[d.category] ?? CATEGORY_COLORS.Other;
          const overdue = days < 0;
          const urgent = days >= 0 && days <= 7;
          return (
            <div key={i} className={`bg-white rounded-xl border p-3 flex items-center justify-between ${overdue ? 'border-red-200 bg-red-50' : urgent ? 'border-amber-200 bg-amber-50' : 'border-slate-100'}`}>
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold" style={{ background: c.bg, color: c.text }}>
                  {d.month < 10 ? `0${d.month}` : d.month}
                </span>
                <div>
                  <p className={`text-sm font-medium ${overdue ? 'text-red-800' : 'text-slate-800'}`}>{d.label}</p>
                  <p className="text-xs text-slate-400">{`${MONTH_NAMES[d.month - 1]} ${d.day}`}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: c.bg, color: c.text }}>{d.category}</span>
                <span className={`text-xs font-semibold ${overdue ? 'text-red-600' : urgent ? 'text-amber-600' : 'text-slate-400'}`}>
                  {overdue ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today!' : `${days}d left`}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Client tasks for selected month */}
      {selectedMonth && tasksByMonth[selectedMonth]?.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-4 w-4 text-amber-500" />
            <h2 className="font-semibold text-slate-800">Client Tasks — {MONTH_NAMES[selectedMonth - 1]}</h2>
          </div>
          <div className="space-y-2">
            {tasksByMonth[selectedMonth].map(t => {
              const overdue = t.due_date && t.due_date < today;
              return (
                <div key={t.id} className={`flex items-center justify-between text-sm rounded-xl px-3 py-2 ${overdue ? 'bg-red-50' : 'bg-slate-50'}`}>
                  <div>
                    <span className="font-medium text-slate-800">{t.task_type}</span>
                    <span className="text-slate-400 text-xs ml-2">{clientName(t.client_id)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {overdue ? <AlertTriangle className="h-3.5 w-3.5 text-red-500" /> : <Clock className="h-3.5 w-3.5 text-amber-500" />}
                    <span className={`text-xs font-medium ${overdue ? 'text-red-600' : 'text-amber-600'}`}>
                      {t.due_date ? new Date(t.due_date).toLocaleDateString('en-IN') : '—'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="bg-slate-50 rounded-2xl p-4">
        <h3 className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wide">Legend</h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: <Clock className="h-3.5 w-3.5 text-amber-500" />, label: 'Due within 7 days — amber highlight' },
            { icon: <AlertTriangle className="h-3.5 w-3.5 text-red-500" />, label: 'Past due — red highlight' },
            { icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />, label: 'Completed client tasks' },
            { icon: <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />, label: 'Dot = client tasks in that month' },
          ].map((l, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-slate-500">
              {l.icon} {l.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

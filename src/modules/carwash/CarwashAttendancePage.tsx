// [carwash] [all tenants]
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { appCacheDir } from '@tauri-apps/api/path';
import { ChevronLeft, ChevronRight, Printer, Users, Plus, X, Wallet } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import {
  getAttendanceForMonth, upsertAttendance,
  getAttendanceSummaryForMonth, addSalaryAdvance,
  type CarwashStaff, type AttendanceStatus,
} from '@/lib/db/carwash';

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; short: string; color: string; bg: string }> = {
  present:  { label: 'Present',  short: 'P', color: '#16a34a', bg: '#dcfce7' },
  half_day: { label: 'Half Day', short: 'H', color: '#d97706', bg: '#fef3c7' },
  absent:   { label: 'Absent',   short: 'A', color: '#dc2626', bg: '#fee2e2' },
  leave:    { label: 'Leave',    short: 'L', color: '#7c3aed', bg: '#ede9fe' },
  holiday:  { label: 'Holiday',  short: 'O', color: '#0891b2', bg: '#e0f2fe' },
};
const STATUS_CYCLE: AttendanceStatus[] = ['present', 'half_day', 'absent', 'leave', 'holiday'];

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }
function daysInMonth(year: number, month: number) { return new Date(year, month, 0).getDate(); }
function todayISO() { return new Date().toISOString().slice(0, 10); }

// Returns the salary due day for this employee in the given month/year
// Based on joining date — salary is due on the same day-of-month as joining, every month
function getSalaryDueDay(joiningDate: string | null, year: number, month: number): number | null {
  if (!joiningDate) return null;
  const jd = new Date(joiningDate);
  if (isNaN(jd.getTime())) return null;
  const joinDay = jd.getDate();
  const lastDay = daysInMonth(year, month);
  return Math.min(joinDay, lastDay);
}

export function CarwashAttendancePage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const config = useAppStore((s) => s.config);
  const qc = useQueryClient();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  // Advance modal state
  const [advanceModal, setAdvanceModal] = useState<CarwashStaff | null>(null);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceNote, setAdvanceNote] = useState('');

  // Raw attendance for the grid
  const { data: attendance = [] } = useQuery({
    queryKey: ['carwash-attendance', tenantId, year, month],
    queryFn: () => getAttendanceForMonth(tenantId, year, month),
    enabled: !!tenantId,
  });

  // Summaries with advances included
  const { data: summaries = [] } = useQuery({
    queryKey: ['carwash-attendance-summary', tenantId, year, month],
    queryFn: () => getAttendanceSummaryForMonth(tenantId, year, month),
    enabled: !!tenantId,
  });

  const staff = useMemo(() => summaries.map(s => s.staff), [summaries]);

  const totalDays = daysInMonth(year, month);
  const days = Array.from({ length: totalDays }, (_, i) => i + 1);

  // Build lookup: staffId → day → status
  const attMap = useMemo(() => {
    const map: Record<string, Record<number, AttendanceStatus>> = {};
    for (const a of attendance) {
      const day = parseInt(a.date.slice(8, 10));
      if (!map[a.staff_id]) map[a.staff_id] = {};
      map[a.staff_id][day] = a.status as AttendanceStatus;
    }
    return map;
  }, [attendance]);

  const markMutation = useMutation({
    mutationFn: ({ staffId, day, status }: { staffId: string; day: number; status: AttendanceStatus }) => {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return upsertAttendance(tenantId, staffId, date, status);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['carwash-attendance', tenantId, year, month] });
      qc.invalidateQueries({ queryKey: ['carwash-attendance-summary', tenantId, year, month] });
    },
    onError: () => toast.error('Failed to save'),
  });

  const addAdvanceMutation = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(advanceAmount);
      if (!amount || amount <= 0) throw new Error('Invalid amount');
      const monthStr = `${year}-${String(month).padStart(2, '0')}`;
      await addSalaryAdvance(tenantId, advanceModal!.id, monthStr, amount, advanceNote || undefined);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['carwash-attendance-summary', tenantId, year, month] });
      setAdvanceModal(null);
      setAdvanceAmount('');
      setAdvanceNote('');
      toast.success('Advance recorded');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to save'),
  });

  // Pending confirmation when changing away from 'present'
  const [confirmChange, setConfirmChange] = useState<{ staffId: string; day: number; next: AttendanceStatus; staffName: string; dateLabel: string } | null>(null);

  const cycleStatus = (staffId: string, day: number) => {
    const cur = attMap[staffId]?.[day];
    const idx = cur ? STATUS_CYCLE.indexOf(cur) : -1;
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    // Require confirmation when changing away from present
    if (cur === 'present') {
      const s = staff.find(s => s.id === staffId);
      const dateLabel = new Date(year, month - 1, day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      setConfirmChange({ staffId, day, next, staffName: s?.name ?? '', dateLabel });
      return;
    }
    markMutation.mutate({ staffId, day, status: next });
  };

  const confirmAndMark = () => {
    if (!confirmChange) return;
    markMutation.mutate({ staffId: confirmChange.staffId, day: confirmChange.day, status: confirmChange.next });
    setConfirmChange(null);
  };

  const prevMonth = () => { if (month === 1) { setYear(y => y - 1); setMonth(12); } else { setMonth(m => m - 1); } };
  const nextMonth = () => { if (month === 12) { setYear(y => y + 1); setMonth(1); } else { setMonth(m => m + 1); } };

  const monthName = new Date(year, month - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  const printSalarySlip = async (s: CarwashStaff) => {
    const summary = summaries.find(sm => sm.staff.id === s.id);
    if (!summary) return;
    const logo = (config?.settings as any)?.logo_base64;
    const shopName = config?.shop_name ?? 'Car Wash';
    const salaryDueDay = getSalaryDueDay(s.joining_date, year, month);
    const salaryDueStr = salaryDueDay
      ? new Date(year, month - 1, salaryDueDay).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : null;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      body{font-family:Arial,sans-serif;max-width:420px;margin:0 auto;padding:20px;font-size:13px;color:#111}
      .header{text-align:center;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #f59e0b}
      .logo{max-height:60px;max-width:150px;object-fit:contain;margin-bottom:8px}
      .shop{font-size:18px;font-weight:700;color:#111}
      .slip-title{background:#f59e0b;color:#111;text-align:center;font-weight:700;font-size:14px;padding:6px;border-radius:6px;margin:12px 0}
      .row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f3f4f6}
      .row.bold{font-weight:700;font-size:14px}
      .section-title{font-weight:700;color:#6b7280;text-transform:uppercase;font-size:11px;letter-spacing:.5px;margin:12px 0 4px}
      .green{color:#16a34a} .red{color:#dc2626} .big{font-size:16px;font-weight:700}
      .footer{text-align:center;font-size:11px;color:#9ca3af;margin-top:16px;border-top:1px solid #e5e7eb;padding-top:10px}
    </style></head><body>
    <div class="header">
      ${logo ? `<div><img src="${logo}" class="logo" /></div>` : ''}
      <div class="shop">${shopName}</div>
      ${config?.address_line1 ? `<div style="font-size:11px;color:#6b7280">${[config.address_line1, config.city].filter(Boolean).join(', ')}</div>` : ''}
      ${config?.phone ? `<div style="font-size:11px;color:#6b7280">📞 ${config.phone}</div>` : ''}
    </div>
    <div class="slip-title">SALARY SLIP — ${monthName}</div>
    <div class="section-title">Employee Details</div>
    <div class="row"><span>Name</span><span><b>${s.name}</b></span></div>
    <div class="row"><span>Role</span><span>${s.role.charAt(0).toUpperCase() + s.role.slice(1)}</span></div>
    ${s.phone ? `<div class="row"><span>Phone</span><span>${s.phone}</span></div>` : ''}
    ${s.joining_date ? `<div class="row"><span>Joining Date</span><span>${new Date(s.joining_date).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'})}</span></div>` : ''}
    ${salaryDueStr ? `<div class="row"><span>Salary Due Date</span><span><b>${salaryDueStr}</b></span></div>` : ''}
    <div class="section-title">Attendance — ${monthName}</div>
    <div class="row"><span>Working Days (period)</span><span>${summary.working_days}</span></div>
    <div class="row"><span class="green">Present Days</span><span class="green">${summary.present}</span></div>
    <div class="row"><span style="color:#d97706">Half Days</span><span style="color:#d97706">${summary.half_day}</span></div>
    <div class="row"><span style="color:#7c3aed">Leave Days</span><span style="color:#7c3aed">${summary.leave}</span></div>
    <div class="row"><span class="red">Absent Days</span><span class="red">${summary.absent}</span></div>
    <div class="section-title">Salary Calculation</div>
    <div class="row"><span>Monthly Salary</span><span>${fmt(s.monthly_salary)}</span></div>
    <div class="row"><span>Per Day Rate</span><span>${fmt(summary.per_day_rate)}</span></div>
    <div class="row"><span>Payable Days</span><span>${summary.payable_days.toFixed(1)}</span></div>
    ${summary.deductions > 0 ? `<div class="row"><span class="red">Deductions</span><span class="red">− ${fmt(summary.deductions)}</span></div>` : ''}
    <div class="row"><span>Gross Salary</span><span>${fmt(summary.net_salary)}</span></div>
    ${summary.advance > 0 ? `<div class="row"><span class="red">Advance Given</span><span class="red">− ${fmt(summary.advance)}</span></div>` : ''}
    <div class="row bold"><span>Net Payable</span><span class="big green">${fmt(summary.payable_amount)}</span></div>
    <div class="footer">Generated on ${new Date().toLocaleDateString('en-IN')}</div>
    </body></html>`;
    const finalHtml = html.replace('</body>', `<script>window.addEventListener('load',()=>setTimeout(window.print,400))<\/script></body>`);
    try {
      const cacheDir = await appCacheDir();
      const sep = cacheDir.endsWith('/') || cacheDir.endsWith('\\') ? '' : '/';
      const path = `${cacheDir}${sep}salary-slip-${s.id}-${year}-${month}.html`;
      await writeTextFile(path, finalHtml);
      await shellOpen(path);
    } catch (e: any) { toast.error('Print failed: ' + (e?.message ?? e)); }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--surface-border)' }}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Car Wash</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Attendance & Salary</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 rounded-xl btn-secondary"><ChevronLeft className="h-4 w-4" /></button>
          <span className="text-sm font-bold px-3" style={{ color: 'var(--text-primary)', minWidth: '140px', textAlign: 'center' }}>{monthName}</span>
          <button onClick={nextMonth} className="p-2 rounded-xl btn-secondary"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex-shrink-0 px-6 py-2 flex items-center gap-4 flex-wrap"
        style={{ borderBottom: '1px solid var(--surface-border)', background: 'var(--surface)' }}>
        <p className="text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Tap a cell to cycle:</p>
        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: v.bg, color: v.color }}>
            {v.short} = {v.label}
          </span>
        ))}
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--text-tertiary)' }}>
          · = Unmarked (counted as present)
        </span>
      </div>

      {staff.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <Users className="h-12 w-12 opacity-30" />
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No staff added yet — go to Staff page first</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="text-xs" style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
            <thead>
              <tr style={{ background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10 }}>
                <th className="text-left px-4 py-3 font-semibold text-sm" style={{ color: 'var(--text-secondary)', minWidth: '160px', borderBottom: '2px solid var(--surface-border)', position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 11 }}>
                  Staff
                </th>
                {days.map(d => {
                  const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                  const isToday = dateStr === todayISO();
                  const isFuture = dateStr > todayISO();
                  const dayName = new Date(year, month - 1, d).toLocaleString('en-IN', { weekday: 'short' });
                  const isSunday = new Date(year, month - 1, d).getDay() === 0;
                  return (
                    <th key={d} className="text-center py-1 font-semibold" style={{
                      minWidth: '32px', width: '32px',
                      borderBottom: '2px solid var(--surface-border)',
                      color: isToday ? 'var(--accent)' : isSunday ? '#dc2626' : 'var(--text-tertiary)',
                      opacity: isFuture ? 0.4 : 1,
                    }}>
                      <div>{d}</div>
                      <div style={{ fontSize: '9px', fontWeight: 500, marginTop: '1px', opacity: 0.8 }}>{dayName}</div>
                    </th>
                  );
                })}
                <th className="text-center px-4 py-3 font-semibold" style={{ color: 'var(--text-secondary)', borderBottom: '2px solid var(--surface-border)', minWidth: '80px' }}>P</th>
                <th className="text-center px-2 py-3 font-semibold" style={{ color: 'var(--text-secondary)', borderBottom: '2px solid var(--surface-border)', minWidth: '50px' }}>H</th>
                <th className="text-center px-2 py-3 font-semibold" style={{ color: 'var(--text-secondary)', borderBottom: '2px solid var(--surface-border)', minWidth: '50px' }}>A</th>
                <th className="text-center px-4 py-3 font-semibold" style={{ color: 'var(--accent)', borderBottom: '2px solid var(--surface-border)', minWidth: '120px' }}>Salary</th>
                <th className="text-center px-2 py-3 font-semibold" style={{ color: '#d97706', borderBottom: '2px solid var(--surface-border)', minWidth: '90px' }}>Advance</th>
                <th className="text-center px-4 py-3 font-semibold" style={{ color: 'var(--text-secondary)', borderBottom: '2px solid var(--surface-border)', minWidth: '70px' }}>Slip</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => {
                const summary = summaries.find(sm => sm.staff.id === s.id);
                if (!summary) return null;

                const salaryDueDay = getSalaryDueDay(s.joining_date, year, month);
                const salaryDueDateStr = salaryDueDay
                  ? new Date(year, month - 1, salaryDueDay).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                  : null;
                const salaryDueISO = salaryDueDay
                  ? `${year}-${String(month).padStart(2,'0')}-${String(salaryDueDay).padStart(2,'0')}`
                  : null;
                const salaryDuePassed = salaryDueISO ? salaryDueISO <= todayISO() : false;

                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                    {/* Staff name — sticky left */}
                    <td className="px-4 py-2" style={{ position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 5, borderRight: '1px solid var(--surface-border)' }}>
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                          style={{ background: 'var(--accent)' }}>{s.name[0].toUpperCase()}</div>
                        <div>
                          <p className="font-semibold text-xs" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                          <p className="text-xs capitalize" style={{ color: 'var(--text-tertiary)' }}>{s.role}</p>
                          {salaryDueDateStr && (
                            <p className="text-xs font-semibold mt-0.5" style={{ color: salaryDuePassed ? '#dc2626' : '#16a34a' }}>
                              💰 Due: {salaryDueDateStr}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Day cells */}
                    {days.map(d => {
                      const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                      const isFuture = dateStr > todayISO();
                      const status = attMap[s.id]?.[d];

                      // Is this day before joining?
                      let beforeJoining = false;
                      if (s.joining_date) {
                        const jd = new Date(s.joining_date);
                        if (jd.getFullYear() === year && jd.getMonth() + 1 === month && jd.getDate() > d) {
                          beforeJoining = true;
                        }
                      }

                      // Highlight salary due day
                      const isSalaryDay = salaryDueDay === d;

                      if (beforeJoining) {
                        return <td key={d} style={{ background: 'var(--surface-2)', opacity: 0.4, width: '32px', textAlign: 'center', padding: '4px 2px' }}>
                          <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                        </td>;
                      }

                      const cfg = status ? STATUS_CONFIG[status] : null;

                      if (isSalaryDay) {
                        return (
                          <td key={d} style={{
                            width: '32px', padding: '3px 2px', textAlign: 'center',
                            background: 'rgba(245,158,11,0.12)',
                            borderLeft: '2px solid #f59e0b',
                            borderRight: '2px solid #f59e0b',
                          }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                              <button
                                disabled={isFuture || markMutation.isPending}
                                onClick={() => cycleStatus(s.id, d)}
                                className="w-7 h-7 rounded-lg text-xs font-bold transition-all hover:scale-110 disabled:opacity-30 disabled:cursor-not-allowed"
                                title={`Salary due: ${salaryDueDateStr}`}
                                style={cfg
                                  ? { background: cfg.bg, color: cfg.color, border: '1.5px solid #f59e0b' }
                                  : { background: '#fef3c7', color: '#d97706', border: '1.5px solid #f59e0b' }}>
                                {cfg ? cfg.short : '₹'}
                              </button>
                              <span style={{ fontSize: '8px', fontWeight: 700, color: '#d97706', lineHeight: 1 }}>SAL</span>
                            </div>
                          </td>
                        );
                      }

                      return (
                        <td key={d} style={{ width: '32px', padding: '4px 2px', textAlign: 'center' }}>
                          <button
                            disabled={isFuture || markMutation.isPending}
                            onClick={() => cycleStatus(s.id, d)}
                            className="w-7 h-7 rounded-lg text-xs font-bold transition-all hover:scale-110 disabled:opacity-30 disabled:cursor-not-allowed"
                            style={cfg
                              ? { background: cfg.bg, color: cfg.color }
                              : { background: 'var(--surface-2)', color: 'var(--text-tertiary)' }}>
                            {cfg ? cfg.short : '·'}
                          </button>
                        </td>
                      );
                    })}

                    {/* Summary counts */}
                    <td className="text-center px-2 py-2 font-semibold text-xs" style={{ color: '#16a34a' }}>{summary.present}</td>
                    <td className="text-center px-2 py-2 font-semibold text-xs" style={{ color: '#d97706' }}>{summary.half_day}</td>
                    <td className="text-center px-2 py-2 font-semibold text-xs" style={{ color: '#dc2626' }}>{summary.absent}</td>

                    {/* Salary column — gross + deductions */}
                    <td className="text-center px-4 py-2">
                      {s.monthly_salary > 0 ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <p className="font-bold text-sm" style={{ color: 'var(--accent)' }}>{fmt(summary.net_salary)}</p>
                          {summary.deductions > 0 && (
                            <p className="text-xs" style={{ color: '#dc2626' }}>−{fmt(summary.deductions)}</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No salary</p>
                      )}
                    </td>

                    {/* Advance column */}
                    <td className="text-center px-2 py-2">
                      <div className="flex flex-col items-center gap-0.5">
                        {summary.advance > 0 && (
                          <p className="text-xs font-semibold" style={{ color: '#dc2626' }}>−{fmt(summary.advance)}</p>
                        )}
                        {summary.advance > 0 && (
                          <p className="text-xs font-bold" style={{ color: '#16a34a' }}>{fmt(summary.payable_amount)}</p>
                        )}
                        <button
                          onClick={() => { setAdvanceModal(s); setAdvanceAmount(''); setAdvanceNote(''); }}
                          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-xs font-semibold transition-colors hover:opacity-80"
                          style={{ background: 'rgba(217,119,6,0.12)', color: '#d97706' }}
                          title="Record advance">
                          <Wallet className="h-3 w-3" />
                          <span>{summary.advance > 0 ? 'More' : '+Adv'}</span>
                        </button>
                      </div>
                    </td>

                    {/* Slip button */}
                    <td className="text-center px-4 py-2">
                      <button onClick={() => printSalarySlip(s)}
                        className="p-1.5 rounded-lg btn-secondary hover:text-amber-600 transition-colors"
                        title="Print salary slip">
                        <Printer className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Bottom summary bar */}
      {staff.length > 0 && (
        <div className="flex-shrink-0 px-6 py-3 flex items-center gap-6 flex-wrap"
          style={{ borderTop: '2px solid var(--surface-border)', background: 'var(--surface)' }}>
          <p className="text-xs font-semibold uppercase" style={{ color: 'var(--text-tertiary)' }}>Month Total</p>
          <div>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Total Staff</p>
            <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{staff.length}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Total Gross</p>
            <p className="font-bold text-sm" style={{ color: 'var(--accent)' }}>
              {fmt(summaries.reduce((s, sm) => s + sm.net_salary, 0))}
            </p>
          </div>
          <div>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Total Advance</p>
            <p className="font-bold text-sm" style={{ color: '#d97706' }}>
              {fmt(summaries.reduce((s, sm) => s + sm.advance, 0))}
            </p>
          </div>
          <div>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Total Payable</p>
            <p className="font-bold text-sm" style={{ color: '#16a34a' }}>
              {fmt(summaries.reduce((s, sm) => s + sm.payable_amount, 0))}
            </p>
          </div>
          <div>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Total Deductions</p>
            <p className="font-bold text-sm" style={{ color: '#dc2626' }}>
              {fmt(summaries.reduce((s, sm) => s + sm.deductions, 0))}
            </p>
          </div>
        </div>
      )}

      {/* Confirm attendance change from Present */}
      {confirmChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-2xl p-6 w-full max-w-xs shadow-2xl text-center" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <div className="h-12 w-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#fee2e2' }}>
              <span className="text-2xl">⚠️</span>
            </div>
            <h2 className="text-base font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Change Attendance?</h2>
            <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
              <b>{confirmChange.staffName}</b> · {confirmChange.dateLabel}
            </p>
            <p className="text-sm mb-5" style={{ color: 'var(--text-tertiary)' }}>
              Mark as <span className="font-bold" style={{ color: STATUS_CONFIG[confirmChange.next].color }}>{STATUS_CONFIG[confirmChange.next].label}</span> instead of Present?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmChange(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold btn-secondary">
                Cancel
              </button>
              <button onClick={confirmAndMark}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: STATUS_CONFIG[confirmChange.next].bg, color: STATUS_CONFIG[confirmChange.next].color, border: `1.5px solid ${STATUS_CONFIG[confirmChange.next].color}` }}>
                Yes, Change
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Advance Modal */}
      {advanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-2xl p-6 w-full max-w-sm shadow-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Record Advance</h2>
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{advanceModal.name} · {monthName}</p>
              </div>
              <button onClick={() => setAdvanceModal(null)} className="p-1.5 rounded-lg btn-secondary">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Advance Amount (₹) *
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 2000"
                  value={advanceAmount}
                  onChange={e => setAdvanceAmount(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)', outline: 'none' }}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Note (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Festival advance"
                  value={advanceNote}
                  onChange={e => setAdvanceNote(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)', outline: 'none' }}
                />
              </div>

              {/* Show current net salary and how much would remain */}
              {(() => {
                const sm = summaries.find(s => s.staff.id === advanceModal.id);
                const amt = parseFloat(advanceAmount) || 0;
                if (!sm || sm.net_salary <= 0) return null;
                const remaining = Math.max(0, sm.payable_amount - amt);
                return (
                  <div className="rounded-xl p-3 text-xs" style={{ background: 'var(--surface-2)' }}>
                    <div className="flex justify-between mb-1">
                      <span style={{ color: 'var(--text-tertiary)' }}>Gross Salary</span>
                      <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{fmt(sm.net_salary)}</span>
                    </div>
                    {sm.advance > 0 && (
                      <div className="flex justify-between mb-1">
                        <span style={{ color: 'var(--text-tertiary)' }}>Advance Already Given</span>
                        <span className="font-semibold" style={{ color: '#dc2626' }}>−{fmt(sm.advance)}</span>
                      </div>
                    )}
                    {amt > 0 && (
                      <div className="flex justify-between mb-1">
                        <span style={{ color: 'var(--text-tertiary)' }}>This Advance</span>
                        <span className="font-semibold" style={{ color: '#d97706' }}>−{fmt(amt)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-1" style={{ borderTop: '1px solid var(--surface-border)' }}>
                      <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>Remaining Payable</span>
                      <span className="font-bold" style={{ color: remaining <= 0 ? '#dc2626' : '#16a34a' }}>{fmt(remaining)}</span>
                    </div>
                  </div>
                );
              })()}

              <div className="flex gap-3 pt-1">
                <button onClick={() => setAdvanceModal(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold btn-secondary">
                  Cancel
                </button>
                <button
                  onClick={() => addAdvanceMutation.mutate()}
                  disabled={!advanceAmount || parseFloat(advanceAmount) <= 0 || addAdvanceMutation.isPending}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: '#d97706', color: '#fff' }}>
                  <Plus className="h-4 w-4" />
                  {addAdvanceMutation.isPending ? 'Saving...' : 'Record Advance'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// [hardware] [all tenants]
import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { appCacheDir } from '@tauri-apps/api/path';
import { ChevronLeft, ChevronRight, Printer, Users, Plus, X, Wallet, CalendarCheck, CheckCheck, BadgeCheck, Banknote } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import {
  getHwAttendanceForMonth, upsertHwAttendance,
  getHwAttendanceSummaryForMonth, addHwSalaryAdvance, getHwSalaryAdvancesForMonth,
  recordHwSalaryPayment, getHwSalaryPaymentsForMonth,
  type HardwareStaff, type HwAttendanceStatus, type HwStaffSalarySummary, type HardwareSalaryPayment,
} from '@/lib/db/hardware';

const ACCENT = '#2563eb';

const STATUS_CONFIG: Record<HwAttendanceStatus, { label: string; short: string; color: string; bg: string; dotColor: string }> = {
  present:  { label: 'Present',  short: 'P', color: '#ffffff', bg: '#000000', dotColor: '#000000' },
  half_day: { label: 'Half Day', short: 'H', color: '#ffffff', bg: '#16a34a', dotColor: '#16a34a' },
  absent:   { label: 'Absent',   short: 'A', color: '#ffffff', bg: '#b91c1c', dotColor: '#b91c1c' },
  leave:    { label: 'Leave',    short: 'L', color: '#ffffff', bg: '#1d4ed8', dotColor: '#1d4ed8' },
  holiday:  { label: 'Holiday',  short: 'H', color: '#000000', bg: '#fde047', dotColor: '#ca8a04' },
};
const STATUS_CYCLE: HwAttendanceStatus[] = ['present', 'half_day', 'absent', 'leave', 'holiday'];

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

function TodayAttendanceModal({ staff, initialDate, attMap, year, month, onClose, onSave }: {
  staff: HardwareStaff[];
  initialDate: string;
  attMap: Record<string, Record<number, HwAttendanceStatus>>;
  year: number;
  month: number;
  onClose: () => void;
  onSave: (statuses: Record<string, HwAttendanceStatus>, date: string) => void;
}) {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const selectedDay = parseInt(selectedDate.slice(8, 10));

  const [statuses, setStatuses] = useState<Record<string, HwAttendanceStatus>>(() => {
    const init: Record<string, HwAttendanceStatus> = {};
    for (const s of staff) init[s.id] = attMap[s.id]?.[selectedDay] ?? 'present';
    return init;
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const day = parseInt(selectedDate.slice(8, 10));
    const init: Record<string, HwAttendanceStatus> = {};
    for (const s of staff) init[s.id] = attMap[s.id]?.[day] ?? 'present';
    setStatuses(init);
  }, [selectedDate]);

  const firstDay = `${year}-${String(month).padStart(2,'0')}-01`;
  const canGoBack = selectedDate > firstDay;
  const canGoForward = selectedDate < todayISO();

  const shiftDate = (delta: number) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dy = String(d.getDate()).padStart(2, '0');
    setSelectedDate(`${y}-${mo}-${dy}`);
  };

  const dateLabel = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const isToday = selectedDate === todayISO();

  const handleSave = async () => {
    setSaving(true);
    await onSave(statuses, selectedDate);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-white rounded-2xl max-w-lg w-full flex flex-col" style={{ maxHeight: '90vh', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>

        <div className="px-5 py-4 flex items-center justify-between flex-shrink-0 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
          <h2 className="text-lg font-bold text-slate-900">Mark Attendance</h2>
          <button onClick={onClose} className="bg-slate-100 border-none rounded-full w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-3 flex items-center justify-between flex-shrink-0 border-b border-slate-100">
          <button onClick={() => shiftDate(-1)} disabled={!canGoBack}
            className={`rounded-lg w-9 h-9 flex items-center justify-center border ${canGoBack ? 'bg-slate-100 border-slate-200 text-slate-900 cursor-pointer' : 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'}`}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className={`text-center px-4 py-1.5 rounded-xl flex-1 mx-3 ${isToday ? 'bg-blue-50' : 'bg-slate-100'}`}>
            <p className="text-sm font-bold" style={{ color: isToday ? ACCENT : '#1d1d1f' }}>{dateLabel}</p>
            {isToday && <p className="text-xs font-medium" style={{ color: ACCENT }}>Today</p>}
          </div>
          <button onClick={() => shiftDate(1)} disabled={!canGoForward}
            className={`rounded-lg w-9 h-9 flex items-center justify-center border ${canGoForward ? 'bg-slate-100 border-slate-200 text-slate-900 cursor-pointer' : 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'}`}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-2.5 flex gap-2 flex-shrink-0 border-b border-slate-100">
          <button onClick={() => { const a: Record<string,HwAttendanceStatus>={}; for(const s of staff) a[s.id]='present'; setStatuses(a); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg text-white hover:opacity-80"
            style={{ background: STATUS_CONFIG.present.dotColor }}>
            <CheckCheck className="h-3.5 w-3.5" /> All Present
          </button>
          <button onClick={() => { const a: Record<string,HwAttendanceStatus>={}; for(const s of staff) a[s.id]='half_day'; setStatuses(a); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg text-white hover:opacity-80"
            style={{ background: STATUS_CONFIG.half_day.dotColor }}>
            <CheckCheck className="h-3.5 w-3.5" /> All Half Day
          </button>
          <button onClick={() => { const a: Record<string,HwAttendanceStatus>={}; for(const s of staff) a[s.id]='holiday'; setStatuses(a); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg hover:opacity-80"
            style={{ background: STATUS_CONFIG.holiday.bg, color: STATUS_CONFIG.holiday.color }}>
            <CheckCheck className="h-3.5 w-3.5" /> All Holiday
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
          {staff.map(s => {
            const sel = statuses[s.id];
            const cfg = STATUS_CONFIG[sel];
            return (
              <div key={s.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-3" style={{ flexShrink: 0 }}>
                  <div className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background: cfg.dotColor, color: cfg.color }}>
                    {((s.name?.[0] ?? '?').toUpperCase())}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{s.name}</p>
                    <p className="text-xs capitalize text-slate-500">{s.role}</p>
                  </div>
                </div>
                <div className="flex gap-1.5 flex-wrap justify-end">
                  {(Object.entries(STATUS_CONFIG) as [HwAttendanceStatus, typeof STATUS_CONFIG[HwAttendanceStatus]][]).map(([key, c]) => (
                    <button key={key} onClick={() => setStatuses(prev => ({ ...prev, [s.id]: key }))}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap"
                      style={{
                        background: sel === key ? c.dotColor : '#f1f5f9',
                        color: sel === key ? c.color : '#94a3b8',
                        border: sel === key ? 'none' : '1px solid #e2e8f0',
                      }}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 px-4 py-4 flex-shrink-0 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-slate-100 text-sm font-semibold text-slate-900">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-[2] py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-1.5 disabled:opacity-60"
            style={{ background: ACCENT }}>
            <CalendarCheck className="h-4 w-4" />
            {saving ? 'Saving…' : `Save — ${new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Pay Salary Modal ──────────────────────────────────────────────────────────
function PaySalaryModal({ summary, monthName, existingPayment, onClose, onPaid, fmt }: {
  summary: HwStaffSalarySummary;
  monthName: string;
  existingPayment: HardwareSalaryPayment | null;
  onClose: () => void;
  onPaid: (method: string, note: string) => Promise<void>;
  fmt: (n: number) => string;
}) {
  const [method, setMethod] = useState<'cash' | 'upi' | 'card'>('cash');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const handlePay = async () => {
    setSaving(true);
    try {
      await onPaid(method, note);
      setDone(true);
    } catch (e: any) {
      alert(e?.message || String(e) || 'Payment failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const METHODS = [
    { key: 'cash', label: 'Cash',  icon: '💵' },
    { key: 'upi',  label: 'UPI',   icon: '📱' },
    { key: 'card', label: 'Card',  icon: '💳' },
  ] as const;

  if (existingPayment && !done) {
    const paidOn = new Date(existingPayment.paid_at + '').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55">
        <div className="bg-white rounded-2xl max-w-sm w-full" style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
          <div className="px-6 py-5 flex items-center justify-between border-b border-slate-100 bg-slate-50 rounded-t-2xl">
            <h2 className="text-lg font-bold text-slate-900">Salary — {summary.staff.name}</h2>
            <button onClick={onClose} className="bg-slate-100 border-none rounded-full w-8 h-8 flex items-center justify-center"><X className="h-4 w-4" /></button>
          </div>
          <div className="px-6 py-6 flex flex-col items-center gap-4">
            <div className="h-14 w-14 rounded-full flex items-center justify-center bg-green-100">
              <BadgeCheck className="h-8 w-8 text-green-600" />
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{fmt(existingPayment.amount_paid)}</p>
              <p className="text-sm mt-1 text-slate-500">Paid via {existingPayment.payment_method.toUpperCase()} · {paidOn}</p>
              {existingPayment.note && <p className="text-xs mt-1 text-slate-400">{existingPayment.note}</p>}
            </div>
            <p className="text-xs text-slate-400">{monthName} salary already recorded</p>
          </div>
          <div className="flex gap-2 px-6 py-4 border-t border-slate-100">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-slate-100 text-sm font-semibold text-slate-900">Close</button>
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55">
        <div className="bg-white rounded-2xl max-w-sm w-full" style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
          <div className="px-6 py-6 flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-full flex items-center justify-center bg-green-100">
              <BadgeCheck className="h-9 w-9 text-green-600" />
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-slate-900">Payment Recorded!</p>
              <p className="text-2xl font-bold mt-1 text-green-600">{fmt(summary.payable_amount)}</p>
              <p className="text-sm mt-1 text-slate-500">{summary.staff.name} · {monthName} · {method.toUpperCase()}</p>
            </div>
          </div>
          <div className="flex gap-2 px-6 py-4 border-t border-slate-100">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-slate-100 text-sm font-semibold text-slate-900">Done</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55">
      <div className="bg-white rounded-2xl max-w-md w-full flex flex-col" style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>

        <div className="px-6 py-4 flex items-center justify-between flex-shrink-0 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Pay Salary</h2>
            <p className="text-sm text-slate-500">{summary.staff.name} · {monthName}</p>
          </div>
          <button onClick={onClose} className="bg-slate-100 border-none rounded-full w-8 h-8 flex items-center justify-center text-slate-500"><X className="h-4 w-4" /></button>
        </div>

        <div className="px-6 py-4 border-b border-slate-100">
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            {[
              { label: 'Monthly Salary',  value: fmt(summary.staff.monthly_salary),  color: '#1d1d1f' },
              { label: 'Payable Days',    value: summary.payable_days.toFixed(1) + 'd', color: '#1d1d1f' },
              { label: 'Gross Earned',    value: fmt(summary.net_salary),             color: ACCENT },
              ...(summary.deductions > 0 ? [{ label: 'Deductions', value: `− ${fmt(summary.deductions)}`, color: '#dc2626' }] : []),
              ...(summary.advance > 0    ? [{ label: 'Advance Given', value: `− ${fmt(summary.advance)}`, color: '#f59e0b' }] : []),
            ].map((row, i, arr) => (
              <div key={row.label} className="flex justify-between items-center px-4 py-2.5"
                style={{ borderBottom: i < arr.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                <span className="text-sm text-slate-500">{row.label}</span>
                <span className="text-sm font-semibold" style={{ color: row.color }}>{row.value}</span>
              </div>
            ))}
            <div className="flex justify-between items-center px-4 py-3 bg-green-50 border-t border-green-100">
              <span className="text-base font-bold text-green-700">Net Payable</span>
              <span className="text-xl font-bold text-green-700">{fmt(summary.payable_amount)}</span>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-b border-slate-100">
          <p className="text-xs font-semibold uppercase tracking-wide mb-3 text-slate-400">Payment Method</p>
          <div className="flex gap-2">
            {METHODS.map(m => (
              <button key={m.key} onClick={() => setMethod(m.key)}
                className="flex-1 flex flex-col items-center gap-1 py-3 rounded-xl"
                style={{ background: method === m.key ? ACCENT : '#f1f5f9', border: method === m.key ? 'none' : '1px solid #e2e8f0' }}>
                <span className="text-xl">{m.icon}</span>
                <span className="text-xs font-bold" style={{ color: method === m.key ? '#ffffff' : '#1d1d1f' }}>{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 py-3">
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 bg-slate-50 outline-none" />
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-slate-100 text-sm font-semibold text-slate-900">Cancel</button>
          <button onClick={handlePay} disabled={saving}
            className="flex-[2] py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-70"
            style={{ background: '#16a34a' }}>
            <Banknote className="h-4 w-4" />
            {saving ? 'Recording…' : `Confirm Payment · ${fmt(summary.payable_amount)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdvanceModal({ staff, monthName, monthStr, tenantId, summary, advanceAmount, advanceNote, setAdvanceAmount, setAdvanceNote, onClose, onSave, isSaving, fmt }: {
  staff: HardwareStaff; monthName: string; monthStr: string; tenantId: string;
  summary: any; advanceAmount: string; advanceNote: string;
  setAdvanceAmount: (v: string) => void; setAdvanceNote: (v: string) => void;
  onClose: () => void; onSave: () => void; isSaving: boolean; fmt: (n: number) => string;
}) {
  const { data: advances = [] } = useQuery({
    queryKey: ['hw-advances-modal', tenantId, monthStr, staff.id],
    queryFn: () => getHwSalaryAdvancesForMonth(tenantId, monthStr),
    enabled: !!tenantId,
  });
  const staffAdvances = advances.filter(a => a.staff_id === staff.id);
  const totalGiven = staffAdvances.reduce((s, a) => s + a.amount, 0);
  const amt = parseFloat(advanceAmount) || 0;
  const remaining = summary ? Math.max(0, summary.payable_amount - amt) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full flex flex-col" style={{ maxHeight: '88vh', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>

        <div className="px-6 py-5 flex items-center justify-between flex-shrink-0 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Salary Advance</h2>
            <p className="text-sm mt-0.5 text-slate-500">{staff.name} · {monthName}</p>
          </div>
          <button onClick={onClose} className="bg-slate-100 border-none rounded-full w-7 h-7 flex items-center justify-center text-slate-500">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">

          {summary && summary.net_salary > 0 && (
            <div className="flex rounded-xl overflow-hidden border border-slate-200">
              {[
                { label: 'Gross', value: fmt(summary.net_salary), color: '#1d1d1f' },
                { label: 'Advanced', value: fmt(totalGiven), color: '#dc2626' },
                { label: 'Payable', value: fmt(summary.payable_amount), color: '#16a34a' },
              ].map((item, i) => (
                <div key={item.label} className="flex-1 text-center py-3 bg-slate-50" style={{ borderLeft: i > 0 ? '1px solid #e2e8f0' : 'none' }}>
                  <p className="text-xs text-slate-400">{item.label}</p>
                  <p className="text-sm font-semibold mt-0.5" style={{ color: item.color }}>{item.value}</p>
                </div>
              ))}
            </div>
          )}

          {staffAdvances.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider mb-2 text-slate-400">This Month</p>
              <div className="space-y-1">
                {staffAdvances.map((a, i) => (
                  <div key={a.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-slate-50 border border-slate-100">
                    <p className="text-sm text-slate-500">
                      {a.given_at ? new Date(a.given_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : `Entry ${i + 1}`}
                      {a.note ? <span className="text-slate-400"> · {a.note}</span> : ''}
                    </p>
                    <p className="text-sm font-semibold text-red-600">−{fmt(a.amount)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-medium uppercase tracking-wider mb-2 text-slate-400">New Advance</p>
            <div className="space-y-2">
              <input type="number" min="1" placeholder="Amount (₹)"
                value={advanceAmount} onChange={e => setAdvanceAmount(e.target.value)}
                autoFocus
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 bg-white outline-none" />
              <input type="text" placeholder="Note (optional)"
                value={advanceNote} onChange={e => setAdvanceNote(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white outline-none" />
              {amt > 0 && summary && summary.net_salary > 0 && (
                <div className="flex justify-between px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-sm text-slate-500">Remaining after this</span>
                  <span className="text-sm font-semibold" style={{ color: remaining <= 0 ? '#dc2626' : '#16a34a' }}>{fmt(remaining)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2 px-4 py-4 flex-shrink-0 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-slate-100 text-sm font-semibold text-slate-900">
            Close
          </button>
          <button onClick={onSave} disabled={!advanceAmount || parseFloat(advanceAmount) <= 0 || isSaving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-1.5 disabled:opacity-40"
            style={{ background: ACCENT }}>
            <Plus className="h-4 w-4" />
            {isSaving ? 'Saving…' : 'Record Advance'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function HardwareAttendancePage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const config = useAppStore((s) => s.config);
  const qc = useQueryClient();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const [todayModal, setTodayModal] = useState(false);

  const [advanceModal, setAdvanceModal] = useState<HardwareStaff | null>(null);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceNote, setAdvanceNote] = useState('');

  const [payModal, setPayModal] = useState<HardwareStaff | null>(null);

  const { data: attendance = [] } = useQuery({
    queryKey: ['hw-attendance', tenantId, year, month],
    queryFn: () => getHwAttendanceForMonth(tenantId, year, month),
    enabled: !!tenantId,
  });

  const { data: summaries = [] } = useQuery({
    queryKey: ['hw-attendance-summary', tenantId, year, month],
    queryFn: () => getHwAttendanceSummaryForMonth(tenantId, year, month),
    enabled: !!tenantId,
  });

  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const { data: salaryPayments = [] } = useQuery({
    queryKey: ['hw-salary-payments', tenantId, monthStr],
    queryFn: () => getHwSalaryPaymentsForMonth(tenantId, monthStr),
    enabled: !!tenantId,
  });
  const paymentMap = useMemo(() => {
    const map: Record<string, HardwareSalaryPayment> = {};
    for (const p of salaryPayments) map[p.staff_id] = p;
    return map;
  }, [salaryPayments]);

  const sortedSummaries = useMemo(() => {
    return [...summaries].sort((a, b) => {
      const aDue = getSalaryDueDay(a.staff.joining_date, year, month);
      const bDue = getSalaryDueDay(b.staff.joining_date, year, month);
      if (!aDue && !bDue) return 0;
      if (!aDue) return 1;
      if (!bDue) return -1;
      const aKey = `${year}-${String(month).padStart(2,'0')}-${String(aDue).padStart(2,'0')}`;
      const bKey = `${year}-${String(month).padStart(2,'0')}-${String(bDue).padStart(2,'0')}`;
      return aKey.localeCompare(bKey);
    });
  }, [summaries, year, month]);
  const staff = useMemo(() => sortedSummaries.map(s => s.staff), [sortedSummaries]);

  const totalDays = daysInMonth(year, month);
  const days = Array.from({ length: totalDays }, (_, i) => i + 1);

  const attMap = useMemo(() => {
    const map: Record<string, Record<number, HwAttendanceStatus>> = {};
    for (const a of attendance) {
      const day = parseInt(a.date.slice(8, 10));
      if (!map[a.staff_id]) map[a.staff_id] = {};
      map[a.staff_id][day] = a.status as HwAttendanceStatus;
    }
    return map;
  }, [attendance]);

  const markMutation = useMutation({
    mutationFn: ({ staffId, day, status }: { staffId: string; day: number; status: HwAttendanceStatus }) => {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return upsertHwAttendance(tenantId, staffId, date, status);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hw-attendance', tenantId, year, month] });
      qc.invalidateQueries({ queryKey: ['hw-attendance-summary', tenantId, year, month] });
    },
    onError: () => toast.error('Failed to save'),
  });

  const addAdvanceMutation = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(advanceAmount);
      if (!amount || amount <= 0) throw new Error('Invalid amount');
      const summary = summaries.find(sm => sm.staff.id === advanceModal!.id);
      if (summary && amount > summary.payable_amount) throw new Error(`Advance cannot exceed payable amount (${fmt(summary.payable_amount)})`);
      const monthStr = `${year}-${String(month).padStart(2, '0')}`;
      await addHwSalaryAdvance(tenantId, advanceModal!.id, monthStr, amount, advanceNote || undefined);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hw-attendance-summary', tenantId, year, month] });
      setAdvanceModal(null);
      setAdvanceAmount('');
      setAdvanceNote('');
      toast.success('Advance recorded');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to save'),
  });

  const paySalaryMutation = useMutation({
    mutationFn: async ({ method, note }: { method: string; note: string }) => {
      if (!payModal) throw new Error('No staff selected');
      await recordHwSalaryPayment(tenantId, payModal.id, monthStr, summaries.find(s => s.staff.id === payModal.id)?.payable_amount ?? 0, method, note || undefined);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hw-salary-payments', tenantId, monthStr] });
      toast.success('Salary payment recorded');
    },
    onError: (e: any) => toast.error(e?.message || String(e) || 'Failed to record payment'),
  });

  const [confirmChange, setConfirmChange] = useState<{ staffId: string; day: number; next: HwAttendanceStatus; staffName: string; dateLabel: string } | null>(null);

  const cycleStatus = (staffId: string, day: number) => {
    const cur = attMap[staffId]?.[day];
    const idx = cur ? STATUS_CYCLE.indexOf(cur) : -1;
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
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

  const saveTodayAttendance = async (statuses: Record<string, HwAttendanceStatus>, date: string) => {
    await Promise.all(
      Object.entries(statuses).map(([staffId, status]) =>
        upsertHwAttendance(tenantId, staffId, date, status)
      )
    );
    qc.invalidateQueries({ queryKey: ['hw-attendance', tenantId, year, month] });
    qc.invalidateQueries({ queryKey: ['hw-attendance-summary', tenantId, year, month] });
    const savedYear = parseInt(date.slice(0, 4));
    const savedMonth = parseInt(date.slice(5, 7));
    if (savedYear !== year || savedMonth !== month) {
      qc.invalidateQueries({ queryKey: ['hw-attendance', tenantId, savedYear, savedMonth] });
      qc.invalidateQueries({ queryKey: ['hw-attendance-summary', tenantId, savedYear, savedMonth] });
    }
    setTodayModal(false);
    const saved = new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    toast.success(`Attendance saved for ${saved}`);
  };

  const prevMonth = () => { if (month === 1) { setYear(y => y - 1); setMonth(12); } else { setMonth(m => m - 1); } };
  const nextMonth = () => { if (month === 12) { setYear(y => y + 1); setMonth(1); } else { setMonth(m => m + 1); } };

  const monthName = new Date(year, month - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  const printSalarySlip = async (s: HardwareStaff) => {
    const summary = summaries.find(sm => sm.staff.id === s.id);
    if (!summary) return;
    const rawLogo = (config?.settings as any)?.logo_base64;
    const logo = rawLogo ? String(rawLogo).replace(/"/g, '') : null;
    const shopName = (config?.shop_name ?? 'Hardware Store').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const salaryDueDay = getSalaryDueDay(s.joining_date, year, month);
    const salaryDueStr = salaryDueDay
      ? new Date(year, month - 1, salaryDueDay).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : null;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      body{font-family:Arial,sans-serif;max-width:420px;margin:0 auto;padding:20px;font-size:13px;color:#111}
      .header{text-align:center;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid ${ACCENT}}
      .logo{max-height:60px;max-width:150px;object-fit:contain;margin-bottom:8px}
      .shop{font-size:18px;font-weight:700;color:#111}
      .slip-title{background:${ACCENT};color:#fff;text-align:center;font-weight:700;font-size:14px;padding:6px;border-radius:6px;margin:12px 0}
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
    <div class="row"><span style="color:#2563eb">Half Days</span><span style="color:#2563eb">${summary.half_day}</span></div>
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

  const firstDow = new Date(year, month - 1, 1).getDay();
  const startOffset = (firstDow + 6) % 7;
  const rawGrid: (number | null)[] = [...Array(startOffset).fill(null), ...days];
  while (rawGrid.length % 7 !== 0) rawGrid.push(null);

  return (
    <div className="flex flex-col" style={{ height: '100%', overflow: 'hidden' }}>

      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-slate-200 bg-white">
        <h1 className="text-xl font-bold text-slate-900">Attendance & Salary</h1>
        <div className="flex items-center gap-2">
          {staff.length > 0 && (
            <button onClick={() => setTodayModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-xl hover:opacity-90"
              style={{ background: ACCENT }}>
              <CalendarCheck className="h-4 w-4" />
              Today's Attendance
            </button>
          )}
          <button onClick={prevMonth} className="bg-slate-100 border-none rounded-lg p-2 text-slate-900 flex">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium px-4 py-2 text-slate-900 bg-slate-100 rounded-lg" style={{ minWidth: '150px', textAlign: 'center' }}>
            {monthName}
          </span>
          <button onClick={nextMonth} className="bg-slate-100 border-none rounded-lg p-2 text-slate-900 flex">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {staff.length === 0 ? (
        <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center gap-3 py-24">
          <Users className="h-12 w-12 text-slate-300" />
          <p className="text-base text-slate-400">No staff added yet — go to Staff page first</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {sortedSummaries.map(({ staff: s, ...summary }) => {
            const salaryDueDay = getSalaryDueDay(s.joining_date, year, month);
            const salaryDueDateStr = salaryDueDay
              ? new Date(year, month - 1, salaryDueDay).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
              : null;
            const salaryDueISO = salaryDueDay
              ? `${year}-${String(month).padStart(2,'0')}-${String(salaryDueDay).padStart(2,'0')}`
              : null;
            const salaryDuePassed = salaryDueISO ? salaryDueISO <= todayISO() : false;

            return (
              <div key={s.id} className="rounded-2xl overflow-hidden border border-slate-200 bg-white">
                <div className="flex items-stretch">

                  {/* Left — staff info */}
                  <div className="p-4 flex flex-col gap-2.5 bg-slate-50 border-r border-slate-100" style={{ width: '170px', flexShrink: 0 }}>
                    <div className="flex items-center gap-2.5">
                      <div className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0"
                        style={{ background: ACCENT }}>
                        {((s.name?.[0] ?? '?').toUpperCase())}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-tight text-slate-900" style={{ wordBreak: 'break-word' }}>{s.name}</p>
                        <p className="text-xs capitalize mt-0.5 text-slate-500">{s.role}</p>
                      </div>
                    </div>
                    {s.monthly_salary > 0 && (
                      <div className="rounded-lg px-2.5 py-2 bg-white border border-slate-100">
                        <p className="text-xs text-slate-400">Monthly</p>
                        <p className="text-sm font-semibold text-slate-900">{fmt(s.monthly_salary)}</p>
                      </div>
                    )}
                    {salaryDueDateStr && (
                      <div className={`rounded-lg px-2.5 py-2 border ${salaryDuePassed ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                        <p className={`text-xs font-medium ${salaryDuePassed ? 'text-red-600' : 'text-green-600'}`}>💰 Due {salaryDueDateStr}</p>
                      </div>
                    )}
                    {s.monthly_salary > 0 && (
                      <div className="rounded-lg px-2.5 py-2 bg-white border border-slate-100">
                        <p className="text-xs text-slate-400">Gross this month</p>
                        <p className="text-sm font-semibold" style={{ color: ACCENT }}>{fmt(summary.net_salary)}</p>
                        {summary.deductions > 0 && <p className="text-xs text-red-600">−{fmt(summary.deductions)}</p>}
                      </div>
                    )}
                  </div>

                  {/* Middle — calendar */}
                  <div className="flex-1 min-w-0 p-4 bg-white">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                      {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map((d, i) => (
                        <div key={d} className={`text-center mb-1.5 py-1.5 rounded-lg bg-slate-100 ${i >= 5 ? 'text-red-600' : 'text-slate-900'}`}
                          style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d}</div>
                      ))}
                      {rawGrid.map((d, i) => {
                        if (d === null) return <div key={`e-${i}`} />;
                        const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                        const isToday = dateStr === todayISO();
                        const isFuture = dateStr > todayISO();
                        const isSunday = new Date(year, month - 1, d).getDay() === 0;
                        const isSalaryDay = salaryDueDay === d;
                        const status = attMap[s.id]?.[d];

                        let beforeJoining = false;
                        if (s.joining_date) {
                          const jd = new Date(s.joining_date);
                          if (jd.getFullYear() === year && jd.getMonth() + 1 === month && jd.getDate() > d)
                            beforeJoining = true;
                        }

                        if (beforeJoining) return (
                          <div key={d} className="flex flex-col items-center gap-0.5">
                            <span style={{ fontSize: '10px', color: '#cbd5e1' }}>{d}</span>
                            <div className="bg-slate-100 rounded-md" style={{ height: '30px', width: '100%' }} />
                          </div>
                        );

                        const cfg = status ? STATUS_CONFIG[status] : null;

                        return (
                          <div key={d} className="flex flex-col items-center gap-0.5">
                            <span style={{ fontSize: '11px', fontWeight: 700, color: isToday ? ACCENT : isSunday ? '#dc2626' : '#1d1d1f' }}>{d}</span>
                            <button
                              disabled={isFuture || markMutation.isPending}
                              onClick={() => cycleStatus(s.id, d)}
                              title={isSalaryDay ? `Salary due: ${salaryDueDateStr}` : undefined}
                              style={{
                                height: '30px', width: '100%', borderRadius: '6px',
                                fontSize: '9px', fontWeight: 700, cursor: isFuture ? 'default' : 'pointer', whiteSpace: 'nowrap', overflow: 'hidden',
                                background: cfg ? cfg.bg : isSalaryDay ? '#fff7ed' : '#f1f5f9',
                                color: cfg ? cfg.color : isSalaryDay ? ACCENT : '#cbd5e1',
                                border: isToday && !cfg ? `1.5px solid ${ACCENT}` : isSalaryDay && !cfg ? `1.5px solid ${ACCENT}` : '1.5px solid transparent',
                                opacity: isFuture ? 0.2 : 1,
                                outline: 'none',
                                transition: 'opacity 0.1s',
                              }}>
                              {cfg ? cfg.label : isSalaryDay ? '₹' : '·'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right — summary + actions */}
                  <div className="p-4 flex flex-col gap-2 bg-slate-50 border-l border-slate-100" style={{ width: '175px', flexShrink: 0 }}>

                    <div className="rounded-lg overflow-hidden bg-white border border-slate-100">
                      {[
                        { label: 'Present',  value: summary.present,  color: '#000000' },
                        { label: 'Half Day', value: summary.half_day, color: '#16a34a' },
                        { label: 'Absent',   value: summary.absent,   color: '#b91c1c' },
                        { label: 'Leave',    value: summary.leave,    color: '#1d4ed8' },
                        { label: 'Holiday',  value: summary.holiday,  color: '#ca8a04' },
                      ].map((row, i, arr) => (
                        <div key={row.label} className="flex items-center justify-between px-3 py-1.5"
                          style={{ borderBottom: i < arr.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                          <div className="flex items-center gap-2">
                            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: row.value > 0 ? row.color : '#e2e8f0', flexShrink: 0 }} />
                            <span className="text-xs" style={{ color: row.value > 0 ? '#1d1d1f' : '#94a3b8' }}>{row.label}</span>
                          </div>
                          <span className="text-sm font-semibold" style={{ color: row.value > 0 ? row.color : '#cbd5e1' }}>{row.value}</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-t border-slate-100">
                        <span className="text-xs text-slate-500">Payable days</span>
                        <span className="text-sm font-semibold text-slate-900">{summary.payable_days.toFixed(1)}</span>
                      </div>
                    </div>

                    {/* Advance */}
                    <button onClick={() => { setAdvanceModal(s); setAdvanceAmount(''); setAdvanceNote(''); }}
                      className="flex items-center justify-center gap-1.5 hover:opacity-80 rounded-lg p-2 text-sm font-semibold border"
                      style={{ background: summary.advance > 0 ? '#fff7ed' : '#ffffff', borderColor: summary.advance > 0 ? '#fdba74' : '#e2e8f0', color: summary.advance > 0 ? ACCENT : '#64748b' }}>
                      <Wallet className="h-3.5 w-3.5" />
                      {summary.advance > 0 ? `Advance · ${fmt(summary.advance)}` : 'Add Advance'}
                    </button>

                    {/* Pay Salary */}
                    {s.monthly_salary > 0 && (() => {
                      const paid = paymentMap[s.id];
                      return paid ? (
                        <button onClick={() => setPayModal(s)}
                          className="flex items-center justify-center gap-1.5 hover:opacity-80 rounded-lg p-2 text-sm font-semibold bg-green-100 border border-green-300 text-green-700">
                          <BadgeCheck className="h-3.5 w-3.5" />
                          Paid · {fmt(paid.amount_paid)}
                        </button>
                      ) : (
                        <button onClick={() => setPayModal(s)}
                          className="flex items-center justify-center gap-1.5 hover:opacity-90 rounded-lg p-2 text-sm font-semibold text-white"
                          style={{ background: '#16a34a' }}>
                          <Banknote className="h-3.5 w-3.5" />
                          Pay Salary
                        </button>
                      );
                    })()}

                    {/* Print */}
                    <button onClick={() => printSalarySlip(s)}
                      className="flex items-center justify-center gap-1.5 hover:opacity-80 rounded-lg p-2 text-sm font-semibold bg-white border border-slate-200 text-slate-500">
                      <Printer className="h-3.5 w-3.5" />
                      Print Slip
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Month Total bar */}
      <div className="px-6 py-3.5 flex items-center gap-3 flex-wrap border-t border-slate-200 bg-slate-900" style={{ flexShrink: 0 }}>
        <p className="text-xs font-semibold uppercase tracking-widest mr-1 text-slate-400">Month Total</p>
        {[
          { label: 'Staff',      value: String(staff.length),                                           color: '#ffffff' },
          { label: 'Gross',      value: fmt(summaries.reduce((a, sm) => a + sm.net_salary, 0)),         color: '#60a5fa' },
          { label: 'Deductions', value: fmt(summaries.reduce((a, sm) => a + sm.deductions, 0)),         color: '#f87171' },
          { label: 'Advances',   value: fmt(summaries.reduce((a, sm) => a + sm.advance, 0)),            color: '#fb923c' },
          { label: 'Payable',    value: fmt(summaries.reduce((a, sm) => a + sm.payable_amount, 0)),     color: '#4ade80' },
        ].map(item => (
          <div key={item.label} className="flex flex-col items-center px-4 py-2 rounded-xl bg-white/5 border border-white/10" style={{ minWidth: '80px' }}>
            <p className="text-xs text-white/40">{item.label}</p>
            <p className="text-base font-semibold" style={{ color: item.color }}>{item.value}</p>
          </div>
        ))}
      </div>

      {todayModal && (
        <TodayAttendanceModal
          staff={staff} initialDate={todayISO()}
          attMap={attMap} year={year} month={month} onClose={() => setTodayModal(false)} onSave={saveTodayAttendance}
        />
      )}

      {confirmChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-xs w-full p-6 text-center" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <p className="text-base font-semibold mb-1 text-slate-900">Change Attendance?</p>
            <p className="text-sm mb-1 text-slate-500">{confirmChange.staffName} · {confirmChange.dateLabel}</p>
            <p className="text-sm mb-5 text-slate-500">
              Mark as{' '}
              <span className="font-semibold px-2 py-0.5 rounded-full text-white text-xs" style={{ background: STATUS_CONFIG[confirmChange.next].dotColor }}>
                {STATUS_CONFIG[confirmChange.next].label}
              </span>?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmChange(null)} className="flex-1 py-2.5 rounded-xl bg-slate-100 text-sm font-semibold text-slate-900">Cancel</button>
              <button onClick={confirmAndMark} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: STATUS_CONFIG[confirmChange.next].dotColor }}>Change</button>
            </div>
          </div>
        </div>
      )}

      {advanceModal && (
        <AdvanceModal
          staff={advanceModal}
          monthName={monthName}
          monthStr={`${year}-${String(month).padStart(2,'0')}`}
          tenantId={tenantId}
          summary={summaries.find(sm => sm.staff.id === advanceModal.id)}
          advanceAmount={advanceAmount}
          advanceNote={advanceNote}
          setAdvanceAmount={setAdvanceAmount}
          setAdvanceNote={setAdvanceNote}
          onClose={() => setAdvanceModal(null)}
          onSave={() => addAdvanceMutation.mutate()}
          isSaving={addAdvanceMutation.isPending}
          fmt={fmt}
        />
      )}

      {payModal && (() => {
        const summary = summaries.find(sm => sm.staff.id === payModal.id);
        if (!summary) return null;
        return (
          <PaySalaryModal
            summary={summary}
            monthName={monthName}
            existingPayment={paymentMap[payModal.id] ?? null}
            onClose={() => setPayModal(null)}
            onPaid={async (method, note) => {
              await paySalaryMutation.mutateAsync({ method, note });
            }}
            fmt={fmt}
          />
        );
      })()}
    </div>
  );
}

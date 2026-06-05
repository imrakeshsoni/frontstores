// [carwash] [all tenants]
import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { appCacheDir } from '@tauri-apps/api/path';
import { ChevronLeft, ChevronRight, Printer, Users, Plus, X, Wallet, CalendarCheck, CheckCheck, BadgeCheck, Banknote } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import {
  getAttendanceForMonth, upsertAttendance,
  getAttendanceSummaryForMonth, addSalaryAdvance, getSalaryAdvancesForMonth,
  recordSalaryPayment, getSalaryPaymentsForMonth,
  type CarwashStaff, type AttendanceStatus, type StaffSalarySummary, type CarwashSalaryPayment,
} from '@/lib/db/carwash';

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; short: string; color: string; bg: string; dotColor: string }> = {
  present:  { label: 'Present',  short: 'P', color: '#ffffff', bg: '#000000',                                              dotColor: '#000000' }, // black bg, white P
  half_day: { label: 'Half Day', short: 'H', color: '#ffffff', bg: '#22c55e',                                              dotColor: '#22c55e' }, // green bg, white text
  absent:   { label: 'Absent',   short: 'A', color: '#ffffff', bg: '#b91c1c',                                              dotColor: '#b91c1c' }, // dark red bg, white text
  leave:    { label: 'Leave',    short: 'L', color: '#ffffff', bg: '#1d4ed8',                                              dotColor: '#1d4ed8' }, // blue
  holiday:  { label: 'Holiday',  short: 'H', color: '#000000', bg: '#ffea00',                                             dotColor: '#b8a000' }, // yellow bg, black H
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

function TodayAttendanceModal({ staff, initialDate, tenantId, attMap, year, month, onClose, onSave }: {
  staff: CarwashStaff[];
  initialDate: string;
  tenantId: string;
  attMap: Record<string, Record<number, AttendanceStatus>>;
  year: number;
  month: number;
  onClose: () => void;
  onSave: (statuses: Record<string, AttendanceStatus>, date: string) => void;
}) {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const selectedDay = parseInt(selectedDate.slice(8, 10));

  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>(() => {
    const init: Record<string, AttendanceStatus> = {};
    for (const s of staff) init[s.id] = attMap[s.id]?.[selectedDay] ?? 'present';
    return init;
  });
  const [saving, setSaving] = useState(false);

  // Reset statuses when date changes
  useEffect(() => {
    const day = parseInt(selectedDate.slice(8, 10));
    const init: Record<string, AttendanceStatus> = {};
    for (const s of staff) init[s.id] = attMap[s.id]?.[day] ?? 'present';
    setStatuses(init);
  }, [selectedDate]);

  const firstDay = `${year}-${String(month).padStart(2,'0')}-01`;
  const canGoBack = selectedDate > firstDay;
  const canGoForward = selectedDate < todayISO();

  const shiftDate = (delta: number) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    // Use local date parts — toISOString() returns UTC which shifts day in India (UTC+5:30)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div style={{ background: '#ffffff', borderRadius: '20px', maxWidth: '560px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 24px rgba(0,0,0,0.35), 0 24px 64px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.9)' }}>

        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between flex-shrink-0"
          style={{ borderBottom: '1px solid #f2f2f7', background: '#fafafa', borderRadius: '20px 20px 0 0' }}>
          <h2 className="text-lg font-bold" style={{ color: '#1d1d1f', letterSpacing: '-0.3px' }}>Mark Attendance</h2>
          <button onClick={onClose}
            style={{ background: '#f2f2f7', border: 'none', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6e6e73' }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Date navigator */}
        <div className="px-5 py-3 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid #f2f2f7' }}>
          <button onClick={() => shiftDate(-1)} disabled={!canGoBack}
            style={{ background: canGoBack ? '#f2f2f7' : '#f9f9f9', border: '1px solid #e5e5ea', borderRadius: '8px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: canGoBack ? 'pointer' : 'not-allowed', color: canGoBack ? '#1d1d1f' : '#d1d1d6', boxShadow: canGoBack ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-center px-4 py-1.5 rounded-xl flex-1 mx-3"
            style={{ background: isToday ? '#e8f2ff' : '#f2f2f7', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.06)' }}>
            <p className="text-sm font-bold" style={{ color: isToday ? '#0071e3' : '#1d1d1f' }}>{dateLabel}</p>
            {isToday && <p className="text-xs font-medium" style={{ color: '#0071e3' }}>Today</p>}
          </div>
          <button onClick={() => shiftDate(1)} disabled={!canGoForward}
            style={{ background: canGoForward ? '#f2f2f7' : '#f9f9f9', border: '1px solid #e5e5ea', borderRadius: '8px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: canGoForward ? 'pointer' : 'not-allowed', color: canGoForward ? '#1d1d1f' : '#d1d1d6', boxShadow: canGoForward ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Quick marks */}
        <div className="px-5 py-2.5 flex gap-2 flex-shrink-0" style={{ borderBottom: '1px solid #f2f2f7' }}>
          <button onClick={() => { const a: Record<string,AttendanceStatus>={}; for(const s of staff) a[s.id]='present'; setStatuses(a); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold transition-opacity hover:opacity-80"
            style={{ background: STATUS_CONFIG.present.dotColor, borderRadius: '8px', color: '#ffffff', border: 'none', cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.25)' }}>
            <CheckCheck className="h-3.5 w-3.5" /> All Present
          </button>
          <button onClick={() => { const a: Record<string,AttendanceStatus>={}; for(const s of staff) a[s.id]='half_day'; setStatuses(a); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold transition-opacity hover:opacity-80"
            style={{ background: STATUS_CONFIG.half_day.dotColor, borderRadius: '8px', color: '#ffffff', border: 'none', cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}>
            <CheckCheck className="h-3.5 w-3.5" /> All Half Day
          </button>
          <button onClick={() => { const a: Record<string,AttendanceStatus>={}; for(const s of staff) a[s.id]='holiday'; setStatuses(a); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold transition-opacity hover:opacity-80"
            style={{ background: STATUS_CONFIG.holiday.bg, borderRadius: '8px', color: STATUS_CONFIG.holiday.color, border: 'none', cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
            <CheckCheck className="h-3.5 w-3.5" /> All Holiday
          </button>
        </div>

        {/* Staff list — scrollable */}
        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
          {staff.map(s => {
            const sel = statuses[s.id];
            const cfg = STATUS_CONFIG[sel];
            return (
              <div key={s.id} className="flex items-center justify-between px-4 py-3 rounded-xl"
                style={{ background: '#fafafa', border: '1px solid #ececec', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
                <div className="flex items-center gap-3" style={{ flexShrink: 0 }}>
                  <div className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background: cfg.dotColor, color: cfg.color, boxShadow: `0 2px 6px ${cfg.dotColor}50` }}>
                    {s.name[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#1d1d1f' }}>{s.name}</p>
                    <p className="text-xs capitalize" style={{ color: '#86868b' }}>{s.role}</p>
                  </div>
                </div>
                <div className="flex gap-1.5 flex-wrap justify-end">
                  {(Object.entries(STATUS_CONFIG) as [AttendanceStatus, typeof STATUS_CONFIG[AttendanceStatus]][]).map(([key, c]) => (
                    <button key={key} onClick={() => setStatuses(prev => ({ ...prev, [s.id]: key }))}
                      style={{
                        padding: '5px 11px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
                        background: sel === key ? c.dotColor : '#f2f2f7',
                        color: sel === key ? c.color : '#aeaeb2',
                        border: sel === key ? 'none' : '1px solid #e5e5ea',
                        cursor: 'pointer', transition: 'all 0.12s',
                        boxShadow: sel === key ? `0 2px 8px ${c.dotColor}60` : 'none',
                        whiteSpace: 'nowrap',
                      }}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-4 py-4 flex-shrink-0" style={{ borderTop: '1px solid #f2f2f7' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: '10px', background: '#f2f2f7', border: 'none', fontSize: '14px', fontWeight: 600, color: '#1d1d1f', cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 2, padding: '10px', borderRadius: '10px', background: '#0071e3', border: 'none', fontSize: '14px', fontWeight: 600, color: '#ffffff', cursor: 'pointer', opacity: saving ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: '0 2px 10px rgba(0,113,227,0.4)' }}>
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
  summary: StaffSalarySummary;
  monthName: string;
  existingPayment: CarwashSalaryPayment | null;
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
        <div style={{ background: '#ffffff', borderRadius: '20px', maxWidth: '420px', width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.3), 0 24px 60px rgba(0,0,0,0.2)' }}>
          <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: '1px solid #f2f2f7', background: '#fafafa', borderRadius: '20px 20px 0 0' }}>
            <h2 className="text-lg font-bold" style={{ color: '#1d1d1f' }}>Salary — {summary.staff.name}</h2>
            <button onClick={onClose} style={{ background: '#f2f2f7', border: 'none', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X className="h-4 w-4" /></button>
          </div>
          <div className="px-6 py-6 flex flex-col items-center gap-4">
            <div className="h-14 w-14 rounded-full flex items-center justify-center" style={{ background: '#dcfce7' }}>
              <BadgeCheck className="h-8 w-8" style={{ color: '#16a34a' }} />
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold" style={{ color: '#16a34a' }}>{fmt(existingPayment.amount_paid)}</p>
              <p className="text-sm mt-1" style={{ color: '#6e6e73' }}>Paid via {existingPayment.payment_method.toUpperCase()} · {paidOn}</p>
              {existingPayment.note && <p className="text-xs mt-1" style={{ color: '#86868b' }}>{existingPayment.note}</p>}
            </div>
            <p className="text-xs" style={{ color: '#86868b' }}>{monthName} salary already recorded</p>
          </div>
          <div className="flex gap-2 px-6 py-4" style={{ borderTop: '1px solid #f2f2f7' }}>
            <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: '10px', background: '#f2f2f7', border: 'none', fontSize: '14px', fontWeight: 600, color: '#1d1d1f', cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
        <div style={{ background: '#ffffff', borderRadius: '20px', maxWidth: '420px', width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.3), 0 24px 60px rgba(0,0,0,0.2)' }}>
          <div className="px-6 py-6 flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-full flex items-center justify-center" style={{ background: '#dcfce7', boxShadow: '0 4px 16px rgba(22,163,74,0.3)' }}>
              <BadgeCheck className="h-9 w-9" style={{ color: '#16a34a' }} />
            </div>
            <div className="text-center">
              <p className="text-xl font-bold" style={{ color: '#1d1d1f' }}>Payment Recorded!</p>
              <p className="text-2xl font-bold mt-1" style={{ color: '#16a34a' }}>{fmt(summary.payable_amount)}</p>
              <p className="text-sm mt-1" style={{ color: '#6e6e73' }}>{summary.staff.name} · {monthName} · {method.toUpperCase()}</p>
            </div>
          </div>
          <div className="flex gap-2 px-6 py-4" style={{ borderTop: '1px solid #f2f2f7' }}>
            <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: '10px', background: '#f2f2f7', border: 'none', fontSize: '14px', fontWeight: 600, color: '#1d1d1f', cursor: 'pointer' }}>Done</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div style={{ background: '#ffffff', borderRadius: '20px', maxWidth: '440px', width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.3), 0 24px 60px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid #f2f2f7', background: '#fafafa', borderRadius: '20px 20px 0 0' }}>
          <div>
            <h2 className="text-lg font-bold" style={{ color: '#1d1d1f' }}>Pay Salary</h2>
            <p className="text-sm" style={{ color: '#86868b' }}>{summary.staff.name} · {monthName}</p>
          </div>
          <button onClick={onClose} style={{ background: '#f2f2f7', border: 'none', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6e6e73' }}><X className="h-4 w-4" /></button>
        </div>

        {/* Salary breakdown */}
        <div className="px-6 py-4" style={{ borderBottom: '1px solid #f2f2f7' }}>
          <div style={{ borderRadius: '12px', border: '1px solid #e5e5ea', overflow: 'hidden' }}>
            {[
              { label: 'Monthly Salary',  value: fmt(summary.staff.monthly_salary),  color: '#1d1d1f' },
              { label: 'Payable Days',    value: summary.payable_days.toFixed(1) + 'd', color: '#1d1d1f' },
              { label: 'Gross Earned',    value: fmt(summary.net_salary),             color: '#0071e3' },
              ...(summary.deductions > 0 ? [{ label: 'Deductions', value: `− ${fmt(summary.deductions)}`, color: '#dc2626' }] : []),
              ...(summary.advance > 0    ? [{ label: 'Advance Given', value: `− ${fmt(summary.advance)}`, color: '#f59e0b' }] : []),
            ].map((row, i, arr) => (
              <div key={row.label} className="flex justify-between items-center px-4 py-2.5"
                style={{ borderBottom: i < arr.length - 1 ? '1px solid #f5f5f7' : 'none' }}>
                <span className="text-sm" style={{ color: '#6e6e73' }}>{row.label}</span>
                <span className="text-sm font-semibold" style={{ color: row.color }}>{row.value}</span>
              </div>
            ))}
            <div className="flex justify-between items-center px-4 py-3" style={{ background: '#f0fff4', borderTop: '1px solid #bbf7d0' }}>
              <span className="text-base font-bold" style={{ color: '#15803d' }}>Net Payable</span>
              <span className="text-xl font-bold" style={{ color: '#15803d' }}>{fmt(summary.payable_amount)}</span>
            </div>
          </div>
        </div>

        {/* Payment method */}
        <div className="px-6 py-4" style={{ borderBottom: '1px solid #f2f2f7' }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#86868b' }}>Payment Method</p>
          <div className="flex gap-2">
            {METHODS.map(m => (
              <button key={m.key} onClick={() => setMethod(m.key)}
                className="flex-1 flex flex-col items-center gap-1 py-3 rounded-xl transition-all"
                style={{ background: method === m.key ? '#0071e3' : '#f2f2f7', border: method === m.key ? 'none' : '1px solid #e5e5ea', cursor: 'pointer', boxShadow: method === m.key ? '0 2px 8px rgba(0,113,227,0.4)' : 'none' }}>
                <span className="text-xl">{m.icon}</span>
                <span className="text-xs font-bold" style={{ color: method === m.key ? '#ffffff' : '#1d1d1f' }}>{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Note */}
        <div className="px-6 py-3">
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)"
            style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e5e5ea', fontSize: '14px', color: '#1d1d1f', background: '#fafafa', outline: 'none', boxSizing: 'border-box' }} />
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 py-4" style={{ borderTop: '1px solid #f2f2f7' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: '10px', background: '#f2f2f7', border: 'none', fontSize: '14px', fontWeight: 600, color: '#1d1d1f', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handlePay} disabled={saving}
            style={{ flex: 2, padding: '10px', borderRadius: '10px', background: '#16a34a', border: 'none', fontSize: '14px', fontWeight: 700, color: '#ffffff', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 2px 10px rgba(22,163,74,0.4)' }}>
            <Banknote className="h-4 w-4" />
            {saving ? 'Recording…' : `Confirm Payment · ${fmt(summary.payable_amount)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdvanceModal({ staff, monthName, monthStr, tenantId, summary, advanceAmount, advanceNote, setAdvanceAmount, setAdvanceNote, onClose, onSave, isSaving, fmt }: {
  staff: CarwashStaff; monthName: string; monthStr: string; tenantId: string;
  summary: any; advanceAmount: string; advanceNote: string;
  setAdvanceAmount: (v: string) => void; setAdvanceNote: (v: string) => void;
  onClose: () => void; onSave: () => void; isSaving: boolean; fmt: (n: number) => string;
}) {
  const { data: advances = [] } = useQuery({
    queryKey: ['carwash-advances-modal', tenantId, monthStr, staff.id],
    queryFn: () => getSalaryAdvancesForMonth(tenantId, monthStr),
    enabled: !!tenantId,
  });
  const staffAdvances = advances.filter(a => a.staff_id === staff.id);
  const totalGiven = staffAdvances.reduce((s, a) => s + a.amount, 0);
  const amt = parseFloat(advanceAmount) || 0;
  const remaining = summary ? Math.max(0, summary.payable_amount - amt) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div style={{ background: '#ffffff', borderRadius: '18px', border: '1px solid #d2d2d7', maxWidth: '400px', width: '100%', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>

        <div className="px-6 py-5 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid #f2f2f7' }}>
          <div>
            <h2 className="text-base font-semibold" style={{ color: '#1d1d1f', letterSpacing: '-0.2px' }}>Salary Advance</h2>
            <p className="text-sm mt-0.5" style={{ color: '#86868b' }}>{staff.name} · {monthName}</p>
          </div>
          <button onClick={onClose} style={{ background: '#f2f2f7', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6e6e73' }}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">

          {/* Salary summary row */}
          {summary && summary.net_salary > 0 && (
            <div className="flex gap-0 rounded-xl overflow-hidden" style={{ border: '1px solid #e5e5ea' }}>
              {[
                { label: 'Gross', value: fmt(summary.net_salary), color: '#1d1d1f' },
                { label: 'Advanced', value: fmt(totalGiven), color: '#ff3b30' },
                { label: 'Payable', value: fmt(summary.payable_amount), color: '#34c759' },
              ].map((item, i) => (
                <div key={item.label} className="flex-1 text-center py-3" style={{ borderLeft: i > 0 ? '1px solid #e5e5ea' : 'none', background: '#fafafa' }}>
                  <p className="text-xs" style={{ color: '#86868b' }}>{item.label}</p>
                  <p className="text-sm font-semibold mt-0.5" style={{ color: item.color }}>{item.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Previous advances */}
          {staffAdvances.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: '#86868b' }}>This Month</p>
              <div className="space-y-1">
                {staffAdvances.map((a, i) => (
                  <div key={a.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl" style={{ background: '#fafafa', border: '1px solid #f2f2f7' }}>
                    <p className="text-sm" style={{ color: '#6e6e73' }}>
                      {a.given_at ? new Date(a.given_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : `Entry ${i + 1}`}
                      {a.note ? <span style={{ color: '#86868b' }}> · {a.note}</span> : ''}
                    </p>
                    <p className="text-sm font-semibold" style={{ color: '#ff3b30' }}>−{fmt(a.amount)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New advance form */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: '#86868b' }}>New Advance</p>
            <div className="space-y-2">
              <input type="number" min="1" placeholder="Amount (₹)"
                value={advanceAmount} onChange={e => setAdvanceAmount(e.target.value)}
                autoFocus
                style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #d2d2d7', fontSize: '14px', fontWeight: 500, color: '#1d1d1f', background: '#ffffff', outline: 'none', boxSizing: 'border-box' }}
              />
              <input type="text" placeholder="Note (optional)"
                value={advanceNote} onChange={e => setAdvanceNote(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #d2d2d7', fontSize: '14px', color: '#1d1d1f', background: '#ffffff', outline: 'none', boxSizing: 'border-box' }}
              />
              {amt > 0 && summary && summary.net_salary > 0 && (
                <div className="flex justify-between px-3 py-2.5 rounded-xl" style={{ background: '#fafafa', border: '1px solid #e5e5ea' }}>
                  <span className="text-sm" style={{ color: '#6e6e73' }}>Remaining after this</span>
                  <span className="text-sm font-semibold" style={{ color: remaining <= 0 ? '#ff3b30' : '#34c759' }}>{fmt(remaining)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2 px-4 py-4 flex-shrink-0" style={{ borderTop: '1px solid #f2f2f7' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: '10px', background: '#f2f2f7', border: 'none', fontSize: '14px', fontWeight: 600, color: '#1d1d1f', cursor: 'pointer' }}>
            Close
          </button>
          <button onClick={onSave} disabled={!advanceAmount || parseFloat(advanceAmount) <= 0 || isSaving}
            style={{ flex: 1, padding: '10px', borderRadius: '10px', background: '#0071e3', border: 'none', fontSize: '14px', fontWeight: 600, color: '#ffffff', cursor: 'pointer', opacity: (!advanceAmount || parseFloat(advanceAmount) <= 0 || isSaving) ? 0.4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <Plus className="h-4 w-4" />
            {isSaving ? 'Saving…' : 'Record Advance'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CarwashAttendancePage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const config = useAppStore((s) => s.config);
  const qc = useQueryClient();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  // Today attendance modal
  const [todayModal, setTodayModal] = useState(false);

  // Advance modal state
  const [advanceModal, setAdvanceModal] = useState<CarwashStaff | null>(null);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceNote, setAdvanceNote] = useState('');

  // Pay salary modal state
  const [payModal, setPayModal] = useState<CarwashStaff | null>(null);


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

  // Salary payments for this month
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const { data: salaryPayments = [] } = useQuery({
    queryKey: ['carwash-salary-payments', tenantId, monthStr],
    queryFn: () => getSalaryPaymentsForMonth(tenantId, monthStr),
    enabled: !!tenantId,
  });
  const paymentMap = useMemo(() => {
    const map: Record<string, CarwashSalaryPayment> = {};
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
      const summary = summaries.find(sm => sm.staff.id === advanceModal!.id);
      if (summary && amount > summary.payable_amount) throw new Error(`Advance cannot exceed payable amount (${fmt(summary.payable_amount)})`);
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

  const paySalaryMutation = useMutation({
    mutationFn: async ({ method, note }: { method: string; note: string }) => {
      if (!payModal) throw new Error('No staff selected');
      await recordSalaryPayment(tenantId, payModal.id, monthStr, summaries.find(s => s.staff.id === payModal.id)?.payable_amount ?? 0, method, note || undefined);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['carwash-salary-payments', tenantId, monthStr] });
      toast.success('Salary payment recorded');
    },
    onError: (e: any) => toast.error(e?.message || String(e) || 'Failed to record payment'),
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

  const saveTodayAttendance = async (statuses: Record<string, AttendanceStatus>, date: string) => {
    await Promise.all(
      Object.entries(statuses).map(([staffId, status]) =>
        upsertAttendance(tenantId, staffId, date, status)
      )
    );
    // Always invalidate the viewed month
    qc.invalidateQueries({ queryKey: ['carwash-attendance', tenantId, year, month] });
    qc.invalidateQueries({ queryKey: ['carwash-attendance-summary', tenantId, year, month] });
    // Also invalidate the saved date's own month (may differ if today is in a different month than viewed)
    const savedYear = parseInt(date.slice(0, 4));
    const savedMonth = parseInt(date.slice(5, 7));
    if (savedYear !== year || savedMonth !== month) {
      qc.invalidateQueries({ queryKey: ['carwash-attendance', tenantId, savedYear, savedMonth] });
      qc.invalidateQueries({ queryKey: ['carwash-attendance-summary', tenantId, savedYear, savedMonth] });
    }
    setTodayModal(false);
    const saved = new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    toast.success(`Attendance saved for ${saved}`);
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

  // Calendar grid cells for the month (Mon-first)
  const firstDow = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const startOffset = (firstDow + 6) % 7; // Mon=0 … Sun=6
  const rawGrid: (number | null)[] = [...Array(startOffset).fill(null), ...days];
  while (rawGrid.length % 7 !== 0) rawGrid.push(null);

  // 3-D shadow tokens
  const cardShadow = '0 1px 2px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.10), 0 16px 32px rgba(0,0,0,0.08)';
  const raisedShadow = '0 1px 3px rgba(0,0,0,0.14), 0 6px 18px rgba(0,0,0,0.12), 0 20px 40px rgba(0,0,0,0.09)';
  const innerShadow = 'inset 0 1px 3px rgba(0,0,0,0.06)';

  return (
    <div className="flex flex-col" style={{ background: 'linear-gradient(160deg,#1c2133 0%,#111520 100%)', height: '100%', overflow: 'hidden' }}>

      {/* Header — floating plate */}
      <div className="px-6 py-4 flex items-center justify-between"
        style={{ background: '#ffffff', boxShadow: '0 2px 12px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.2)', position: 'relative', zIndex: 10 }}>
        <div>
          <p className="text-xs uppercase tracking-widest mb-0.5" style={{ color: '#86868b', letterSpacing: '0.08em' }}>Car Wash</p>
          <h1 className="text-2xl font-semibold" style={{ color: '#1d1d1f', letterSpacing: '-0.5px' }}>Attendance & Salary</h1>
        </div>
        <div className="flex items-center gap-2">
          {staff.length > 0 && (
            <button onClick={() => setTodayModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: '#0071e3', color: '#fff', borderRadius: '10px', border: 'none', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,113,227,0.5), 0 1px 2px rgba(0,0,0,0.15)' }}>
              <CalendarCheck className="h-4 w-4" />
              Today's Attendance
            </button>
          )}
          <button onClick={prevMonth}
            style={{ background: '#f2f2f7', border: 'none', borderRadius: '8px', padding: '8px', cursor: 'pointer', color: '#1d1d1f', display: 'flex', boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 1px rgba(0,0,0,0.06)' }}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium px-4 py-2"
            style={{ color: '#1d1d1f', background: '#f2f2f7', borderRadius: '8px', minWidth: '150px', textAlign: 'center', boxShadow: innerShadow }}>
            {monthName}
          </span>
          <button onClick={nextMonth}
            style={{ background: '#f2f2f7', border: 'none', borderRadius: '8px', padding: '8px', cursor: 'pointer', color: '#1d1d1f', display: 'flex', boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 1px rgba(0,0,0,0.06)' }}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>


{staff.length === 0 ? (
        <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center gap-3 py-24">
          <Users className="h-12 w-12" style={{ color: 'rgba(255,255,255,0.2)' }} />
          <p className="text-base" style={{ color: 'rgba(255,255,255,0.35)' }}>No staff added yet — go to Staff page first</p>
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
              <div key={s.id} style={{ borderRadius: '16px', overflow: 'hidden', boxShadow: raisedShadow, border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-stretch">

                  {/* Left — staff info */}
                  <div className="p-4 flex flex-col gap-2.5"
                    style={{ width: '170px', flexShrink: 0, background: '#f7f7fa', borderRight: '1px solid #eeeef0', boxShadow: 'inset -2px 0 4px rgba(0,0,0,0.03)' }}>
                    <div className="flex items-center gap-2.5">
                      <div className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0"
                        style={{ background: '#0071e3', boxShadow: '0 2px 8px rgba(0,113,227,0.4)' }}>
                        {s.name[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-tight" style={{ color: '#1d1d1f', wordBreak: 'break-word' }}>{s.name}</p>
                        <p className="text-xs capitalize mt-0.5" style={{ color: '#86868b' }}>{s.role}</p>
                      </div>
                    </div>
                    {s.monthly_salary > 0 && (
                      <div className="rounded-lg px-2.5 py-2" style={{ background: '#ffffff', boxShadow: cardShadow }}>
                        <p className="text-xs" style={{ color: '#86868b' }}>Monthly</p>
                        <p className="text-sm font-semibold" style={{ color: '#1d1d1f' }}>{fmt(s.monthly_salary)}</p>
                      </div>
                    )}
                    {salaryDueDateStr && (
                      <div className="rounded-lg px-2.5 py-2"
                        style={{ background: salaryDuePassed ? '#fff2f2' : '#f0fff4', boxShadow: cardShadow, border: `1px solid ${salaryDuePassed ? '#ffb3b0' : '#a3e6b0'}` }}>
                        <p className="text-xs font-medium" style={{ color: salaryDuePassed ? '#ff3b30' : '#34c759' }}>💰 Due {salaryDueDateStr}</p>
                      </div>
                    )}
                    {s.monthly_salary > 0 && (
                      <div className="rounded-lg px-2.5 py-2" style={{ background: '#ffffff', boxShadow: cardShadow }}>
                        <p className="text-xs" style={{ color: '#86868b' }}>Gross this month</p>
                        <p className="text-sm font-semibold" style={{ color: '#0071e3' }}>{fmt(summary.net_salary)}</p>
                        {summary.deductions > 0 && <p className="text-xs" style={{ color: '#ff3b30' }}>−{fmt(summary.deductions)}</p>}
                      </div>
                    )}
                  </div>

                  {/* Middle — calendar */}
                  <div className="flex-1 min-w-0 p-4" style={{ background: '#ffffff' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                      {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map((d, i) => (
                        <div key={d} className="text-center mb-1.5 py-1.5 rounded-lg"
                          style={{ fontSize: '10px', fontWeight: 700, color: i >= 5 ? '#b91c1c' : '#1d1d1f', letterSpacing: '0.02em', background: '#f0f0f5', boxShadow: '0 2px 4px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d}</div>
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
                            <span style={{ fontSize: '10px', color: '#d1d1d6' }}>{d}</span>
                            <div style={{ height: '30px', width: '100%', borderRadius: '6px', background: '#f5f5f7', boxShadow: innerShadow }} />
                          </div>
                        );

                        const cfg = status ? STATUS_CONFIG[status] : null;

                        return (
                          <div key={d} className="flex flex-col items-center gap-0.5">
                            <span style={{ fontSize: '11px', fontWeight: 700, color: isToday ? '#0071e3' : isSunday ? '#b91c1c' : '#1d1d1f' }}>{d}</span>
                            <button
                              disabled={isFuture || markMutation.isPending}
                              onClick={() => cycleStatus(s.id, d)}
                              title={isSalaryDay ? `Salary due: ${salaryDueDateStr}` : undefined}
                              style={{
                                height: '30px', width: '100%', borderRadius: '6px',
                                fontSize: '9px', fontWeight: 700, cursor: isFuture ? 'default' : 'pointer', whiteSpace: 'nowrap', overflow: 'hidden',
                                background: cfg ? cfg.bg : isSalaryDay ? '#fff8e6' : '#f2f2f7',
                                color: cfg ? cfg.color : isSalaryDay ? '#ff9500' : '#c7c7cc',
                                border: isToday && !cfg ? '1.5px solid #0071e3' : isSalaryDay && !cfg ? '1.5px solid #ff9500' : '1.5px solid transparent',
                                opacity: isFuture ? 0.2 : 1,
                                outline: 'none',
                                boxShadow: cfg
                                  ? `0 2px 6px ${cfg.dotColor}70, 0 1px 2px rgba(0,0,0,0.1)`
                                  : innerShadow,
                                transition: 'box-shadow 0.15s, opacity 0.1s',
                              }}>
                              {cfg ? cfg.label : isSalaryDay ? '₹' : '·'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right — summary + actions */}
                  <div className="p-4 flex flex-col gap-2"
                    style={{ width: '175px', flexShrink: 0, background: '#f7f7fa', borderLeft: '1px solid #eeeef0', boxShadow: 'inset 2px 0 4px rgba(0,0,0,0.03)' }}>

                    {/* Attendance breakdown */}
                    <div style={{ borderRadius: '10px', overflow: 'hidden', background: '#ffffff', boxShadow: cardShadow }}>
                      {[
                        { label: 'Present',  value: summary.present,  color: '#000000' },
                        { label: 'Half Day', value: summary.half_day, color: '#22c55e' },
                        { label: 'Absent',   value: summary.absent,   color: '#b91c1c' },
                        { label: 'Leave',    value: summary.leave,    color: '#1d4ed8' },
                        { label: 'Holiday',  value: summary.holiday,  color: '#b8a000' },
                      ].map((row, i, arr) => (
                        <div key={row.label} className="flex items-center justify-between px-3 py-1.5"
                          style={{ borderBottom: i < arr.length - 1 ? '1px solid #f5f5f7' : 'none' }}>
                          <div className="flex items-center gap-2">
                            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: row.value > 0 ? row.color : '#e5e5ea', flexShrink: 0, boxShadow: row.value > 0 ? `0 1px 4px ${row.color}70` : 'none' }} />
                            <span className="text-xs" style={{ color: row.value > 0 ? '#1d1d1f' : '#aeaeb2' }}>{row.label}</span>
                          </div>
                          <span className="text-sm font-semibold" style={{ color: row.value > 0 ? row.color : '#d1d1d6' }}>{row.value}</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between px-3 py-1.5"
                        style={{ background: '#f9f9fb', borderTop: '1px solid #e5e5ea' }}>
                        <span className="text-xs" style={{ color: '#6e6e73' }}>Payable days</span>
                        <span className="text-sm font-semibold" style={{ color: '#1d1d1f' }}>{summary.payable_days.toFixed(1)}</span>
                      </div>
                    </div>

                    {/* Advance */}
                    <button onClick={() => { setAdvanceModal(s); setAdvanceAmount(''); setAdvanceNote(''); }}
                      className="flex items-center justify-center gap-1.5 transition-opacity hover:opacity-80"
                      style={{ padding: '8px', borderRadius: '10px', background: summary.advance > 0 ? '#fff8e6' : '#ffffff', border: `1px solid ${summary.advance > 0 ? '#ffd60a' : '#e5e5ea'}`, fontSize: '13px', fontWeight: 600, color: summary.advance > 0 ? '#ff9500' : '#6e6e73', cursor: 'pointer', boxShadow: cardShadow }}>
                      <Wallet className="h-3.5 w-3.5" />
                      {summary.advance > 0 ? `Advance · ${fmt(summary.advance)}` : 'Add Advance'}
                    </button>

                    {/* Pay Salary */}
                    {s.monthly_salary > 0 && (() => {
                      const paid = paymentMap[s.id];
                      return paid ? (
                        <button onClick={() => setPayModal(s)}
                          className="flex items-center justify-center gap-1.5 transition-opacity hover:opacity-80"
                          style={{ padding: '8px', borderRadius: '10px', background: '#dcfce7', border: '1px solid #86efac', fontSize: '13px', fontWeight: 600, color: '#15803d', cursor: 'pointer', boxShadow: cardShadow }}>
                          <BadgeCheck className="h-3.5 w-3.5" />
                          Paid · {fmt(paid.amount_paid)}
                        </button>
                      ) : (
                        <button onClick={() => setPayModal(s)}
                          className="flex items-center justify-center gap-1.5 transition-opacity hover:opacity-80"
                          style={{ padding: '8px', borderRadius: '10px', background: '#16a34a', border: 'none', fontSize: '13px', fontWeight: 600, color: '#ffffff', cursor: 'pointer', boxShadow: '0 2px 8px rgba(22,163,74,0.4)' }}>
                          <Banknote className="h-3.5 w-3.5" />
                          Pay Salary
                        </button>
                      );
                    })()}

                    {/* Print */}
                    <button onClick={() => printSalarySlip(s)}
                      className="flex items-center justify-center gap-1.5 transition-opacity hover:opacity-80"
                      style={{ padding: '8px', borderRadius: '10px', background: '#ffffff', border: '1px solid #e5e5ea', fontSize: '13px', fontWeight: 600, color: '#6e6e73', cursor: 'pointer', boxShadow: cardShadow }}>
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

      {/* Month Total — 3D raised bar */}
      <div className="px-6 py-3.5 flex items-center gap-3 flex-wrap"
        style={{ background: 'linear-gradient(180deg,#1e2235 0%,#161929 100%)', borderTop: '1px solid rgba(255,255,255,0.1)', zIndex: 20, boxShadow: '0 -6px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07), inset 0 -1px 0 rgba(0,0,0,0.4)', flexShrink: 0 }}>
        <p className="text-xs font-semibold uppercase tracking-widest mr-1" style={{ color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em' }}>Month Total</p>
        {[
          { label: 'Staff',      value: String(staff.length),                                           color: '#ffffff',  glow: 'rgba(255,255,255,0.15)', bg: 'rgba(255,255,255,0.06)' },
          { label: 'Gross',      value: fmt(summaries.reduce((a, sm) => a + sm.net_salary, 0)),         color: '#0a84ff',  glow: 'rgba(10,132,255,0.3)',   bg: 'rgba(10,132,255,0.1)'   },
          { label: 'Deductions', value: fmt(summaries.reduce((a, sm) => a + sm.deductions, 0)),         color: '#ff453a',  glow: 'rgba(255,69,58,0.3)',    bg: 'rgba(255,69,58,0.1)'    },
          { label: 'Advances',   value: fmt(summaries.reduce((a, sm) => a + sm.advance, 0)),            color: '#ff9f0a',  glow: 'rgba(255,159,10,0.3)',   bg: 'rgba(255,159,10,0.1)'   },
          { label: 'Payable',    value: fmt(summaries.reduce((a, sm) => a + sm.payable_amount, 0)),     color: '#30d158',  glow: 'rgba(48,209,88,0.35)',   bg: 'rgba(48,209,88,0.1)'    },
        ].map(item => (
          <div key={item.label} className="flex flex-col items-center px-4 py-2 rounded-xl"
            style={{ background: item.bg, border: '1px solid rgba(255,255,255,0.07)', boxShadow: `0 2px 8px ${item.glow}, 0 1px 2px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)`, minWidth: '80px' }}>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{item.label}</p>
            <p className="text-base font-semibold" style={{ color: item.color, textShadow: `0 0 12px ${item.glow}` }}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Today's attendance modal */}
      {todayModal && (
        <TodayAttendanceModal
          staff={staff} initialDate={todayISO()} tenantId={tenantId}
          attMap={attMap} year={year} month={month} onClose={() => setTodayModal(false)} onSave={saveTodayAttendance}
        />
      )}

      {/* Confirm change from Present */}
      {confirmChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div style={{ background: '#ffffff', borderRadius: '18px', border: '1px solid #d2d2d7', maxWidth: '320px', width: '100%', padding: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', textAlign: 'center' }}>
            <p className="text-base font-semibold mb-1" style={{ color: '#1d1d1f' }}>Change Attendance?</p>
            <p className="text-sm mb-1" style={{ color: '#6e6e73' }}>{confirmChange.staffName} · {confirmChange.dateLabel}</p>
            <p className="text-sm mb-5" style={{ color: '#6e6e73' }}>
              Mark as{' '}
              <span className="font-semibold px-2 py-0.5 rounded-full text-white text-xs" style={{ background: STATUS_CONFIG[confirmChange.next].dotColor }}>
                {STATUS_CONFIG[confirmChange.next].label}
              </span>?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmChange(null)} style={{ flex: 1, padding: '10px', borderRadius: '10px', background: '#f2f2f7', border: 'none', fontSize: '14px', fontWeight: 600, color: '#1d1d1f', cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmAndMark} style={{ flex: 1, padding: '10px', borderRadius: '10px', background: STATUS_CONFIG[confirmChange.next].dotColor, border: 'none', fontSize: '14px', fontWeight: 600, color: '#ffffff', cursor: 'pointer' }}>Change</button>
            </div>
          </div>
        </div>
      )}

      {/* Advance Modal — history + add new */}
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

      {/* Pay Salary Modal */}
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

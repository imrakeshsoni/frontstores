// [hardware] [all tenants]
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { appCacheDir } from '@tauri-apps/api/path';
import { ChevronLeft, Phone, Calendar, IndianRupee, BadgeCheck, Printer, Clock } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import {
  listAllHwStaff, getHwSalaryPaymentsForStaff, getHwAttendanceForDateRange,
  getHwSalaryAdvancesForDateRange, computeHwSalary,
  type HardwareStaff,
} from '@/lib/db/hardware';

const ACCENT = '#d97706';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

function monthLabel(m: string) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

export function HardwareStaffDetailPage() {
  const { staffId } = useParams<{ staffId: string }>();
  const navigate = useNavigate();
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const config = useAppStore((s) => s.config);

  const { data: allStaff = [] } = useQuery({
    queryKey: ['hw-staff-list', tenantId],
    queryFn: () => listAllHwStaff(tenantId),
    enabled: !!tenantId,
  });
  const staff = allStaff.find(s => s.id === staffId) as HardwareStaff | undefined;

  const { data: payments = [] } = useQuery({
    queryKey: ['hw-staff-payments', tenantId, staffId],
    queryFn: () => getHwSalaryPaymentsForStaff(tenantId, staffId!),
    enabled: !!tenantId && !!staffId,
  });

  const now = new Date();
  const toMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const fromDate = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1);
  const fromMonth = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}`;

  const { data: attendance = [] } = useQuery({
    queryKey: ['hw-staff-att-range', tenantId, staffId, fromMonth, toMonth],
    queryFn: () => getHwAttendanceForDateRange(tenantId, fromMonth, toMonth),
    enabled: !!tenantId && !!staffId,
  });

  const { data: advances = [] } = useQuery({
    queryKey: ['hw-staff-adv-range', tenantId, staffId, fromMonth, toMonth],
    queryFn: () => getHwSalaryAdvancesForDateRange(tenantId, fromMonth, toMonth),
    enabled: !!tenantId && !!staffId,
  });

  if (!staff) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-slate-400">Staff not found.</p>
      </div>
    );
  }

  // Build month list from joining date to now, most recent first
  const joinMonth = staff.joining_date ? staff.joining_date.slice(0, 7) : fromMonth;
  const months: string[] = [];
  {
    const [fy, fm] = joinMonth.split('-').map(Number);
    const [ty, tm] = toMonth.split('-').map(Number);
    let y = fy, m = fm;
    while (y < ty || (y === ty && m <= tm)) {
      months.push(`${y}-${String(m).padStart(2, '0')}`);
      m++; if (m > 12) { m = 1; y++; }
    }
  }
  months.reverse();

  const paymentMap: Record<string, typeof payments[0]> = {};
  for (const p of payments) paymentMap[p.month] = p;

  const joiningDateStr = staff.joining_date
    ? new Date(staff.joining_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const printSalarySlip = async (month: string) => {
    if (!staff) return;
    const [y, m] = month.split('-').map(Number);
    const staffAtt = attendance.filter(a => a.staff_id === staff.id && a.date.startsWith(month));
    const summary = computeHwSalary(staff, staffAtt, y, m);
    const advTotal = Math.min(
      advances.filter(a => a.staff_id === staff.id && a.month === month).reduce((s, a) => s + a.amount, 0),
      summary.net_salary
    );
    const payable = Math.max(0, summary.net_salary - advTotal);
    const payment = paymentMap[month];
    const mLabel = monthLabel(month);
    const rawShopName = config?.shop_name ?? 'Hardware Store';
    const shopName = String(rawShopName).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const rawLogo = (config?.settings as any)?.logo_base64;
    const logo = rawLogo ? String(rawLogo).replace(/"/g, '') : null;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      @page{size:A4 landscape;margin:12mm}
      *{box-sizing:border-box}
      body{font-family:Arial,sans-serif;margin:0;padding:0;font-size:12px;color:#111;background:#fff}
      .page{width:100%;display:flex;flex-direction:column;gap:12px}
      .header{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#111;border-radius:8px;color:#fff}
      .header-left{display:flex;align-items:center;gap:12px}
      .logo{max-height:44px;max-width:100px;object-fit:contain;border-radius:4px}
      .shop{font-size:17px;font-weight:700;color:#fff}
      .shop-sub{font-size:10px;color:#aaa;margin-top:1px}
      .slip-title{font-size:16px;font-weight:700;color:${ACCENT};text-align:right}
      .slip-month{font-size:11px;color:#ccc;text-align:right;margin-top:2px}
      .body{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .card{border:1px solid #e5e7eb;border-radius:8px;overflow:hidden}
      .card-title{background:#f9fafb;padding:6px 12px;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:#6b7280;border-bottom:1px solid #e5e7eb}
      .row{display:flex;justify-content:space-between;align-items:center;padding:5px 12px;border-bottom:1px solid #f3f4f6}
      .row:last-child{border-bottom:none}
      .row .label{color:#6b7280;font-size:11px}
      .row .value{font-weight:600;font-size:12px;color:#111}
      .net-row{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#f0fdf4}
      .net-label{font-weight:700;font-size:13px;color:#15803d}
      .net-value{font-weight:800;font-size:18px;color:#15803d}
      .att-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;padding:10px 12px}
      .att-pill{text-align:center;border-radius:6px;padding:6px 4px}
      .att-pill .num{font-size:18px;font-weight:700}
      .att-pill .lbl{font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;margin-top:2px}
      .paid-bar{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#dcfce7;border-top:1px solid #86efac}
      .paid-bar .badge{font-weight:700;color:#15803d;font-size:12px}
      .paid-bar .detail{font-size:11px;color:#166534}
      .footer{text-align:center;font-size:10px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:8px}
      .green{color:#16a34a} .red{color:#dc2626} .amber{color:#d97706}
      @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    </style></head><body>
    <div class="page">
      <div class="header">
        <div class="header-left">
          ${logo ? `<img src="${logo}" class="logo" />` : ''}
          <div>
            <div class="shop">${shopName}</div>
            ${config?.address_line1 ? `<div class="shop-sub">${[config.address_line1, config.city].filter(Boolean).join(', ')}${config?.phone ? ' · 📞 ' + config.phone : ''}</div>` : (config?.phone ? `<div class="shop-sub">📞 ${config.phone}</div>` : '')}
          </div>
        </div>
        <div>
          <div class="slip-title">SALARY SLIP</div>
          <div class="slip-month">${mLabel}</div>
        </div>
      </div>
      <div class="body">
        <div style="display:flex;flex-direction:column;gap:12px">
          <div class="card">
            <div class="card-title">Employee Details</div>
            <div class="row"><span class="label">Name</span><span class="value">${staff.name}</span></div>
            <div class="row"><span class="label">Role</span><span class="value" style="text-transform:capitalize">${staff.role}</span></div>
            ${staff.phone ? `<div class="row"><span class="label">Phone</span><span class="value">${staff.phone}</span></div>` : ''}
            ${staff.joining_date ? `<div class="row"><span class="label">Joining Date</span><span class="value">${new Date(staff.joining_date + 'T00:00:00').toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'})}</span></div>` : ''}
            <div class="row"><span class="label">Monthly Salary</span><span class="value">${fmt(staff.monthly_salary)}</span></div>
            <div class="row"><span class="label">Per Day Rate</span><span class="value">${fmt(summary.per_day_rate)}</span></div>
          </div>
          <div class="card">
            <div class="card-title">Attendance — ${mLabel}</div>
            <div class="att-grid">
              <div class="att-pill" style="background:#f0fdf4"><div class="num green">${summary.present}</div><div class="lbl green">Present</div></div>
              <div class="att-pill" style="background:#f0fdf4"><div class="num" style="color:#22c55e">${summary.half_day}</div><div class="lbl" style="color:#16a34a">Half Day</div></div>
              <div class="att-pill" style="background:#fef2f2"><div class="num red">${summary.absent}</div><div class="lbl red">Absent</div></div>
              <div class="att-pill" style="background:#eff6ff"><div class="num" style="color:#1d4ed8">${summary.leave}</div><div class="lbl" style="color:#1d4ed8">Leave</div></div>
              <div class="att-pill" style="background:#fefce8"><div class="num" style="color:#b45309">${summary.holiday ?? 0}</div><div class="lbl" style="color:#b45309">Holiday</div></div>
            </div>
            <div class="row" style="border-top:1px solid #e5e7eb"><span class="label">Payable Days</span><span class="value">${summary.payable_days.toFixed(1)} days</span></div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px">
          <div class="card">
            <div class="card-title">Salary Calculation</div>
            <div class="row"><span class="label">Monthly Salary</span><span class="value">${fmt(staff.monthly_salary)}</span></div>
            <div class="row"><span class="label">Payable Days</span><span class="value">${summary.payable_days.toFixed(1)}</span></div>
            <div class="row"><span class="label">Gross Earned</span><span class="value" style="color:${ACCENT}">${fmt(summary.net_salary)}</span></div>
            ${summary.deductions > 0 ? `<div class="row"><span class="label red">Deductions</span><span class="value red">− ${fmt(summary.deductions)}</span></div>` : ''}
            ${advTotal > 0 ? `<div class="row"><span class="label amber">Advance Given</span><span class="value amber">− ${fmt(advTotal)}</span></div>` : ''}
            <div class="net-row"><span class="net-label">Net Payable</span><span class="net-value">${fmt(payable)}</span></div>
            ${payment ? `<div class="paid-bar"><span class="badge">✓ SALARY PAID</span><span class="detail">via ${payment.payment_method.toUpperCase()} · ${new Date(payment.paid_at!).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'})}</span></div>` : ''}
          </div>
          <div class="card" style="flex:1;display:flex;flex-direction:column;justify-content:flex-end">
            <div class="card-title">Signatures</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0">
              <div style="padding:24px 16px 12px;border-right:1px solid #e5e7eb">
                <div style="border-top:1px solid #111;padding-top:6px;text-align:center;font-size:10px;color:#6b7280">Employee Signature</div>
              </div>
              <div style="padding:24px 16px 12px">
                <div style="border-top:1px solid #111;padding-top:6px;text-align:center;font-size:10px;color:#6b7280">Employer Signature</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="footer">Generated on ${new Date().toLocaleDateString('en-IN')} · ${shopName} · Powered by FrontStores</div>
    </div>
    <script>window.onload=()=>{window.print()}</script>
    </body></html>`;

    const dir = await appCacheDir();
    const path = `${dir}/salary-slip-${staff.id}-${month}.html`;
    await writeTextFile(path, html);
    await shellOpen(path);
  };

  return (
    <div className="flex flex-col" style={{ height: '100%', overflow: 'hidden' }}>

      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-3 border-b border-slate-200 bg-white" style={{ flexShrink: 0 }}>
        <button onClick={() => navigate('/hardware/staff')}
          className="flex items-center gap-1 text-sm font-medium hover:opacity-70"
          style={{ color: ACCENT }}>
          <ChevronLeft className="h-4 w-4" /> Back to Staff
        </button>
        <div className="w-px h-5 mx-1 bg-slate-200" />
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-400">Hardware · Staff</p>
          <h1 className="text-lg font-semibold text-slate-900">{staff.name}</h1>
        </div>
      </div>

      {/* Two-column body */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── LEFT: Staff profile ── */}
        <div className="w-72 flex-shrink-0 overflow-y-auto p-5 space-y-4 bg-white border-r border-slate-200">

          {/* Avatar + name */}
          <div className="flex flex-col items-center gap-3 pt-2 pb-4 border-b border-slate-100">
            <div className="h-16 w-16 rounded-full flex items-center justify-center text-2xl font-bold text-white"
              style={{ background: staff.is_active ? ACCENT : '#9ca3af' }}>
              {((staff.name?.[0] ?? '?').toUpperCase())}
            </div>
            <div className="text-center">
              <h1 className="text-lg font-bold text-slate-900">{staff.name}</h1>
              <p className="text-xs capitalize mt-0.5 text-slate-500">
                {staff.role}{!staff.is_active ? ' · Inactive' : ''}
              </p>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-3">
            {staff.phone && (
              <div className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 flex-shrink-0 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-400">Phone</p>
                  <p className="text-sm font-semibold text-slate-900">{staff.phone}</p>
                </div>
              </div>
            )}
            {joiningDateStr && (
              <div className="flex items-center gap-2.5">
                <Calendar className="h-4 w-4 flex-shrink-0 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-400">Joined</p>
                  <p className="text-sm font-semibold text-slate-900">{joiningDateStr}</p>
                </div>
              </div>
            )}
            {staff.monthly_salary > 0 && (
              <div className="flex items-center gap-2.5">
                <IndianRupee className="h-4 w-4 flex-shrink-0 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-400">Monthly Salary</p>
                  <p className="text-sm font-bold" style={{ color: ACCENT }}>{fmt(staff.monthly_salary)}</p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-2.5">
              <BadgeCheck className="h-4 w-4 flex-shrink-0 mt-0.5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-400">Deduction rules</p>
                <p className="text-xs mt-0.5 text-slate-500">
                  Half day: {staff.deduct_half_day ? 'deducted' : 'full pay'}
                </p>
                <p className="text-xs text-slate-500">
                  Leave: {staff.deduct_full_day_leave ? 'deducted' : 'paid'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Payment history ── */}
        <div className="flex-1 overflow-y-auto p-5">
          <h2 className="text-base font-bold mb-4 text-slate-900">Salary History</h2>

          {months.length === 0 ? (
            <p className="text-sm text-slate-400">No salary history yet.</p>
          ) : (
            <div className="space-y-2.5">
              {months.map(mon => {
                const [y, m] = mon.split('-').map(Number);
                const staffAtt = attendance.filter(a => a.staff_id === staff.id && a.date.startsWith(mon));
                const summary = computeHwSalary(staff, staffAtt, y, m);
                const advTotal = Math.min(
                  advances.filter(a => a.staff_id === staff.id && a.month === mon).reduce((s, a) => s + a.amount, 0),
                  summary.net_salary
                );
                const payable = Math.max(0, summary.net_salary - advTotal);
                const payment = paymentMap[mon];
                if (mon > toMonth) return null;

                return (
                  <div key={mon} className="rounded-2xl overflow-hidden bg-white"
                    style={{ border: `1px solid ${payment ? '#86efac' : '#e2e8f0'}` }}>
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        {payment ? (
                          <div className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 bg-green-100">
                            <BadgeCheck className="h-4 w-4 text-green-600" />
                          </div>
                        ) : (
                          <div className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 bg-slate-100">
                            <Clock className="h-4 w-4 text-slate-400" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-sm text-slate-900">{monthLabel(mon)}</p>
                          <p className="text-xs text-slate-500">
                            P:{summary.present} H:{summary.half_day} A:{summary.absent} L:{summary.leave} · {summary.payable_days.toFixed(1)} days
                          </p>
                          {payment && (
                            <p className="text-xs mt-0.5 text-green-600">
                              Paid via {payment.payment_method.toUpperCase()} · {new Date(payment.paid_at!).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          {staff.monthly_salary > 0 ? (
                            <>
                              <p className="text-base font-bold" style={{ color: payment ? '#16a34a' : ACCENT }}>{fmt(payable)}</p>
                              {advTotal > 0 && <p className="text-xs text-amber-600">−{fmt(advTotal)} advance</p>}
                              {summary.deductions > 0 && <p className="text-xs text-red-600">−{fmt(summary.deductions)} deducted</p>}
                            </>
                          ) : (
                            <p className="text-xs text-slate-400">Salary not set</p>
                          )}
                        </div>
                        <button onClick={() => printSalarySlip(mon)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-200 hover:opacity-75 transition-opacity">
                          <Printer className="h-3.5 w-3.5" /> Print
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// [carwash] [all tenants]
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { appCacheDir } from '@tauri-apps/api/path';
import { ChevronLeft, Phone, Calendar, IndianRupee, BadgeCheck, Printer, Clock } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import {
  listAllCarwashStaff, getSalaryPaymentsForStaff, getAttendanceForDateRange,
  getSalaryAdvancesForDateRange, computeSalary,
  type CarwashStaff,
} from '@/lib/db/carwash';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

function monthLabel(m: string) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

export function CarwashStaffDetailPage() {
  const { staffId } = useParams<{ staffId: string }>();
  const navigate = useNavigate();
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const config = useAppStore((s) => s.config);

  const { data: allStaff = [] } = useQuery({
    queryKey: ['carwash-staff-list', tenantId],
    queryFn: () => listAllCarwashStaff(tenantId),
    enabled: !!tenantId,
  });
  const staff = allStaff.find(s => s.id === staffId) as CarwashStaff | undefined;

  const { data: payments = [] } = useQuery({
    queryKey: ['carwash-staff-payments', tenantId, staffId],
    queryFn: () => getSalaryPaymentsForStaff(tenantId, staffId!),
    enabled: !!tenantId && !!staffId,
  });

  // Load attendance for the last 12 months to compute salary summaries
  const now = new Date();
  const toMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const fromDate = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1);
  const fromMonth = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}`;

  const { data: attendance = [] } = useQuery({
    queryKey: ['carwash-staff-att-range', tenantId, staffId, fromMonth, toMonth],
    queryFn: () => getAttendanceForDateRange(tenantId, fromMonth, toMonth),
    enabled: !!tenantId && !!staffId,
  });

  const { data: advances = [] } = useQuery({
    queryKey: ['carwash-staff-adv-range', tenantId, staffId, fromMonth, toMonth],
    queryFn: () => getSalaryAdvancesForDateRange(tenantId, fromMonth, toMonth),
    enabled: !!tenantId && !!staffId,
  });

  if (!staff) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p style={{ color: 'var(--text-tertiary)' }}>Staff not found.</p>
      </div>
    );
  }

  // Build month list from joining date to now
  const joinMonth = staff.joining_date
    ? staff.joining_date.slice(0, 7)
    : fromMonth;
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
  // Most recent first
  months.reverse();

  const paymentMap: Record<string, typeof payments[0]> = {};
  for (const p of payments) paymentMap[p.month] = p;

  const printSalarySlip = async (month: string) => {
    if (!staff) return;
    const [y, m] = month.split('-').map(Number);
    const staffAtt = attendance.filter(a => a.staff_id === staff.id && a.date.startsWith(month));
    const summary = computeSalary(staff, staffAtt, y, m);
    const advTotal = Math.min(
      advances.filter(a => a.staff_id === staff.id && a.month === month).reduce((s, a) => s + a.amount, 0),
      summary.net_salary
    );
    const payable = Math.max(0, summary.net_salary - advTotal);
    const payment = paymentMap[month];
    const mLabel = monthLabel(month);
    const shopName = config?.shop_name ?? 'Car Wash';
    const logo = (config?.settings as any)?.logo_base64;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      @page{size:A4 landscape;margin:12mm}
      *{box-sizing:border-box}
      body{font-family:Arial,sans-serif;margin:0;padding:0;font-size:12px;color:#111;background:#fff}
      .page{width:100%;display:flex;flex-direction:column;gap:12px}
      /* Top header bar */
      .header{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#111;border-radius:8px;color:#fff}
      .header-left{display:flex;align-items:center;gap:12px}
      .logo{max-height:44px;max-width:100px;object-fit:contain;border-radius:4px}
      .shop{font-size:17px;font-weight:700;color:#fff}
      .shop-sub{font-size:10px;color:#aaa;margin-top:1px}
      .slip-title{font-size:16px;font-weight:700;color:#f59e0b;text-align:right}
      .slip-month{font-size:11px;color:#ccc;text-align:right;margin-top:2px}
      /* Two-column body */
      .body{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .card{border:1px solid #e5e7eb;border-radius:8px;overflow:hidden}
      .card-title{background:#f9fafb;padding:6px 12px;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:#6b7280;border-bottom:1px solid #e5e7eb}
      .row{display:flex;justify-content:space-between;align-items:center;padding:5px 12px;border-bottom:1px solid #f3f4f6}
      .row:last-child{border-bottom:none}
      .row .label{color:#6b7280;font-size:11px}
      .row .value{font-weight:600;font-size:12px;color:#111}
      /* Net payable highlight */
      .net-row{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#f0fdf4}
      .net-label{font-weight:700;font-size:13px;color:#15803d}
      .net-value{font-weight:800;font-size:18px;color:#15803d}
      /* Attendance pills */
      .att-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;padding:10px 12px}
      .att-pill{text-align:center;border-radius:6px;padding:6px 4px}
      .att-pill .num{font-size:18px;font-weight:700}
      .att-pill .lbl{font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;margin-top:2px}
      /* Payment badge */
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
        <!-- Left column -->
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

        <!-- Right column -->
        <div style="display:flex;flex-direction:column;gap:12px">
          <div class="card">
            <div class="card-title">Salary Calculation</div>
            <div class="row"><span class="label">Monthly Salary</span><span class="value">${fmt(staff.monthly_salary)}</span></div>
            <div class="row"><span class="label">Payable Days</span><span class="value">${summary.payable_days.toFixed(1)}</span></div>
            <div class="row"><span class="label">Gross Earned</span><span class="value" style="color:#0071e3">${fmt(summary.net_salary)}</span></div>
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

  const joiningDateStr = staff.joining_date
    ? new Date(staff.joining_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">

      {/* Back + header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm font-medium transition-opacity hover:opacity-70"
          style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
      </div>

      {/* Staff info card */}
      <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <div className="flex items-center gap-4 mb-5">
          <div className="h-16 w-16 rounded-full flex items-center justify-center text-2xl font-bold text-white flex-shrink-0"
            style={{ background: staff.is_active ? 'var(--accent)' : '#9ca3af' }}>
            {staff.name[0].toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{staff.name}</h1>
            <p className="text-sm capitalize mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{staff.role}{!staff.is_active ? ' · Inactive' : ''}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {staff.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
              <div>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Phone</p>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{staff.phone}</p>
              </div>
            </div>
          )}
          {joiningDateStr && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
              <div>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Joined</p>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{joiningDateStr}</p>
              </div>
            </div>
          )}
          {staff.monthly_salary > 0 && (
            <div className="flex items-center gap-2">
              <IndianRupee className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
              <div>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Monthly Salary</p>
                <p className="text-sm font-bold" style={{ color: 'var(--accent)' }}>{fmt(staff.monthly_salary)}</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
            <div>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Salary Settings</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Half day: {staff.deduct_half_day ? 'deducted' : 'full pay'} ·
                Leave: {staff.deduct_full_day_leave ? 'deducted' : 'paid'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Salary slips */}
      <div>
        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Salary History</h2>
        {months.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No salary history yet.</p>
        ) : (
          <div className="space-y-3">
            {months.map(mon => {
              const [y, m] = mon.split('-').map(Number);
              const staffAtt = attendance.filter(a => a.staff_id === staff.id && a.date.startsWith(mon));
              const summary = computeSalary(staff, staffAtt, y, m);
              const advTotal = Math.min(
                advances.filter(a => a.staff_id === staff.id && a.month === mon).reduce((s, a) => s + a.amount, 0),
                summary.net_salary
              );
              const payable = Math.max(0, summary.net_salary - advTotal);
              const payment = paymentMap[mon];
              const isFuture = mon > toMonth;
              if (isFuture) return null;

              return (
                <div key={mon} className="rounded-2xl overflow-hidden"
                  style={{ background: 'var(--surface)', border: `1px solid ${payment ? '#86efac' : 'var(--surface-border)'}` }}>
                  <div className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                      {payment ? (
                        <div className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#dcfce7' }}>
                          <BadgeCheck className="h-5 w-5" style={{ color: '#16a34a' }} />
                        </div>
                      ) : (
                        <div className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--surface-2)' }}>
                          <Clock className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} />
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{monthLabel(mon)}</p>
                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          P:{summary.present} H:{summary.half_day} A:{summary.absent} L:{summary.leave} · {summary.payable_days.toFixed(1)} payable days
                        </p>
                        {payment && (
                          <p className="text-xs mt-0.5" style={{ color: '#16a34a' }}>
                            Paid via {payment.payment_method.toUpperCase()} · {new Date(payment.paid_at!).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        {staff.monthly_salary > 0 ? (
                          <>
                            <p className="text-base font-bold" style={{ color: payment ? '#16a34a' : 'var(--accent)' }}>{fmt(payable)}</p>
                            {advTotal > 0 && <p className="text-xs" style={{ color: '#f59e0b' }}>−{fmt(advTotal)} advance</p>}
                            {summary.deductions > 0 && <p className="text-xs" style={{ color: '#dc2626' }}>−{fmt(summary.deductions)} deducted</p>}
                          </>
                        ) : (
                          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Salary not set</p>
                        )}
                      </div>
                      <button onClick={() => printSalarySlip(mon)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-75"
                        style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
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
  );
}

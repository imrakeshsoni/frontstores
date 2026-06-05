// [carwash] [all tenants]
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Users, PhoneCall, Download, FileSpreadsheet, Filter, CalendarDays, Printer, ChevronDown, ChevronUp } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { sendWhatsApp } from '@/lib/whatsapp';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { appCacheDir } from '@tauri-apps/api/path';
import {
  getMonthlyRevenue, getPopularServices, getLapsedCustomers, getStaffPerformance,
  getStaffWeeklyPerformance, getTodayStats, getAttendanceSummaryForMonth,
  getAllJobsForExport, getCustomersWithJobStats, listInventoryForExport,
  listAllServices, listAllCarwashStaff,
  getAttendanceForDateRange, getSalaryAdvancesForDateRange, computeSalary,
  type CarwashStaff, type CarwashAttendance, type CarwashSalaryAdvance,
} from '@/lib/db/carwash';
import { useNavigate } from 'react-router-dom';

type PageTab = 'dashboard' | 'export' | 'attendance';
type ExportSection = 'jobs' | 'customers' | 'staff' | 'services' | 'inventory';

function todayISO() { return new Date().toISOString().slice(0, 10); }
function thisMonthISO() { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; }
function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

function firstOfMonth() { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-01`; }

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function CarwashReportsPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const config = useAppStore((s) => s.config);
  const navigate = useNavigate();
  const today = todayISO();
  const now = new Date();
  const [pageTab, setPageTab] = useState<PageTab>('dashboard');
  const [exportSection, setExportSection] = useState<ExportSection>('jobs');

  // Attendance report state
  const [attFromMonth, setAttFromMonth] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; });
  const [attToMonth, setAttToMonth] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; });
  const [staffView, setStaffView] = useState<'today' | 'week'>('today');

  // Export filters
  const [jobFrom, setJobFrom] = useState(firstOfMonth());
  const [jobTo, setJobTo]     = useState(todayISO());
  const [jobStatus, setJobStatus] = useState('');
  const [jobCustomer, setJobCustomer] = useState('');

  const { data: monthlyRevenue = [] } = useQuery({
    queryKey: ['carwash-monthly', tenantId],
    queryFn: () => getMonthlyRevenue(tenantId, 6),
    enabled: !!tenantId,
  });

  const { data: popularServices = [] } = useQuery({
    queryKey: ['carwash-popular', tenantId, thisMonthISO()],
    queryFn: () => getPopularServices(tenantId, today),
    enabled: !!tenantId,
  });

  const { data: lapsedCustomers = [] } = useQuery({
    queryKey: ['carwash-lapsed', tenantId],
    queryFn: () => getLapsedCustomers(tenantId, 30),
    enabled: !!tenantId,
  });

  const { data: staffToday = [] } = useQuery({
    queryKey: ['carwash-staff-report', tenantId, today],
    queryFn: () => getStaffPerformance(tenantId, today),
    enabled: !!tenantId,
  });

  const { data: staffWeekly = [] } = useQuery({
    queryKey: ['carwash-staff-weekly', tenantId],
    queryFn: () => getStaffWeeklyPerformance(tenantId),
    enabled: !!tenantId,
  });

  const { data: todayStats } = useQuery({
    queryKey: ['carwash-stats-report', tenantId, today],
    queryFn: () => getTodayStats(tenantId),
    enabled: !!tenantId,
  });

  const { data: salarySummaries = [] } = useQuery({
    queryKey: ['carwash-salary-report', tenantId, now.getFullYear(), now.getMonth() + 1],
    queryFn: () => getAttendanceSummaryForMonth(tenantId, now.getFullYear(), now.getMonth() + 1),
    enabled: !!tenantId,
  });

  // Export queries — only fetch when on export tab
  const { data: exportJobs = [], isFetching: jobsFetching, refetch: refetchJobs } = useQuery({
    queryKey: ['export-jobs', tenantId, jobFrom, jobTo, jobStatus, jobCustomer],
    queryFn: () => getAllJobsForExport(tenantId, { from: jobFrom, to: jobTo, status: jobStatus || undefined, customerPhone: jobCustomer || undefined }),
    enabled: !!tenantId && pageTab === 'export' && exportSection === 'jobs',
  });
  const { data: exportCustomers = [], isFetching: custFetching } = useQuery({
    queryKey: ['export-customers', tenantId],
    queryFn: () => getCustomersWithJobStats(tenantId),
    enabled: !!tenantId && pageTab === 'export' && exportSection === 'customers',
  });
  const { data: exportStaff = [], isFetching: staffFetching } = useQuery({
    queryKey: ['export-staff', tenantId],
    queryFn: () => listAllCarwashStaff(tenantId),
    enabled: !!tenantId && pageTab === 'export' && exportSection === 'staff',
  });
  const { data: exportServices = [], isFetching: svcFetching } = useQuery({
    queryKey: ['export-services', tenantId],
    queryFn: () => listAllServices(tenantId),
    enabled: !!tenantId && pageTab === 'export' && exportSection === 'services',
  });
  const { data: exportInventory = [], isFetching: invFetching } = useQuery({
    queryKey: ['export-inventory', tenantId],
    queryFn: () => listInventoryForExport(tenantId),
    enabled: !!tenantId && pageTab === 'export' && exportSection === 'inventory',
  });

  const maxRevenue = Math.max(...monthlyRevenue.map(m => m.revenue), 1);

  // Aggregate weekly staff data
  const weeklyByStaff: Record<string, { jobs: number; revenue: number; days: number }> = {};
  for (const row of staffWeekly) {
    if (!weeklyByStaff[row.staff_name]) weeklyByStaff[row.staff_name] = { jobs: 0, revenue: 0, days: 0 };
    weeklyByStaff[row.staff_name].jobs += row.jobs;
    weeklyByStaff[row.staff_name].revenue += row.revenue;
    weeklyByStaff[row.staff_name].days++;
  }
  const staffWeeklyAgg = Object.entries(weeklyByStaff)
    .map(([name, d]) => ({ staff_name: name, ...d }))
    .sort((a, b) => b.jobs - a.jobs);

  const callWhatsApp = (phone: string, name: string) => {
    const msg = `Hi ${name} 👋\n\nWe miss your car! 🚗 It's been a while since your last wash.\n\nVisit ${config?.shop_name ?? 'us'} for a fresh clean today. Special offer for loyal customers!\n\nCall us or just drive in 😊`;
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 10) return;
    sendWhatsApp(cleaned, msg);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>Car Wash</p>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Reports & Analytics</h1>
      </div>

      {/* Page tab switcher */}
      <div className="flex gap-1 p-1 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <button onClick={() => setPageTab('dashboard')}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: pageTab === 'dashboard' ? 'var(--accent)' : 'transparent', color: pageTab === 'dashboard' ? '#111' : 'var(--text-secondary)' }}>
          <TrendingUp className="h-4 w-4" /> Dashboard
        </button>
        <button onClick={() => setPageTab('attendance')}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: pageTab === 'attendance' ? 'var(--accent)' : 'transparent', color: pageTab === 'attendance' ? '#111' : 'var(--text-secondary)' }}>
          <CalendarDays className="h-4 w-4" /> Attendance
        </button>
        <button onClick={() => setPageTab('export')}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: pageTab === 'export' ? 'var(--accent)' : 'transparent', color: pageTab === 'export' ? '#111' : 'var(--text-secondary)' }}>
          <FileSpreadsheet className="h-4 w-4" /> Export Data
        </button>
      </div>

      {pageTab === 'attendance' && (
        <AttendanceTab
          tenantId={tenantId}
          config={config}
          fromMonth={attFromMonth} setFromMonth={setAttFromMonth}
          toMonth={attToMonth} setToMonth={setAttToMonth}
        />
      )}

      {pageTab === 'export' && (
        <ExportTab
          tenantId={tenantId}
          section={exportSection} setSection={setExportSection}
          jobFrom={jobFrom} setJobFrom={setJobFrom}
          jobTo={jobTo} setJobTo={setJobTo}
          jobStatus={jobStatus} setJobStatus={setJobStatus}
          jobCustomer={jobCustomer} setJobCustomer={setJobCustomer}
          exportJobs={exportJobs} jobsFetching={jobsFetching}
          exportCustomers={exportCustomers} custFetching={custFetching}
          exportStaff={exportStaff} staffFetching={staffFetching}
          exportServices={exportServices} svcFetching={svcFetching}
          exportInventory={exportInventory} invFetching={invFetching}
        />
      )}

      {pageTab === 'dashboard' && <>

      {/* Today summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Today's Revenue", value: fmt(todayStats?.revenue ?? 0), color: '#16a34a', bg: '#dcfce7' },
          { label: 'Cars Today', value: String(todayStats?.totalJobs ?? 0), color: '#2563eb', bg: '#dbeafe' },
          { label: 'Avg Ticket', value: todayStats?.delivered ? fmt(todayStats.revenue / todayStats.delivered) : '—', color: '#7c3aed', bg: '#ede9fe' },
          { label: 'Lapsed (30d)', value: String(lapsedCustomers.length), color: '#dc2626', bg: '#fee2e2' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>{s.label}</p>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Monthly revenue chart */}
      {monthlyRevenue.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Monthly Revenue</h2>
          </div>
          <div className="space-y-3">
            {monthlyRevenue.map(m => (
              <div key={m.month} className="flex items-center gap-3">
                <span className="text-xs w-16 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                  {new Date(m.month + '-01').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}
                </span>
                <div className="flex-1 h-6 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                  <div className="h-full rounded-full flex items-center px-2"
                    style={{ width: `${(m.revenue / maxRevenue) * 100}%`, background: 'var(--accent)', minWidth: m.revenue > 0 ? '2rem' : 0 }}>
                    <span className="text-white text-xs font-bold truncate">{fmt(m.revenue)}</span>
                  </div>
                </div>
                <span className="text-xs w-16 text-right flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>{m.jobs} cars</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Popular services */}
        {popularServices.length > 0 && (
          <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Popular Services (this month)</h2>
            <div className="space-y-2">
              {popularServices.map((s, i) => (
                <div key={s.service_name} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--surface-border)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold w-5" style={{ color: 'var(--text-tertiary)' }}>#{i + 1}</span>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{s.service_name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold" style={{ color: 'var(--accent)' }}>{s.count}×</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{fmt(s.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Staff performance — today / week toggle */}
        {(staffToday.length > 0 || staffWeeklyAgg.length > 0) && (
          <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Staff Performance</h2>
              </div>
              <div className="flex gap-1">
                {(['today', 'week'] as const).map(v => (
                  <button key={v} onClick={() => setStaffView(v)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${staffView === v ? 'text-white' : 'btn-secondary'}`}
                    style={staffView === v ? { background: 'var(--accent)' } : {}}>
                    {v === 'today' ? 'Today' : 'This Week'}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {(staffView === 'today' ? staffToday : staffWeeklyAgg).map(s => (
                <div key={s.staff_name} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--surface-border)' }}>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>👤 {s.staff_name}</span>
                  <div className="text-right">
                    <p className="text-sm font-bold" style={{ color: 'var(--accent)' }}>{s.jobs} cars</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {fmt(s.revenue)}{staffView === 'week' && (s as any).days ? ` · ${(s as any).days}d` : ''}
                    </p>
                  </div>
                </div>
              ))}
              {(staffView === 'today' ? staffToday : staffWeeklyAgg).length === 0 && (
                <p className="text-sm py-4 text-center" style={{ color: 'var(--text-tertiary)' }}>No data</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Lapsed customers — win-back */}
      {lapsedCustomers.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <div className="flex items-center gap-2 mb-1">
            <PhoneCall className="h-4 w-4 text-red-500" />
            <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Win Back — {lapsedCustomers.length} customers (30+ days away)</h2>
          </div>
          <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>
            Send a WhatsApp message to bring them back. One tap per customer.
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {lapsedCustomers.map((c, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-1" style={{ borderBottom: '1px solid var(--surface-border)' }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{c.customer_name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    🚗 {c.reg_number} · Last: {new Date(c.last_visit).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                {c.customer_phone && (
                  <button onClick={() => callWhatsApp(c.customer_phone, c.customer_name)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white flex-shrink-0 ml-3"
                    style={{ background: '#25d366' }}>
                    💬 WhatsApp
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payroll Summary — current month */}
      {salarySummaries.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--surface-border)' }}>
            <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>
              Payroll — {new Date(now.getFullYear(), now.getMonth()).toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
            </h2>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--surface-border)' }}>
            {salarySummaries.map(sm => (
              <div key={sm.staff.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: 'var(--accent)' }}>{sm.staff.name[0].toUpperCase()}</div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{sm.staff.name}</p>
                    <p className="text-xs capitalize" style={{ color: 'var(--text-tertiary)' }}>
                      P:{sm.present} H:{sm.half_day} A:{sm.absent} L:{sm.leave}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {sm.staff.monthly_salary > 0 ? (
                    <>
                      <p className="font-bold text-sm" style={{ color: 'var(--accent)' }}>{fmt(sm.net_salary)}</p>
                      {sm.deductions > 0 && <p className="text-xs" style={{ color: '#dc2626' }}>−{fmt(sm.deductions)} deducted</p>}
                    </>
                  ) : (
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Salary not set</p>
                  )}
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between px-5 py-3" style={{ background: 'var(--surface-2)' }}>
              <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Total Payroll</p>
              <p className="font-bold text-base" style={{ color: 'var(--accent)' }}>
                {fmt(salarySummaries.reduce((s, sm) => s + sm.net_salary, 0))}
              </p>
            </div>
          </div>
        </div>
      )}

      </> /* end dashboard tab */}
    </div>
  );
}

// ── Attendance Report Tab ─────────────────────────────────────────────────────

const ATT_LABELS: Record<string, string> = { present: 'Present', half_day: 'Half Day', absent: 'Absent', leave: 'Leave', holiday: 'Holiday' };
const ATT_COLORS: Record<string, string> = { present: '#16a34a', half_day: '#d97706', absent: '#dc2626', leave: '#7c3aed', holiday: '#0891b2' };

function daysInMonth2(year: number, month: number) { return new Date(year, month, 0).getDate(); }
function fmtRs(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

function monthsBetween(fromMonth: string, toMonth: string): string[] {
  const result: string[] = [];
  const [fy, fm] = fromMonth.split('-').map(Number);
  const [ty, tm] = toMonth.split('-').map(Number);
  let y = fy, m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    result.push(`${y}-${String(m).padStart(2,'0')}`);
    m++; if (m > 12) { m = 1; y++; }
  }
  return result;
}

function AttendanceTab({ tenantId, config, fromMonth, setFromMonth, toMonth, setToMonth }: {
  tenantId: string; config: any; fromMonth: string; setFromMonth: (v:string) => void; toMonth: string; setToMonth: (v:string) => void;
}) {
  const [selectedStaff, setSelectedStaff] = useState<string>('all');
  const [expandedStaff, setExpandedStaff] = useState<string | null>(null);

  const { data: allStaff = [] } = useQuery({
    queryKey: ['att-report-staff', tenantId],
    queryFn: () => listAllCarwashStaff(tenantId),
    enabled: !!tenantId,
  });

  const { data: attendance = [], isFetching: attFetching } = useQuery({
    queryKey: ['att-report-data', tenantId, fromMonth, toMonth],
    queryFn: () => getAttendanceForDateRange(tenantId, fromMonth, toMonth),
    enabled: !!tenantId,
  });

  const { data: advances = [] } = useQuery({
    queryKey: ['att-report-advances', tenantId, fromMonth, toMonth],
    queryFn: () => getSalaryAdvancesForDateRange(tenantId, fromMonth, toMonth),
    enabled: !!tenantId,
  });

  const months = useMemo(() => monthsBetween(fromMonth, toMonth), [fromMonth, toMonth]);

  const filteredStaff = selectedStaff === 'all' ? allStaff : allStaff.filter(s => s.id === selectedStaff);

  // Build per-staff per-month summaries
  const summaryData = useMemo(() => {
    return filteredStaff.map(staff => {
      const monthSummaries = months.map(mon => {
        const [y, m] = mon.split('-').map(Number);
        const att = attendance.filter(a => a.staff_id === staff.id && a.date.startsWith(mon));
        const adv = advances.filter(a => a.staff_id === staff.id && a.month === mon);
        const summary = computeSalary(staff, att, y, m);
        const advTotal = Math.min(adv.reduce((s, a) => s + a.amount, 0), summary.net_salary);
        return { month: mon, ...summary, advance: advTotal, payable_amount: Math.max(0, summary.net_salary - advTotal), advanceEntries: adv };
      });
      return { staff, months: monthSummaries };
    });
  }, [filteredStaff, months, attendance, advances]);

  const handleExportCSV = () => {
    const rows: string[][] = [['Employee', 'Month', 'Present', 'Half Day', 'Absent', 'Leave', 'Working Days', 'Gross Salary (₹)', 'Advance (₹)', 'Net Payable (₹)']];
    for (const sd of summaryData) {
      for (const ms of sd.months) {
        rows.push([sd.staff.name, ms.month, String(ms.present), String(ms.half_day), String(ms.absent), String(ms.leave), String(ms.working_days), String(ms.net_salary), String(ms.advance), String(ms.payable_amount)]);
      }
    }
    downloadCSV(`attendance-report-${fromMonth}-to-${toMonth}.csv`, rows);
  };

  const handlePrint = async () => {
    const shopName = config?.shop_name ?? 'Car Wash';
    const logo = (config?.settings as any)?.logo_base64;
    let html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      body{font-family:Arial,sans-serif;padding:20px;font-size:12px;color:#111}
      h1{font-size:20px;font-weight:700;margin:0 0 4px}
      .sub{color:#6b7280;font-size:12px;margin-bottom:20px}
      table{width:100%;border-collapse:collapse;margin-bottom:24px}
      th{background:#f59e0b;color:#111;padding:6px 8px;text-align:left;font-size:11px}
      td{padding:5px 8px;border-bottom:1px solid #e5e7eb;font-size:11px}
      .staff-name{font-weight:700;font-size:13px;padding:10px 8px 4px;background:#f9fafb;border-top:2px solid #f59e0b}
      .green{color:#16a34a;font-weight:600} .red{color:#dc2626;font-weight:600} .amber{color:#d97706;font-weight:600}
      .logo{max-height:50px;max-width:120px;object-fit:contain;margin-bottom:6px}
      .header{text-align:center;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #f59e0b}
      @media print{.no-print{display:none}}
    </style></head><body>
    <div class="header">
      ${logo ? `<div><img src="${logo}" class="logo" /></div>` : ''}
      <div style="font-size:18px;font-weight:700">${shopName}</div>
      ${config?.address_line1 ? `<div style="font-size:11px;color:#6b7280">${[config.address_line1, config.city].filter(Boolean).join(', ')}</div>` : ''}
    </div>
    <h1>Attendance Report</h1>
    <div class="sub">Period: ${fromMonth} to ${toMonth} · Generated: ${new Date().toLocaleDateString('en-IN')}</div>`;

    for (const sd of summaryData) {
      html += `<div class="staff-name">${sd.staff.name} — ${sd.staff.role} ${sd.staff.monthly_salary > 0 ? `(${fmtRs(sd.staff.monthly_salary)}/mo)` : ''}</div>
      <table><tr><th>Month</th><th>Present</th><th>Half Day</th><th>Absent</th><th>Leave</th><th>Working Days</th><th>Gross</th><th>Advance</th><th>Payable</th></tr>`;
      for (const ms of sd.months) {
        html += `<tr>
          <td>${new Date(ms.month + '-01').toLocaleString('en-IN',{month:'long',year:'numeric'})}</td>
          <td class="green">${ms.present}</td>
          <td class="amber">${ms.half_day}</td>
          <td class="red">${ms.absent}</td>
          <td>${ms.leave}</td>
          <td>${ms.working_days}</td>
          <td>${ms.net_salary > 0 ? fmtRs(ms.net_salary) : '—'}</td>
          <td class="red">${ms.advance > 0 ? fmtRs(ms.advance) : '—'}</td>
          <td class="green">${ms.net_salary > 0 ? fmtRs(ms.payable_amount) : '—'}</td>
        </tr>`;
        if (ms.advanceEntries.length > 0) {
          html += `<tr><td colspan="9" style="font-size:10px;color:#6b7280;padding-left:20px">
            Advance entries: ${ms.advanceEntries.map((a: CarwashSalaryAdvance) => `${fmtRs(a.amount)}${a.note ? ` (${a.note})` : ''} on ${new Date(a.given_at ?? a.created_at).toLocaleDateString('en-IN')}`).join(' · ')}
          </td></tr>`;
        }
      }
      html += `</table>`;
    }
    html += `</body></html>`;
    const finalHtml = html.replace('</body>', `<script>window.addEventListener('load',()=>setTimeout(window.print,400))<\/script></body>`);
    try {
      const cacheDir = await appCacheDir();
      const sep = cacheDir.endsWith('/') || cacheDir.endsWith('\\') ? '' : '/';
      const path = `${cacheDir}${sep}attendance-report-${fromMonth}-${toMonth}.html`;
      await writeTextFile(path, finalHtml);
      await shellOpen(path);
    } catch (e: any) { alert('Print failed: ' + (e?.message ?? e)); }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <p className="text-xs font-semibold uppercase" style={{ color: 'var(--text-tertiary)' }}>Filter Report</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>From Month</label>
            <input type="month" value={fromMonth} onChange={e => setFromMonth(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)', outline: 'none' }} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>To Month</label>
            <input type="month" value={toMonth} onChange={e => setToMonth(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)', outline: 'none' }} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Employee</label>
            <select value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)', outline: 'none' }}>
              <option value="all">All Staff</option>
              {allStaff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
              <Printer className="h-4 w-4" /> Print
            </button>
            <button onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: 'var(--accent)', color: '#111' }}>
              <Download className="h-4 w-4" /> Export CSV
            </button>
          </div>
        </div>
      </div>

      {attFetching && <p className="text-sm text-center py-8" style={{ color: 'var(--text-tertiary)' }}>Loading...</p>}

      {!attFetching && summaryData.length === 0 && (
        <p className="text-sm text-center py-8" style={{ color: 'var(--text-tertiary)' }}>No staff found</p>
      )}

      {/* Per-staff monthly summary cards */}
      {!attFetching && summaryData.map(({ staff, months: ms }) => {
        const isExpanded = expandedStaff === staff.id;
        const totalPresent = ms.reduce((s, m) => s + m.present, 0);
        const totalAbsent = ms.reduce((s, m) => s + m.absent, 0);
        const totalGross = ms.reduce((s, m) => s + m.net_salary, 0);
        const totalAdvance = ms.reduce((s, m) => s + m.advance, 0);
        const totalPayable = ms.reduce((s, m) => s + m.payable_amount, 0);

        return (
          <div key={staff.id} className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            {/* Staff header */}
            <button className="w-full flex items-center justify-between px-5 py-4"
              onClick={() => setExpandedStaff(isExpanded ? null : staff.id)}>
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
                  style={{ background: 'var(--accent)' }}>{staff.name[0].toUpperCase()}</div>
                <div className="text-left">
                  <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{staff.name}</p>
                  <p className="text-xs capitalize" style={{ color: 'var(--text-tertiary)' }}>{staff.role}{staff.monthly_salary > 0 ? ` · ${fmtRs(staff.monthly_salary)}/mo` : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Present</p>
                  <p className="font-bold text-sm" style={{ color: '#16a34a' }}>{totalPresent}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Absent</p>
                  <p className="font-bold text-sm" style={{ color: '#dc2626' }}>{totalAbsent}</p>
                </div>
                {totalGross > 0 && <>
                  <div className="text-center">
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Gross</p>
                    <p className="font-bold text-sm" style={{ color: 'var(--accent)' }}>{fmtRs(totalGross)}</p>
                  </div>
                  {totalAdvance > 0 && <div className="text-center">
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Advance</p>
                    <p className="font-bold text-sm" style={{ color: '#dc2626' }}>−{fmtRs(totalAdvance)}</p>
                  </div>}
                  <div className="text-center">
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Payable</p>
                    <p className="font-bold text-sm" style={{ color: '#16a34a' }}>{fmtRs(totalPayable)}</p>
                  </div>
                </>}
                {isExpanded ? <ChevronUp className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} /> : <ChevronDown className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />}
              </div>
            </button>

            {/* Expanded: month-by-month detail */}
            {isExpanded && (
              <div style={{ borderTop: '1px solid var(--surface-border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)' }}>
                      {['Month','Present','Half Day','Absent','Leave','Working Days','Gross','Advance','Payable'].map(h => (
                        <th key={h} className="text-xs font-semibold px-4 py-2 text-left" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--surface-border)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ms.map(m => (
                      <>
                        <tr key={m.month} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                          <td className="px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {new Date(m.month + '-01').toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
                          </td>
                          <td className="px-4 py-2.5 text-xs font-bold" style={{ color: '#16a34a' }}>{m.present}</td>
                          <td className="px-4 py-2.5 text-xs font-bold" style={{ color: '#d97706' }}>{m.half_day}</td>
                          <td className="px-4 py-2.5 text-xs font-bold" style={{ color: '#dc2626' }}>{m.absent}</td>
                          <td className="px-4 py-2.5 text-xs" style={{ color: '#7c3aed' }}>{m.leave}</td>
                          <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{m.working_days}</td>
                          <td className="px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--accent)' }}>{m.net_salary > 0 ? fmtRs(m.net_salary) : '—'}</td>
                          <td className="px-4 py-2.5 text-xs font-semibold" style={{ color: '#dc2626' }}>{m.advance > 0 ? `−${fmtRs(m.advance)}` : '—'}</td>
                          <td className="px-4 py-2.5 text-xs font-bold" style={{ color: '#16a34a' }}>{m.net_salary > 0 ? fmtRs(m.payable_amount) : '—'}</td>
                        </tr>
                        {m.advanceEntries.length > 0 && (
                          <tr key={m.month + '-adv'} style={{ background: 'rgba(220,38,38,0.04)', borderBottom: '1px solid var(--surface-border)' }}>
                            <td colSpan={9} className="px-4 py-1.5 text-xs" style={{ color: '#dc2626' }}>
                              Advance: {m.advanceEntries.map((a: CarwashSalaryAdvance) => `${fmtRs(a.amount)}${a.note ? ` (${a.note})` : ''} on ${new Date(a.given_at ?? a.created_at).toLocaleDateString('en-IN')}`).join(' · ')}
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>

                {/* Daily detail for the date range */}
                <DailyDetailSection staff={staff} attendance={attendance.filter(a => a.staff_id === staff.id)} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DailyDetailSection({ staff, attendance }: { staff: CarwashStaff; attendance: CarwashAttendance[] }) {
  const ATT_BG: Record<string, string> = { present: '#dcfce7', half_day: '#fef3c7', absent: '#fee2e2', leave: '#ede9fe', holiday: '#e0f2fe' };
  if (attendance.length === 0) return (
    <div className="px-4 py-3 text-xs" style={{ color: 'var(--text-tertiary)', borderTop: '1px solid var(--surface-border)' }}>
      No attendance records in this period
    </div>
  );
  const sorted = [...attendance].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <div style={{ borderTop: '1px solid var(--surface-border)', padding: '12px 16px' }}>
      <p className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>Daily Record</p>
      <div className="flex flex-wrap gap-1.5">
        {sorted.map(a => {
          const d = new Date(a.date);
          const dayName = d.toLocaleString('en-IN', { weekday: 'short' });
          const dateLabel = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
          return (
            <div key={a.id} title={`${dateLabel} (${dayName}) — ${ATT_LABELS[a.status] ?? a.status}`}
              className="flex flex-col items-center rounded-lg px-2 py-1.5"
              style={{ background: ATT_BG[a.status] ?? 'var(--surface-2)', minWidth: '42px' }}>
              <span className="text-xs font-semibold" style={{ color: ATT_COLORS[a.status] ?? 'var(--text-primary)' }}>{dateLabel}</span>
              <span className="text-xs" style={{ color: '#6b7280' }}>{dayName}</span>
              <span className="text-xs font-bold" style={{ color: ATT_COLORS[a.status] ?? 'var(--text-primary)' }}>{a.status === 'present' ? 'P' : a.status === 'half_day' ? 'H' : a.status === 'absent' ? 'A' : a.status === 'leave' ? 'L' : 'O'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Export Tab ────────────────────────────────────────────────────────────────
function ExportTab({ tenantId, section, setSection, jobFrom, setJobFrom, jobTo, setJobTo, jobStatus, setJobStatus, jobCustomer, setJobCustomer, exportJobs, jobsFetching, exportCustomers, custFetching, exportStaff, staffFetching, exportServices, svcFetching, exportInventory, invFetching }: any) {
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  const SECTIONS = [
    { id: 'jobs',      label: 'Job Cards',  count: exportJobs.length },
    { id: 'customers', label: 'Customers',  count: exportCustomers.length },
    { id: 'staff',     label: 'Staff',      count: exportStaff.length },
    { id: 'services',  label: 'Services',   count: exportServices.length },
    { id: 'inventory', label: 'Inventory',  count: exportInventory.length },
  ];

  const handleDownload = () => {
    if (section === 'jobs' && jobFrom > jobTo) {
      alert('"From" date must be before "To" date'); return;
    }
    if (section === 'jobs') {
      const rows = [['Job #','Date','Reg Number','Vehicle Type','Make','Model','Color','Customer','Phone','Staff','Services','Subtotal','Discount','GST','Total','Payment','Status']];
      for (const j of exportJobs) {
        rows.push([j.job_number, new Date(j.created_at).toLocaleDateString('en-IN'), j.reg_number, j.vehicle_type, j.make??'', j.model??'', j.color??'', j.customer_name??'', j.customer_phone??'', j.staff_name??'', (j.items??[]).map((i:any)=>i.service_name).join('; '), j.subtotal, j.discount, Math.round(j.gst_amount), Math.round(j.total), j.payment_method??'', j.status]);
      }
      downloadCSV(`job-cards-${jobFrom}-to-${jobTo}.csv`, rows);
    } else if (section === 'customers') {
      const rows = [['Customer Name','Phone','Total Jobs','Total Spent (₹)','Last Visit']];
      for (const c of exportCustomers) rows.push([c.customer_name??'', c.customer_phone??'', c.total_jobs, Math.round(c.total_spent), new Date(c.last_visit).toLocaleDateString('en-IN')]);
      downloadCSV('customers.csv', rows);
    } else if (section === 'staff') {
      const rows = [['Name','Phone','Role','Monthly Salary (₹)','Joining Date','Deduct Half Day','Deduct Leave']];
      for (const s of exportStaff) rows.push([s.name, s.phone??'', s.role, s.monthly_salary??0, s.joining_date??'', s.deduct_half_day?'Yes':'No', s.deduct_full_day_leave?'Yes':'No']);
      downloadCSV('staff.csv', rows);
    } else if (section === 'services') {
      const rows = [['Service Name','Duration (min)','Active']];
      for (const s of exportServices) rows.push([s.name, s.duration_minutes, s.is_active?'Yes':'No']);
      downloadCSV('services.csv', rows);
    } else if (section === 'inventory') {
      const rows = [['Item','Category','Unit','Quantity','Min Qty','Cost/Unit (₹)','Notes']];
      for (const i of exportInventory) rows.push([i.name, i.category, i.unit, i.quantity, i.min_quantity, i.cost_per_unit, i.notes??'']);
      downloadCSV('inventory.csv', rows);
    }
  };

  const isLoading = jobsFetching || custFetching || staffFetching || svcFetching || invFetching;
  const count = SECTIONS.find(s => s.id === section)?.count ?? 0;

  return (
    <div className="space-y-4">
      {/* Section tabs */}
      <div className="flex gap-2 flex-wrap">
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background: section === s.id ? 'var(--accent)' : 'var(--surface)', color: section === s.id ? '#111' : 'var(--text-secondary)', border: '1px solid var(--surface-border)' }}>
            {s.label}
            {s.count > 0 && <span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ background: section===s.id?'rgba(0,0,0,0.15)':'var(--surface-2)' }}>{s.count}</span>}
          </button>
        ))}
      </div>

      {/* Filters */}
      {section === 'jobs' && (
        <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <p className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-tertiary)' }}>
            <Filter className="h-3.5 w-3.5" /> Filters
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>From</label>
              <input type="date" value={jobFrom} onChange={e => setJobFrom(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>To</label>
              <input type="date" value={jobTo} onChange={e => setJobTo(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Status</label>
              <select value={jobStatus} onChange={e => setJobStatus(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }}>
                <option value="">All</option>
                <option value="delivered">Delivered</option>
                <option value="waiting">Waiting</option>
                <option value="in_progress">In Progress</option>
                <option value="ready">Ready</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Customer Phone</label>
              <input value={jobCustomer} onChange={e => setJobCustomer(e.target.value)} placeholder="Search by phone"
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
            </div>
          </div>
        </div>
      )}

      {/* Download bar */}
      <div className="flex items-center justify-between rounded-xl px-4 py-3"
        style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {isLoading ? 'Loading…' : `${count} ${SECTIONS.find(s=>s.id===section)?.label ?? ''} record${count !== 1 ? 's' : ''}`}
        </p>
        <button onClick={handleDownload} disabled={count === 0 || isLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-40 transition-all"
          style={{ background: 'var(--accent)', color: '#111' }}>
          <Download className="h-4 w-4" /> Download Excel (.csv)
        </button>
      </div>

      {/* Preview table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <div className="overflow-x-auto max-h-96">
          {section === 'jobs' && (
            <table className="w-full text-xs">
              <thead><tr style={{ background: 'var(--surface-2)', position: 'sticky', top: 0 }}>
                {['Job #','Date','Reg','Type','Make/Model','Color','Customer','Phone','Services','Total','Status'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {exportJobs.map((j:any) => (
                  <tr key={j.id} style={{ borderTop: '1px solid var(--surface-border)' }}>
                    <td className="px-3 py-2 font-bold" style={{ color: 'var(--accent)' }}>{j.job_number}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{new Date(j.created_at).toLocaleDateString('en-IN')}</td>
                    <td className="px-3 py-2 font-semibold" style={{ color: 'var(--text-primary)' }}>{j.reg_number}</td>
                    <td className="px-3 py-2 capitalize" style={{ color: 'var(--text-secondary)' }}>{j.vehicle_type}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{[j.make,j.model].filter(Boolean).join(' ')||'—'}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{j.color||'—'}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{j.customer_name||'—'}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{j.customer_phone||'—'}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-secondary)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(j.items??[]).map((i:any)=>i.service_name).join(', ')}</td>
                    <td className="px-3 py-2 font-bold" style={{ color: 'var(--accent)' }}>{fmt(j.total)}</td>
                    <td className="px-3 py-2"><span className="px-2 py-0.5 rounded-full text-xs font-semibold capitalize" style={{ background: j.status==='delivered'?'#dcfce7':'#fef3c7', color: j.status==='delivered'?'#16a34a':'#d97706' }}>{j.status}</span></td>
                  </tr>
                ))}
                {exportJobs.length === 0 && !jobsFetching && <tr><td colSpan={11} className="px-3 py-8 text-center" style={{ color: 'var(--text-tertiary)' }}>No jobs found for selected filters</td></tr>}
              </tbody>
            </table>
          )}

          {section === 'customers' && (
            <table className="w-full text-xs">
              <thead><tr style={{ background: 'var(--surface-2)', position: 'sticky', top: 0 }}>
                {['Customer','Phone','Total Jobs','Total Spent','Last Visit'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {exportCustomers.map((c:any, i:number) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--surface-border)' }}>
                    <td className="px-3 py-2 font-semibold" style={{ color: 'var(--text-primary)' }}>{c.customer_name||'—'}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{c.customer_phone||'—'}</td>
                    <td className="px-3 py-2 font-bold text-center" style={{ color: 'var(--text-primary)' }}>{c.total_jobs}</td>
                    <td className="px-3 py-2 font-bold" style={{ color: 'var(--accent)' }}>{fmt(c.total_spent)}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{new Date(c.last_visit).toLocaleDateString('en-IN')}</td>
                  </tr>
                ))}
                {exportCustomers.length === 0 && !custFetching && <tr><td colSpan={5} className="px-3 py-8 text-center" style={{ color: 'var(--text-tertiary)' }}>No customer data</td></tr>}
              </tbody>
            </table>
          )}

          {section === 'staff' && (
            <table className="w-full text-xs">
              <thead><tr style={{ background: 'var(--surface-2)', position: 'sticky', top: 0 }}>
                {['Name','Phone','Role','Monthly Salary','Joining Date','Deduct Half Day','Deduct Leave'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {exportStaff.map((s:any) => (
                  <tr key={s.id} style={{ borderTop: '1px solid var(--surface-border)' }}>
                    <td className="px-3 py-2 font-semibold" style={{ color: 'var(--text-primary)' }}>{s.name}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{s.phone||'—'}</td>
                    <td className="px-3 py-2 capitalize" style={{ color: 'var(--text-secondary)' }}>{s.role}</td>
                    <td className="px-3 py-2 font-bold" style={{ color: 'var(--accent)' }}>{s.monthly_salary>0?fmt(s.monthly_salary):'—'}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{s.joining_date?new Date(s.joining_date).toLocaleDateString('en-IN'):'—'}</td>
                    <td className="px-3 py-2 text-center">{s.deduct_half_day?'✓':'—'}</td>
                    <td className="px-3 py-2 text-center">{s.deduct_full_day_leave?'✓':'—'}</td>
                  </tr>
                ))}
                {exportStaff.length === 0 && !staffFetching && <tr><td colSpan={7} className="px-3 py-8 text-center" style={{ color: 'var(--text-tertiary)' }}>No staff data</td></tr>}
              </tbody>
            </table>
          )}

          {section === 'services' && (
            <table className="w-full text-xs">
              <thead><tr style={{ background: 'var(--surface-2)', position: 'sticky', top: 0 }}>
                {['Service Name','Duration (min)','Active'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {exportServices.map((s:any) => (
                  <tr key={s.id} style={{ borderTop: '1px solid var(--surface-border)' }}>
                    <td className="px-3 py-2 font-semibold" style={{ color: 'var(--text-primary)' }}>{s.name}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{s.duration_minutes} min</td>
                    <td className="px-3 py-2"><span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: s.is_active?'#dcfce7':'#fee2e2', color: s.is_active?'#16a34a':'#dc2626' }}>{s.is_active?'Active':'Inactive'}</span></td>
                  </tr>
                ))}
                {exportServices.length === 0 && !svcFetching && <tr><td colSpan={3} className="px-3 py-8 text-center" style={{ color: 'var(--text-tertiary)' }}>No services</td></tr>}
              </tbody>
            </table>
          )}

          {section === 'inventory' && (
            <table className="w-full text-xs">
              <thead><tr style={{ background: 'var(--surface-2)', position: 'sticky', top: 0 }}>
                {['Item','Category','Unit','Qty','Min Qty','Cost/Unit'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {exportInventory.map((i:any) => (
                  <tr key={i.id} style={{ borderTop: '1px solid var(--surface-border)' }}>
                    <td className="px-3 py-2 font-semibold" style={{ color: 'var(--text-primary)' }}>{i.name}</td>
                    <td className="px-3 py-2 capitalize" style={{ color: 'var(--text-secondary)' }}>{i.category}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{i.unit}</td>
                    <td className="px-3 py-2 font-bold" style={{ color: i.quantity <= i.min_quantity ? '#dc2626' : 'var(--text-primary)' }}>{i.quantity}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{i.min_quantity}</td>
                    <td className="px-3 py-2 font-bold" style={{ color: 'var(--accent)' }}>{i.cost_per_unit>0?fmt(i.cost_per_unit):'—'}</td>
                  </tr>
                ))}
                {exportInventory.length === 0 && !invFetching && <tr><td colSpan={6} className="px-3 py-8 text-center" style={{ color: 'var(--text-tertiary)' }}>No inventory items</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

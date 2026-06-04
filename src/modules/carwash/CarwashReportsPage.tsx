// [carwash] [all tenants]
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Users, PhoneCall, Star, Download, FileSpreadsheet, Filter } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { sendWhatsApp } from '@/lib/whatsapp';
import {
  getMonthlyRevenue, getPopularServices, getLapsedCustomers, getStaffPerformance,
  getStaffWeeklyPerformance, getTodayStats, listTopLoyaltyCustomers, getAttendanceSummaryForMonth,
  getAllJobsForExport, getCustomersWithJobStats, listInventoryForExport,
  listAllServices, listAllCarwashStaff,
} from '@/lib/db/carwash';
import { useNavigate } from 'react-router-dom';

type PageTab = 'dashboard' | 'export';
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

  const { data: topLoyalty = [] } = useQuery({
    queryKey: ['carwash-loyalty-top', tenantId],
    queryFn: () => listTopLoyaltyCustomers(tenantId),
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
        <button onClick={() => setPageTab('export')}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: pageTab === 'export' ? 'var(--accent)' : 'transparent', color: pageTab === 'export' ? '#111' : 'var(--text-secondary)' }}>
          <FileSpreadsheet className="h-4 w-4" /> Export Data
        </button>
      </div>

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

      {/* Loyalty top customers */}
      {topLoyalty.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Star className="h-4 w-4" style={{ color: '#f59e0b' }} />
            <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Top Loyalty Customers</h2>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#fef3c7', color: '#92400e' }}>
              1 pt = ₹1 (earn 1pt per ₹10)
            </span>
          </div>
          <div className="space-y-2">
            {topLoyalty.slice(0, 10).map((c, i) => (
              <div key={c.id} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--surface-border)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold w-5" style={{ color: 'var(--text-tertiary)' }}>#{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{c.customer_name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{c.reg_number ?? c.customer_phone}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold" style={{ color: '#d97706' }}>⭐ {c.available_points} pts</p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{c.total_points} earned total</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
            <button onClick={() => navigate('/carwash/attendance')}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg btn-secondary">
              Manage Attendance
            </button>
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

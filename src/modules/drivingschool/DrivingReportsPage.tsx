// [drivingschool] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/app/store/app.store';
import { listDSStudents, listDSSessions, listDSPayments } from '@/lib/db/drivingschool';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function DrivingReportsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');

  const { data: students = [] } = useQuery({ queryKey: ['ds-students-all', tenantId], queryFn: () => listDSStudents(tenantId), enabled: !!tenantId });
  const { data: sessions = [] } = useQuery({ queryKey: ['ds-sessions-all', tenantId], queryFn: () => listDSSessions(tenantId), enabled: !!tenantId });
  const { data: payments = [] } = useQuery({ queryKey: ['ds-payments-all', tenantId], queryFn: () => listDSPayments(tenantId), enabled: !!tenantId });

  // Monthly revenue
  const monthlyRevenue: Record<string,number> = {};
  payments.forEach(p => {
    const m = p.date.slice(0,7);
    monthlyRevenue[m] = (monthlyRevenue[m]??0) + p.amount;
  });
  const months = Object.keys(monthlyRevenue).sort().reverse().slice(0,6);

  // Monthly sessions
  const monthlySessions: Record<string,number> = {};
  sessions.forEach(s => {
    const m = s.session_date.slice(0,7);
    monthlySessions[m] = (monthlySessions[m]??0) + 1;
  });

  // Pass rates
  const llTotal = students.filter(s => !!s.ll_test_date).length;
  const llPassed = students.filter(s => s.ll_passed).length;
  const dlTotal = students.filter(s => !!s.dl_test_date).length;
  const dlPassed = students.filter(s => s.dl_passed).length;

  // Student progress
  const totalRevenue = payments.reduce((s,p) => s + p.amount, 0);
  const pendingFees = students.reduce((s,st) => s + Math.max(0, st.fees_total - st.fees_paid), 0);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Reports</h1>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: fmt(totalRevenue), color: '#16a34a' },
          { label: 'Pending Fees', value: fmt(pendingFees), color: '#d97706' },
          { label: 'Total Students', value: students.length, color: '#2563eb' },
          { label: 'Total Sessions', value: sessions.length, color: '#7c3aed' },
        ].map(c => (
          <div key={c.label} className="rounded-2xl p-4 border" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{c.label}</p>
            <p className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Pass rates */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
          <h2 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>LL Pass Rate</h2>
          <p className="text-3xl font-bold text-green-600">{llTotal ? Math.round((llPassed/llTotal)*100) : 0}%</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{llPassed} passed of {llTotal} tested</p>
          <div className="mt-3 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-green-500" style={{ width: `${llTotal ? (llPassed/llTotal)*100 : 0}%` }} /></div>
        </div>
        <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
          <h2 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>DL Pass Rate</h2>
          <p className="text-3xl font-bold text-blue-600">{dlTotal ? Math.round((dlPassed/dlTotal)*100) : 0}%</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{dlPassed} passed of {dlTotal} tested</p>
          <div className="mt-3 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-blue-500" style={{ width: `${dlTotal ? (dlPassed/dlTotal)*100 : 0}%` }} /></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly revenue */}
        <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
          <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Monthly Revenue</h2>
          {months.length === 0 ? <p className="text-sm text-center py-4" style={{ color: 'var(--text-tertiary)' }}>No data yet</p> : (
            <div className="space-y-3">
              {months.map(m => {
                const rev = monthlyRevenue[m];
                const maxRev = Math.max(...months.map(mo => monthlyRevenue[mo]));
                const pct = maxRev ? (rev / maxRev) * 100 : 0;
                return (
                  <div key={m}>
                    <div className="flex justify-between text-sm mb-1">
                      <span style={{ color: 'var(--text-secondary)' }}>{new Date(m+'-01').toLocaleDateString('en-IN', {month:'short',year:'numeric'})}</span>
                      <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{fmt(rev)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full" style={{ width: `${pct}%`, background: '#2563eb' }} /></div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Monthly sessions */}
        <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
          <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Monthly Sessions</h2>
          {Object.keys(monthlySessions).length === 0 ? <p className="text-sm text-center py-4" style={{ color: 'var(--text-tertiary)' }}>No data yet</p> : (
            <div className="space-y-3">
              {Object.keys(monthlySessions).sort().reverse().slice(0,6).map(m => {
                const cnt = monthlySessions[m];
                const maxCnt = Math.max(...Object.values(monthlySessions));
                const pct = maxCnt ? (cnt / maxCnt) * 100 : 0;
                return (
                  <div key={m}>
                    <div className="flex justify-between text-sm mb-1">
                      <span style={{ color: 'var(--text-secondary)' }}>{new Date(m+'-01').toLocaleDateString('en-IN', {month:'short',year:'numeric'})}</span>
                      <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{cnt}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full" style={{ width: `${pct}%`, background: '#7c3aed' }} /></div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* License type breakdown */}
        <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
          <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Students by License Type</h2>
          {students.length === 0 ? <p className="text-sm text-center py-4" style={{ color: 'var(--text-tertiary)' }}>No data</p> : (
            <div className="space-y-3">
              {Object.entries(students.reduce((acc, s) => { acc[s.license_type] = (acc[s.license_type]??0)+1; return acc; }, {} as Record<string,number>))
                .sort((a,b)=>b[1]-a[1])
                .map(([type, cnt]) => (
                  <div key={type} className="flex justify-between text-sm">
                    <span style={{ color: 'var(--text-secondary)' }}>{type}</span>
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{cnt}</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Fees summary */}
        <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
          <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Student Progress</h2>
          <div className="space-y-3 text-sm">
            {[
              { label: 'Active', count: students.filter(s=>s.status==='active').length, color: '#16a34a' },
              { label: 'Completed', count: students.filter(s=>s.status==='completed').length, color: '#2563eb' },
              { label: 'LL Passed', count: students.filter(s=>s.ll_passed).length, color: '#059669' },
              { label: 'DL Obtained', count: students.filter(s=>s.dl_passed).length, color: '#7c3aed' },
            ].map(r => (
              <div key={r.label} className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>{r.label}</span>
                <span className="font-semibold" style={{ color: r.color }}>{r.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

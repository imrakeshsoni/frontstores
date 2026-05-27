// [clinic] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/app/store/app.store';
import { getMonthlyRevenueReport, getDoctorWiseReport, getCommonDiagnoses } from '@/lib/db/clinic';

export function ClinicReportsPage() {
  const { config } = useAppStore();
  const tid = config?.tenant_id ?? '';
  const today = new Date().toISOString().slice(0, 10);

  const { data: monthly = [] } = useQuery({
    queryKey: ['clinic-revenue-monthly', tid],
    queryFn: () => getMonthlyRevenueReport(tid, 6),
  });
  const { data: doctorWise = [] } = useQuery({
    queryKey: ['clinic-doctor-wise', tid, today],
    queryFn: () => getDoctorWiseReport(tid, today),
  });
  const { data: diagnoses = [] } = useQuery({
    queryKey: ['clinic-diagnoses', tid],
    queryFn: () => getCommonDiagnoses(tid),
  });

  const maxRevenue = Math.max(...monthly.map(m => m.revenue), 1);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Reports</h1>

      {/* Monthly Revenue */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Monthly Revenue (last 6 months)</h2>
        {monthly.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No data yet</p>
        ) : (
          <div className="space-y-3">
            {[...monthly].reverse().map(m => (
              <div key={m.month}>
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: 'var(--text-secondary)' }}>{m.month}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                    ₹{m.revenue.toLocaleString('en-IN')} · {m.bills} bill{m.bills !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${(m.revenue / maxRevenue) * 100}%`,
                    background: 'var(--accent)',
                  }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Doctor-wise (this month) */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Doctor-wise (this month)</h2>
          {doctorWise.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No billing data this month</p>
          ) : (
            <div className="space-y-2">
              {doctorWise.map((d, i) => (
                <div key={d.doctor_name} className="flex items-center justify-between py-2 border-b last:border-b-0"
                  style={{ borderColor: 'var(--surface-border)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: 'var(--text-tertiary)' }}>#{i + 1}</span>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Dr. {d.doctor_name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{d.patients} patients</p>
                    </div>
                  </div>
                  <p className="text-sm font-bold" style={{ color: '#059669' }}>₹{d.revenue.toLocaleString('en-IN')}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Common Diagnoses */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Common Diagnoses</h2>
          {diagnoses.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No diagnosis data yet</p>
          ) : (
            <div className="space-y-2">
              {diagnoses.map((d, i) => {
                const maxCount = diagnoses[0].count;
                return (
                  <div key={d.diagnosis}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span style={{ color: 'var(--text-primary)' }}>{i + 1}. {d.diagnosis}</span>
                      <span style={{ color: 'var(--text-tertiary)' }}>{d.count} cases</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                      <div className="h-full rounded-full" style={{
                        width: `${(d.count / maxCount) * 100}%`,
                        background: '#0891b2',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>All-time Summary</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>
              {monthly.reduce((s, m) => s + m.bills, 0)}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Total Bills</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold" style={{ color: '#059669' }}>
              ₹{monthly.reduce((s, m) => s + m.revenue, 0).toLocaleString('en-IN')}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Total Revenue (6m)</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold" style={{ color: '#0891b2' }}>
              {doctorWise.reduce((s, d) => s + d.patients, 0)}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Patients This Month</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold" style={{ color: '#ca8a04' }}>
              {diagnoses.length}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Unique Diagnoses</p>
          </div>
        </div>
      </div>
    </div>
  );
}

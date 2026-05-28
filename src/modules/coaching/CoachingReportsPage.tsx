// [coaching] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/app/store/app.store';
import { getCoachingStats, listFees, getDueStudents } from '@/lib/db/coaching';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function CoachingReportsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const thisMonth = new Date().toISOString().slice(0, 7);

  const { data: stats } = useQuery({ queryKey: ['coaching-stats', tenantId], queryFn: () => getCoachingStats(tenantId), enabled: !!tenantId });
  const { data: monthFees = [] } = useQuery({ queryKey: ['coaching-fees', tenantId, thisMonth], queryFn: () => listFees(tenantId, thisMonth), enabled: !!tenantId });
  const { data: dueStudents = [] } = useQuery({ queryKey: ['coaching-due-students', tenantId], queryFn: () => getDueStudents(tenantId), enabled: !!tenantId });

  const paymentMethodTotals = monthFees.reduce<Record<string, number>>((acc, f) => {
    acc[f.payment_method] = (acc[f.payment_method] ?? 0) + f.amount;
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Reports</h1>

      {/* Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Students', value: stats?.activeStudents ?? 0, color: '#2563eb' },
          { label: 'Active Batches', value: stats?.activeBatches ?? 0, color: '#16a34a' },
          { label: 'Active Teachers', value: stats?.activeTeachers ?? 0, color: '#7c3aed' },
          { label: 'Fee This Month', value: fmt(stats?.feeCollectedThisMonth ?? 0), color: '#d97706' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <p className="text-xs text-slate-500">{c.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Fee breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 mb-4">This Month's Fee Collection</h2>
          {Object.keys(paymentMethodTotals).length === 0 ? (
            <p className="text-slate-400 text-sm">No fees collected this month</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(paymentMethodTotals).map(([method, total]) => (
                <div key={method} className="flex justify-between items-center">
                  <span className="text-sm text-slate-700 capitalize">{method.replace('_', ' ')}</span>
                  <span className="font-semibold text-slate-900">{fmt(total)}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                <span className="text-sm font-medium text-slate-700">Total</span>
                <span className="font-bold text-green-600">{fmt(monthFees.reduce((s, f) => s + f.amount, 0))}</span>
              </div>
            </div>
          )}
        </div>

        {/* Dues */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Outstanding Dues</h2>
          {dueStudents.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">No outstanding dues 🎉</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {dueStudents.map(s => (
                <div key={s.id} className="flex justify-between items-center py-1.5 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{s.name}</p>
                    <p className="text-xs text-slate-400">{s.phone ?? 'No phone'}</p>
                  </div>
                  <span className="text-sm font-semibold text-red-600">{fmt(s.balance_due)}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-slate-100 flex justify-between">
                <span className="text-sm font-medium text-slate-700">Total Dues</span>
                <span className="font-bold text-red-600">{fmt(dueStudents.reduce((s, d) => s + d.balance_due, 0))}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Today's attendance summary */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Today's Attendance Summary</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 rounded-xl bg-green-50">
            <p className="text-2xl font-bold text-green-700">{stats?.todayPresent ?? 0}</p>
            <p className="text-xs text-green-600 mt-0.5">Present</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-red-50">
            <p className="text-2xl font-bold text-red-600">{stats?.todayAbsent ?? 0}</p>
            <p className="text-xs text-red-500 mt-0.5">Absent</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-slate-50">
            <p className="text-2xl font-bold text-slate-600">{(stats?.todayPresent ?? 0) + (stats?.todayAbsent ?? 0)}</p>
            <p className="text-xs text-slate-500 mt-0.5">Total Marked</p>
          </div>
        </div>
      </div>
    </div>
  );
}

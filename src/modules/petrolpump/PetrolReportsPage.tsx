// [petrolpump] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/app/store/app.store';
import { listShifts } from '@/lib/db/petrolpump';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function PetrolReportsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');

  const { data: shifts = [] } = useQuery({
    queryKey: ['pp-shifts-report', tenantId],
    queryFn: () => listShifts(tenantId, 60),
    enabled: !!tenantId,
  });

  const closedShifts = shifts.filter(s => s.status === 'closed');

  const totalPetrol = closedShifts.reduce((s, r) => s + r.petrol_sold, 0);
  const totalDiesel = closedShifts.reduce((s, r) => s + r.diesel_sold, 0);
  const totalCash = closedShifts.reduce((s, r) => s + r.cash_collected, 0);
  const totalCard = closedShifts.reduce((s, r) => s + r.card_collected, 0);
  const totalUpi = closedShifts.reduce((s, r) => s + r.upi_collected, 0);
  const totalCredit = closedShifts.reduce((s, r) => s + r.credit_sales, 0);
  const totalRevenue = totalCash + totalCard + totalUpi + totalCredit;

  // Group by date
  const byDate: Record<string, typeof closedShifts> = {};
  for (const s of closedShifts) {
    byDate[s.shift_date] = [...(byDate[s.shift_date] ?? []), s];
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Petrol Pump Reports</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Petrol', value: `${totalPetrol.toFixed(1)} L`, color: '#d97706', bg: '#fef3c7' },
          { label: 'Total Diesel', value: `${totalDiesel.toFixed(1)} L`, color: '#0891b2', bg: '#cffafe' },
          { label: 'Total Revenue', value: fmt(totalRevenue), color: '#16a34a', bg: '#dcfce7' },
          { label: 'Credit Sales', value: fmt(totalCredit), color: '#dc2626', bg: '#fee2e2' },
        ].map(c => (
          <div key={c.label} className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
            <p className="text-xs font-medium text-slate-500 mb-1">{c.label}</p>
            <p className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Collection breakdown */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Collection Breakdown</h2>
        <div className="grid grid-cols-3 gap-4">
          {[['Cash', fmt(totalCash)], ['Card', fmt(totalCard)], ['UPI', fmt(totalUpi)]].map(([label, val]) => (
            <div key={label} className="text-center p-3 rounded-xl bg-slate-50">
              <p className="text-xs text-slate-500 mb-1">{label}</p>
              <p className="text-lg font-bold text-slate-800">{val}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Daily breakdown */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Daily Breakdown</h2>
        {Object.keys(byDate).length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-6">No closed shifts yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Shifts</th>
                  <th className="pb-2 font-medium">Petrol (L)</th>
                  <th className="pb-2 font-medium">Diesel (L)</th>
                  <th className="pb-2 font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(byDate).sort(([a], [b]) => b.localeCompare(a)).map(([date, dayShifts]) => {
                  const petrol = dayShifts.reduce((s, r) => s + r.petrol_sold, 0);
                  const diesel = dayShifts.reduce((s, r) => s + r.diesel_sold, 0);
                  const rev = dayShifts.reduce((s, r) => s + r.cash_collected + r.card_collected + r.upi_collected + r.credit_sales, 0);
                  return (
                    <tr key={date} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-2 font-medium">{date}</td>
                      <td className="py-2 text-slate-600">{dayShifts.length}</td>
                      <td className="py-2">{petrol.toFixed(1)}</td>
                      <td className="py-2">{diesel.toFixed(1)}</td>
                      <td className="py-2 font-semibold text-green-700">{fmt(rev)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

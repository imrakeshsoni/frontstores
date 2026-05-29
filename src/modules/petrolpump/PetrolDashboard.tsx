// [petrolpump] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Fuel, CreditCard, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getPPStats, getCurrentFuelRates } from '@/lib/db/petrolpump';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function PetrolDashboard() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const shopName = useAppStore(s => s.config?.shop_name ?? 'Petrol Pump');
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['pp-stats', tenantId],
    queryFn: () => getPPStats(tenantId),
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  const { data: rates = [] } = useQuery({
    queryKey: ['pp-fuel-rates', tenantId],
    queryFn: () => getCurrentFuelRates(tenantId),
    enabled: !!tenantId,
  });

  const cards = [
    { label: "Today's Petrol", value: `${(stats?.todayLitresPetrol ?? 0).toFixed(1)} L`, icon: Fuel, color: '#d97706', bg: '#fef3c7', path: '/petrolpump/shifts' },
    { label: "Today's Diesel", value: `${(stats?.todayLitresDiesel ?? 0).toFixed(1)} L`, icon: Fuel, color: '#0891b2', bg: '#cffafe', path: '/petrolpump/shifts' },
    { label: "Today's Revenue", value: fmt(stats?.todayRevenue ?? 0), icon: TrendingUp, color: '#16a34a', bg: '#dcfce7', path: '/petrolpump/reports' },
    { label: 'Credit Outstanding', value: fmt(stats?.totalCreditOutstanding ?? 0), icon: CreditCard, color: '#dc2626', bg: '#fee2e2', path: '/petrolpump/credit' },
  ];

  const petrolRate = rates.find(r => r.fuel_type === 'petrol');
  const dieselRate = rates.find(r => r.fuel_type === 'diesel');

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{shopName}</h1>
        <p className="text-slate-500 text-sm mt-0.5">Petrol Pump Management</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <button key={c.label} onClick={() => navigate(c.path)} className="text-left p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-500">{c.label}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: c.bg }}>
                <c.icon className="h-4 w-4" style={{ color: c.color }} />
              </span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{c.value}</p>
          </button>
        ))}
      </div>

      {/* Current shift status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <h2 className="font-semibold text-slate-900">Current Shift</h2>
          </div>
          {stats?.openShiftId ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm text-green-700 font-medium">Shift is open</span>
              </div>
              <button onClick={() => navigate('/petrolpump/shifts')} className="mt-3 w-full py-2 rounded-xl text-sm font-medium text-amber-600 hover:bg-amber-50 transition-colors">
                Close Shift →
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-slate-500">No shift is currently open.</p>
              <button onClick={() => navigate('/petrolpump/shifts')} className="mt-3 w-full py-2 rounded-xl text-sm font-medium text-green-600 hover:bg-green-50 transition-colors">
                Open New Shift →
              </button>
            </div>
          )}
        </div>

        {/* Fuel rates */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Current Fuel Rates</h2>
            <button onClick={() => navigate('/petrolpump/rates')} className="text-xs text-amber-600 hover:underline">Update →</button>
          </div>
          <div className="space-y-3">
            {petrolRate ? (
              <div className="flex justify-between items-center p-3 rounded-xl bg-amber-50">
                <span className="text-sm font-medium text-amber-800">Petrol</span>
                <span className="text-lg font-bold text-amber-700">{fmt(petrolRate.rate)}/L</span>
              </div>
            ) : (
              <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50">
                <span className="text-sm text-slate-500">Petrol</span>
                <span className="text-sm text-slate-400">Not set</span>
              </div>
            )}
            {dieselRate ? (
              <div className="flex justify-between items-center p-3 rounded-xl bg-cyan-50">
                <span className="text-sm font-medium text-cyan-800">Diesel</span>
                <span className="text-lg font-bold text-cyan-700">{fmt(dieselRate.rate)}/L</span>
              </div>
            ) : (
              <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50">
                <span className="text-sm text-slate-500">Diesel</span>
                <span className="text-sm text-slate-400">Not set</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Open Shift', icon: '⛽', path: '/petrolpump/shifts' },
            { label: 'Update Rates', icon: '💰', path: '/petrolpump/rates' },
            { label: 'Credit Accounts', icon: '📋', path: '/petrolpump/credit' },
            { label: 'Reports', icon: '📊', path: '/petrolpump/reports' },
          ].map(a => (
            <button key={a.label} onClick={() => navigate(a.path)} className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
              <span className="text-2xl">{a.icon}</span>
              <span className="text-xs font-medium text-slate-700">{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

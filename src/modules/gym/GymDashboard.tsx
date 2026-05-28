// [gym] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Users, AlertTriangle, CheckCircle, TrendingUp, Dumbbell, Clock } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getGymStats, getExpiringMembers, getTodayCheckins } from '@/lib/db/gym';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }
function timeStr(iso: string) { return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); }

export function GymDashboard() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const shopName = useAppStore(s => s.config?.shop_name ?? 'Gym');
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['gym-stats', tenantId],
    queryFn: () => getGymStats(tenantId),
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  const { data: expiring = [] } = useQuery({
    queryKey: ['gym-expiring', tenantId],
    queryFn: () => getExpiringMembers(tenantId, 7),
    enabled: !!tenantId,
  });

  const { data: checkins = [] } = useQuery({
    queryKey: ['gym-checkins-today', tenantId],
    queryFn: () => getTodayCheckins(tenantId),
    enabled: !!tenantId,
    refetchInterval: 15000,
  });

  const cards = [
    { label: 'Total Members', value: stats?.totalMembers ?? 0, icon: Users, color: '#2563eb', bg: '#dbeafe', path: '/gym/members' },
    { label: 'Today\'s Check-ins', value: stats?.todayCheckins ?? 0, icon: CheckCircle, color: '#16a34a', bg: '#dcfce7', path: '/gym/checkin' },
    { label: 'Expiring in 7 Days', value: stats?.expiringIn7Days ?? 0, icon: AlertTriangle, color: '#d97706', bg: '#fef3c7', path: '/gym/renewals' },
    { label: 'Today\'s Revenue', value: fmt(stats?.todayRevenue ?? 0), icon: TrendingUp, color: '#7c3aed', bg: '#ede9fe', path: '/gym/renewals' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{shopName}</h1>
        <p className="text-slate-500 text-sm mt-0.5">Gym & Fitness Center</p>
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

      {/* Expiring memberships */}
      {expiring.length > 0 && (
        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <h2 className="font-semibold text-orange-800">Memberships Expiring Soon</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {expiring.map(m => (
              <div key={m.id} className="flex justify-between items-center text-sm bg-white rounded-xl px-3 py-2">
                <div>
                  <p className="font-medium text-slate-800">{m.name}</p>
                  <p className="text-xs text-slate-400">{m.plan_name}</p>
                </div>
                <span className="text-xs font-semibold text-orange-600">{m.membership_end ? new Date(m.membership_end).toLocaleDateString('en-IN') : '—'}</span>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/gym/renewals')} className="mt-3 text-sm font-medium text-orange-700 hover:underline">View all renewals →</button>
        </div>
      )}

      {/* Today's check-ins */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Dumbbell className="h-5 w-5 text-blue-600" />
              <h2 className="font-semibold text-slate-900">Today's Check-ins</h2>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{checkins.length}</span>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {checkins.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">No check-ins yet today</p>
            ) : checkins.slice(0, 8).map(c => (
              <div key={c.id} className="flex justify-between items-center text-sm">
                <span className="font-medium text-slate-800">{c.member_name}</span>
                <span className="flex items-center gap-1 text-xs text-slate-400"><Clock className="h-3 w-3" />{timeStr(c.checked_in_at)}</span>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/gym/checkin')} className="mt-3 w-full py-2 rounded-xl text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors">Check In Member →</button>
        </div>

        {/* Expired members */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <h2 className="font-semibold text-slate-900">Expired Memberships</h2>
            {(stats?.expiredCount ?? 0) > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">{stats?.expiredCount}</span>}
          </div>
          {(stats?.expiredCount ?? 0) === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">All memberships are active 🎉</p>
          ) : (
            <p className="text-slate-600 text-sm">{stats?.expiredCount} members have expired memberships. Reach out for renewal.</p>
          )}
          <button onClick={() => navigate('/gym/renewals')} className="mt-3 w-full py-2 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">Manage Renewals →</button>
        </div>
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Add Member', icon: '💪', path: '/gym/members' },
            { label: 'Check In', icon: '✅', path: '/gym/checkin' },
            { label: 'Renew Membership', icon: '🔄', path: '/gym/renewals' },
            { label: 'Manage Plans', icon: '📋', path: '/gym/plans' },
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

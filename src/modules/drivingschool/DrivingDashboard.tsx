// [drivingschool] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Users, Calendar, Wallet, Car, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getDSStats, listDSSessions, listDSVehicles } from '@/lib/db/drivingschool';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function DrivingDashboard() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const shopName = useAppStore(s => s.config?.shop_name ?? 'Driving School');
  const navigate = useNavigate();

  const today = new Date().toISOString().slice(0, 10);

  const { data: stats } = useQuery({
    queryKey: ['ds-stats', tenantId],
    queryFn: () => getDSStats(tenantId),
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  const { data: todaySessions = [] } = useQuery({
    queryKey: ['ds-sessions-today', tenantId, today],
    queryFn: () => listDSSessions(tenantId, { date: today }),
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['ds-vehicles', tenantId],
    queryFn: () => listDSVehicles(tenantId),
    enabled: !!tenantId,
  });

  const expiringVehicles = vehicles.filter(v => {
    const soon = new Date(Date.now() + 30 * 86400000).toISOString().slice(0,10);
    return (v.fitness_expiry && v.fitness_expiry <= soon) || (v.insurance_expiry && v.insurance_expiry <= soon);
  });

  const cards = [
    { label: 'Active Students', value: stats?.activeStudents ?? 0, icon: Users, color: '#2563eb', bg: '#dbeafe', path: '/drivingschool/students' },
    { label: "Sessions Today", value: stats?.sessionsToday ?? 0, icon: Calendar, color: '#16a34a', bg: '#dcfce7', path: '/drivingschool/sessions' },
    { label: 'Pending Fees', value: fmt(stats?.pendingFeesTotal ?? 0), icon: Wallet, color: '#d97706', bg: '#fef3c7', path: '/drivingschool/students' },
    { label: 'Active Vehicles', value: stats?.activeVehicles ?? 0, icon: Car, color: '#7c3aed', bg: '#ede9fe', path: '/drivingschool/vehicles' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{shopName}</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Driving School Management</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <button key={c.label} onClick={() => navigate(c.path)} className="text-left p-4 rounded-2xl border shadow-sm hover:shadow-md transition-all" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{c.label}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: c.bg }}>
                <c.icon className="h-4 w-4" style={{ color: c.color }} />
              </span>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{c.value}</p>
          </button>
        ))}
      </div>

      {/* LL / DL passes this month */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>LL Passes This Month</p>
          </div>
          <p className="text-3xl font-bold text-green-600">{stats?.llPassedThisMonth ?? 0}</p>
        </div>
        <div className="rounded-2xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-blue-600" />
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>DL Passes This Month</p>
          </div>
          <p className="text-3xl font-bold text-blue-600">{stats?.dlPassedThisMonth ?? 0}</p>
        </div>
      </div>

      {/* Vehicle expiry alerts */}
      {expiringVehicles.length > 0 && (
        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <h2 className="font-semibold text-orange-800">Vehicle Documents Expiring Soon</h2>
          </div>
          <div className="space-y-2">
            {expiringVehicles.map(v => (
              <div key={v.id} className="flex justify-between items-center text-sm bg-white rounded-xl px-3 py-2">
                <div>
                  <p className="font-medium text-slate-800">{v.reg_no}</p>
                  <p className="text-xs text-slate-400">{v.brand} {v.model}</p>
                </div>
                <div className="text-right text-xs">
                  {v.fitness_expiry && <p className="text-orange-600">Fitness: {v.fitness_expiry}</p>}
                  {v.insurance_expiry && <p className="text-orange-600">Insurance: {v.insurance_expiry}</p>}
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/drivingschool/vehicles')} className="mt-3 text-sm font-medium text-orange-700 hover:underline">Manage vehicles →</button>
        </div>
      )}

      {/* Today's sessions */}
      <div className="rounded-2xl border p-5 shadow-sm" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Today's Sessions</h2>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{todaySessions.length}</span>
        </div>
        {todaySessions.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: 'var(--text-tertiary)' }}>No sessions scheduled for today</p>
        ) : (
          <div className="space-y-2">
            {todaySessions.map(s => (
              <div key={s.id} className="flex items-center justify-between text-sm rounded-xl px-3 py-2" style={{ background: 'var(--surface-2)' }}>
                <div>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{s.student_name ?? s.student_id}</p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{s.vehicle_reg ? `${s.vehicle_reg} · ` : ''}{s.instructor_name ?? ''}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{s.start_time || '—'}</p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{s.duration_mins}min</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <button onClick={() => navigate('/drivingschool/sessions')} className="mt-3 w-full py-2 rounded-xl text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors">View All Sessions →</button>
      </div>

      {/* Quick actions */}
      <div className="rounded-2xl border p-5 shadow-sm" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Enroll Student', icon: '🎓', path: '/drivingschool/students/new' },
            { label: 'Schedule Session', icon: '📅', path: '/drivingschool/sessions' },
            { label: 'Add Vehicle', icon: '🚗', path: '/drivingschool/vehicles' },
            { label: 'Reports', icon: '📊', path: '/drivingschool/reports' },
          ].map(a => (
            <button key={a.label} onClick={() => navigate(a.path)} className="flex flex-col items-center gap-2 p-4 rounded-xl border hover:bg-slate-50 transition-colors" style={{ borderColor: 'var(--surface-border)' }}>
              <span className="text-2xl">{a.icon}</span>
              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

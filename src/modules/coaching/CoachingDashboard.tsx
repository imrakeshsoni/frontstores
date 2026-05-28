// [coaching] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Users, BookOpen, GraduationCap, IndianRupee, UserCheck, AlertCircle, TrendingUp, Calendar } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getCoachingStats, getDueStudents } from '@/lib/db/coaching';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function CoachingDashboard() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const shopName = useAppStore(s => s.config?.shop_name ?? 'Coaching');
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['coaching-stats', tenantId],
    queryFn: () => getCoachingStats(tenantId),
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  const { data: dueStudents = [] } = useQuery({
    queryKey: ['coaching-due-students', tenantId],
    queryFn: () => getDueStudents(tenantId),
    enabled: !!tenantId,
  });

  const cards = [
    { label: 'Total Students', value: stats?.totalStudents ?? 0, icon: Users, color: '#2563eb', bg: '#dbeafe', onClick: () => navigate('/coaching/students') },
    { label: 'Active Batches', value: stats?.activeBatches ?? 0, icon: BookOpen, color: '#16a34a', bg: '#dcfce7', onClick: () => navigate('/coaching/batches') },
    { label: 'Teachers', value: stats?.activeTeachers ?? 0, icon: GraduationCap, color: '#7c3aed', bg: '#ede9fe', onClick: () => navigate('/coaching/teachers') },
    { label: 'Fee This Month', value: fmt(stats?.feeCollectedThisMonth ?? 0), icon: IndianRupee, color: '#d97706', bg: '#fef3c7', onClick: () => navigate('/coaching/fees') },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{shopName}</h1>
        <p className="text-slate-500 text-sm mt-0.5">Coaching Institute Dashboard</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <button key={c.label} onClick={c.onClick} className="text-left p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all">
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

      {/* Today's attendance + dues row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Today's Attendance */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <UserCheck className="h-5 w-5 text-green-600" />
            <h2 className="font-semibold text-slate-900">Today's Attendance</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-green-50 text-center">
              <p className="text-2xl font-bold text-green-700">{stats?.todayPresent ?? 0}</p>
              <p className="text-xs text-green-600 mt-0.5">Present</p>
            </div>
            <div className="p-3 rounded-xl bg-red-50 text-center">
              <p className="text-2xl font-bold text-red-600">{stats?.todayAbsent ?? 0}</p>
              <p className="text-xs text-red-500 mt-0.5">Absent</p>
            </div>
          </div>
          <button onClick={() => navigate('/coaching/attendance')} className="mt-4 w-full py-2 rounded-xl text-sm font-medium text-indigo-600 hover:bg-indigo-50 transition-colors">
            Mark Attendance →
          </button>
        </div>

        {/* Fee Dues */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              <h2 className="font-semibold text-slate-900">Fee Dues</h2>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
              {stats?.studentsWithDues ?? 0} students
            </span>
          </div>
          <div className="space-y-2 max-h-36 overflow-y-auto">
            {dueStudents.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">No outstanding dues 🎉</p>
            ) : dueStudents.slice(0, 5).map(s => (
              <div key={s.id} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-800">{s.name}</p>
                  <p className="text-xs text-slate-400">{s.phone ?? 'No phone'}</p>
                </div>
                <span className="text-sm font-semibold text-red-600">{fmt(s.balance_due)}</span>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/coaching/fees')} className="mt-3 w-full py-2 rounded-xl text-sm font-medium text-orange-600 hover:bg-orange-50 transition-colors">
            Collect Fees →
          </button>
        </div>
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Add Student', icon: '🎓', path: '/coaching/students' },
            { label: 'Mark Attendance', icon: '✅', path: '/coaching/attendance' },
            { label: 'Collect Fee', icon: '💰', path: '/coaching/fees' },
            { label: 'Schedule Exam', icon: '📝', path: '/coaching/exams' },
          ].map(a => (
            <button key={a.label} onClick={() => navigate(a.path)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
              <span className="text-2xl">{a.icon}</span>
              <span className="text-xs font-medium text-slate-700">{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// [drivingschool] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { listDSSessions, saveDSSession, deleteDSSession, listDSStudents, listDSVehicles, listDSInstructors, type DSSession } from '@/lib/db/drivingschool';

const STATUS_COLOR: Record<string, { color: string; bg: string }> = {
  scheduled:  { color: '#2563eb', bg: '#dbeafe' },
  completed:  { color: '#16a34a', bg: '#dcfce7' },
  cancelled:  { color: '#dc2626', bg: '#fee2e2' },
};

const EMPTY = {
  student_id: '', vehicle_id: '', instructor_id: '',
  session_date: new Date().toISOString().slice(0,10),
  start_time: '', duration_mins: 60, status: 'scheduled', notes: '',
};

export function SessionsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().slice(0,10));
  const [form, setForm] = useState<typeof EMPTY | null>(null);

  const { data: sessions = [] } = useQuery({
    queryKey: ['ds-sessions', tenantId, dateFilter],
    queryFn: () => listDSSessions(tenantId, { date: dateFilter }),
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  const { data: students = [] } = useQuery({ queryKey: ['ds-students', tenantId], queryFn: () => listDSStudents(tenantId), enabled: !!tenantId });
  const { data: vehicles = [] } = useQuery({ queryKey: ['ds-vehicles', tenantId], queryFn: () => listDSVehicles(tenantId), enabled: !!tenantId });
  const { data: instructors = [] } = useQuery({ queryKey: ['ds-instructors', tenantId], queryFn: () => listDSInstructors(tenantId), enabled: !!tenantId });

  const save = useMutation({
    mutationFn: (data: typeof EMPTY) => saveDSSession(tenantId, data as DSSession),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ds-sessions'] }); qc.invalidateQueries({ queryKey: ['ds-stats'] }); setForm(null); toast.success('Session saved'); },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteDSSession(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ds-sessions'] }); qc.invalidateQueries({ queryKey: ['ds-stats'] }); },
  });

  const up = (k: keyof typeof EMPTY, v: unknown) => setForm(f => f ? { ...f, [k]: v } : f);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Sessions</h1>
        <button onClick={() => setForm({ ...EMPTY })} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-medium" style={{ background: '#2563eb' }}>
          <Plus className="h-4 w-4" /> Schedule Session
        </button>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Date:</label>
        <input type="date" className="input" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
        <button onClick={() => setDateFilter(new Date().toISOString().slice(0,10))} className="text-sm text-blue-600 hover:underline">Today</button>
      </div>

      <div className="rounded-2xl border shadow-sm overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        {sessions.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--text-secondary)' }}>
            <p className="text-4xl mb-2">📅</p>
            <p className="font-medium">No sessions on {dateFilter}</p>
            <button onClick={() => setForm({ ...EMPTY, session_date: dateFilter })} className="mt-3 text-sm text-blue-600 hover:underline">Schedule one →</button>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--surface-border)' }}>
            {sessions.sort((a,b) => (a.start_time??'').localeCompare(b.start_time??'')).map(s => {
              const sc = STATUS_COLOR[s.status] ?? STATUS_COLOR['scheduled'];
              return (
                <div key={s.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="text-center w-14 flex-shrink-0">
                      <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{s.start_time || '—'}</p>
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{s.duration_mins}min</p>
                    </div>
                    <div>
                      <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{s.student_name ?? s.student_id}</p>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {s.vehicle_reg ? `${s.vehicle_reg} · ` : ''}
                        {s.instructor_name ?? ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize" style={{ color: sc.color, background: sc.bg }}>{s.status}</span>
                    <button onClick={() => del.mutate(s.id)} className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Schedule Session</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-1 text-slate-600">Student *</label>
                <select className="input w-full" value={form.student_id} onChange={e => up('student_id', e.target.value)}>
                  <option value="">Select student</option>
                  {students.filter(s => s.status === 'active').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-slate-600">Date</label>
                <input type="date" className="input w-full" value={form.session_date} onChange={e => up('session_date', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-slate-600">Start Time</label>
                <input type="time" className="input w-full" value={form.start_time} onChange={e => up('start_time', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-slate-600">Duration (min)</label>
                <input type="number" className="input w-full" value={form.duration_mins} onChange={e => up('duration_mins', parseInt(e.target.value)||60)} min="15" step="15" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-slate-600">Status</label>
                <select className="input w-full" value={form.status} onChange={e => up('status', e.target.value)}>
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-slate-600">Vehicle</label>
                <select className="input w-full" value={form.vehicle_id} onChange={e => up('vehicle_id', e.target.value)}>
                  <option value="">None</option>
                  {vehicles.filter(v => v.status === 'active').map(v => <option key={v.id} value={v.id}>{v.reg_no} ({v.brand})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-slate-600">Instructor</label>
                <select className="input w-full" value={form.instructor_id} onChange={e => up('instructor_id', e.target.value)}>
                  <option value="">None</option>
                  {instructors.filter(i => i.status === 'active').map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-1 text-slate-600">Notes</label>
                <input className="input w-full" value={form.notes} onChange={e => up('notes', e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setForm(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => save.mutate(form)} disabled={!form.student_id || save.isPending} className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50" style={{ background: '#2563eb' }}>
                {save.isPending ? 'Saving…' : 'Save Session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// [coaching] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listBatches, listStudents, getAttendance, saveAttendance } from '@/lib/db/coaching';

type Status = 'present' | 'absent' | 'late';

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string; icon: any }> = {
  present: { label: 'Present', color: '#16a34a', bg: '#dcfce7', icon: CheckCircle },
  absent:  { label: 'Absent',  color: '#dc2626', bg: '#fee2e2', icon: XCircle },
  late:    { label: 'Late',    color: '#d97706', bg: '#fef3c7', icon: Clock },
};

export function AttendancePage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [batchId, setBatchId] = useState('');
  const [attendance, setAttendance] = useState<Record<string, Status>>({});
  const [saved, setSaved] = useState(false);

  const { data: batches = [] } = useQuery({ queryKey: ['coaching-batches', tenantId], queryFn: () => listBatches(tenantId), enabled: !!tenantId });
  const { data: students = [] } = useQuery({ queryKey: ['coaching-students', tenantId, batchId], queryFn: () => listStudents(tenantId, batchId || undefined), enabled: !!tenantId });

  useQuery({
    queryKey: ['coaching-attendance', tenantId, batchId, date],
    queryFn: async () => {
      if (!batchId) return [];
      const recs = await getAttendance(tenantId, batchId, date);
      const map: Record<string, Status> = {};
      for (const r of recs) map[r.student_id] = r.status as Status;
      setAttendance(map);
      return recs;
    },
    enabled: !!tenantId && !!batchId,
  });

  const saveMut = useMutation({
    mutationFn: () => saveAttendance(tenantId, batchId, date, students.map(s => ({ student_id: s.id!, status: attendance[s.id!] ?? 'present' }))),
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2000); qc.invalidateQueries({ queryKey: ['coaching-stats'] }); },
  });

  const toggle = (studentId: string) => {
    setAttendance(prev => {
      const cur = prev[studentId] ?? 'present';
      const next: Status = cur === 'present' ? 'absent' : cur === 'absent' ? 'late' : 'present';
      return { ...prev, [studentId]: next };
    });
  };

  const markAll = (status: Status) => {
    const map: Record<string, Status> = {};
    students.forEach(s => { map[s.id!] = status; });
    setAttendance(map);
  };

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-xl font-bold text-slate-900">Attendance</h1>

      <div className="flex flex-wrap gap-3">
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none" />
        <select value={batchId} onChange={e => setBatchId(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none min-w-[180px]">
          <option value="">Select Batch</option>
          {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {batchId && students.length > 0 && (
        <>
          <div className="flex gap-2">
            <button onClick={() => markAll('present')} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200">All Present</button>
            <button onClick={() => markAll('absent')} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-100 text-red-600 hover:bg-red-200">All Absent</button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">
            {students.map((s, i) => {
              const status = attendance[s.id!] ?? 'present';
              const cfg = STATUS_CONFIG[status];
              const Icon = cfg.icon;
              return (
                <div key={s.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-400 w-6">{i + 1}.</span>
                    <div>
                      <p className="font-medium text-slate-900 text-sm">{s.name}</p>
                      {s.phone && <p className="text-xs text-slate-400">{s.phone}</p>}
                    </div>
                  </div>
                  <button onClick={() => toggle(s.id!)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all" style={{ background: cfg.bg, color: cfg.color }}>
                    <Icon className="h-3.5 w-3.5" />
                    {cfg.label}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {saveMut.isPending ? 'Saving…' : 'Save Attendance'}
            </button>
            {saved && <span className="text-sm text-green-600 font-medium">✓ Saved!</span>}
            <span className="text-xs text-slate-400">
              {Object.values(attendance).filter(s => s === 'present').length} present ·{' '}
              {Object.values(attendance).filter(s => s === 'absent').length} absent ·{' '}
              {Object.values(attendance).filter(s => s === 'late').length} late
            </span>
          </div>
        </>
      )}

      {batchId && students.length === 0 && (
        <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-100">
          <p className="text-3xl mb-2">👥</p>
          <p>No students in this batch yet</p>
        </div>
      )}

      {!batchId && (
        <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-100">
          <p className="text-3xl mb-2">📋</p>
          <p>Select a batch to mark attendance</p>
        </div>
      )}
    </div>
  );
}

// [ca] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Users, Trash2, Briefcase } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listCAStaff, createCAStaff, deleteCAStaff, listCATasks, listCAClients, updateCATask } from '@/lib/db/ca';
import { toast } from 'sonner';

const ROLES = ['Article', 'Senior', 'Manager', 'Partner', 'Intern'];

export function CAStaffPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', role: 'Article', phone: '', email: '' });

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['ca-staff', tenantId],
    queryFn: () => listCAStaff(tenantId),
    enabled: !!tenantId,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['ca-tasks', tenantId],
    queryFn: () => listCATasks(tenantId),
    enabled: !!tenantId,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['ca-clients', tenantId, ''],
    queryFn: () => listCAClients(tenantId),
    enabled: !!tenantId,
  });

  const add = useMutation({
    mutationFn: () => createCAStaff(tenantId, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ca-staff'] });
      setShowAdd(false);
      setForm({ name: '', role: 'Article', phone: '', email: '' });
      toast.success('Staff member added');
    },
    onError: (e) => toast.error(String(e)),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteCAStaff(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ca-staff'] }); toast.success('Staff removed'); },
  });

  const assignTask = useMutation({
    mutationFn: ({ taskId, staffId }: { taskId: string; staffId: string }) =>
      updateCATask(tenantId, taskId, { staff_id: staffId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ca-tasks'] }); toast.success('Task assigned'); },
  });

  function clientName(id: string) { return clients.find(c => c.id === id)?.name ?? '—'; }
  function staffTaskCount(staffId: string) { return tasks.filter(t => t.staff_id === staffId && t.status !== 'completed').length; }
  function unassignedTasks() { return tasks.filter(t => !t.staff_id && t.status !== 'completed'); }
  function tasksForStaff(staffId: string) { return tasks.filter(t => t.staff_id === staffId && t.status !== 'completed'); }

  const roleColor: Record<string, string> = {
    Partner: 'bg-purple-100 text-purple-700',
    Manager: 'bg-blue-100 text-blue-700',
    Senior: 'bg-green-100 text-green-700',
    Article: 'bg-amber-100 text-amber-700',
    Intern: 'bg-slate-100 text-slate-600',
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Staff</h1>
          <p className="text-slate-400 text-sm mt-0.5">Manage team and assign tasks</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-500">
          <Plus className="h-4 w-4" /> Add Staff
        </button>
      </div>

      {/* Staff grid */}
      {isLoading ? <p className="text-slate-400 text-sm text-center py-8">Loading…</p> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {staff.map(s => (
            <button key={s.id}
              onClick={() => setSelectedStaff(selectedStaff === s.id ? null : s.id)}
              className={`text-left bg-white rounded-2xl border shadow-sm p-4 transition-all hover:shadow-md ${selectedStaff === s.id ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-100'}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{s.name}</p>
                    <p className="text-xs text-slate-400">{s.phone || '—'} · {s.email || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColor[s.role] ?? 'bg-slate-100 text-slate-600'}`}>{s.role}</span>
                  <button onClick={e => { e.stopPropagation(); if (confirm('Remove staff member?')) del.mutate(s.id); }}
                    className="p-1 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1">
                <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs text-slate-500">{staffTaskCount(s.id)} active task{staffTaskCount(s.id) !== 1 ? 's' : ''}</span>
              </div>
            </button>
          ))}
          {staff.length === 0 && (
            <div className="col-span-2 text-center py-12 bg-white rounded-2xl border border-slate-100">
              <Users className="h-10 w-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No staff added yet</p>
            </div>
          )}
        </div>
      )}

      {/* Task assignment for selected staff */}
      {selectedStaff && (
        <div className="bg-white rounded-2xl border border-blue-100 p-5">
          <h2 className="font-semibold text-slate-800 mb-3">
            Tasks — {staff.find(s => s.id === selectedStaff)?.name}
          </h2>
          {tasksForStaff(selectedStaff).length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-4">No tasks assigned</p>
          ) : (
            <div className="space-y-2">
              {tasksForStaff(selectedStaff).map(t => (
                <div key={t.id} className="flex items-center justify-between text-sm bg-slate-50 rounded-xl px-3 py-2">
                  <div>
                    <p className="font-medium text-slate-800">{t.task_type}</p>
                    <p className="text-xs text-slate-400">{clientName(t.client_id)} · FY: {t.financial_year || '—'}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${t.priority === 'urgent' ? 'bg-red-100 text-red-700' : t.priority === 'high' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{t.priority}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Unassigned tasks */}
      {unassignedTasks().length > 0 && (
        <div className="bg-amber-50 rounded-2xl border border-amber-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Briefcase className="h-4 w-4 text-amber-600" />
            <h2 className="font-semibold text-slate-800">Unassigned Tasks</h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{unassignedTasks().length}</span>
          </div>
          <div className="space-y-2">
            {unassignedTasks().slice(0, 10).map(t => (
              <div key={t.id} className="flex items-center justify-between text-sm bg-white rounded-xl px-3 py-2">
                <div>
                  <p className="font-medium text-slate-800">{t.task_type}</p>
                  <p className="text-xs text-slate-400">{clientName(t.client_id)} · {t.due_date ? new Date(t.due_date).toLocaleDateString('en-IN') : 'No due date'}</p>
                </div>
                {staff.length > 0 && (
                  <select className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none" defaultValue=""
                    onChange={e => { if (e.target.value) assignTask.mutate({ taskId: t.id, staffId: e.target.value }); }}>
                    <option value="">Assign to…</option>
                    {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <h2 className="text-lg font-bold text-slate-800">Add Staff Member</h2>
            {[
              { key: 'name', label: 'Name *', placeholder: 'Full name' },
              { key: 'phone', label: 'Phone', placeholder: '9xxxxxxxxx' },
              { key: 'email', label: 'Email', placeholder: 'email@example.com' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={f.placeholder} value={(form as Record<string, string>)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
              <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600">Cancel</button>
              <button onClick={() => add.mutate()} disabled={!form.name.trim() || add.isPending}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 disabled:opacity-40">
                {add.isPending ? 'Saving…' : 'Add Staff'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

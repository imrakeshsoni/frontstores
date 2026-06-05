// [ca] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listCATasks, listCAClients, createCATask, updateCATask, deleteCATask } from '@/lib/db/ca';
import { toast } from 'sonner';

const TASK_TYPES = ['ITR Filing', 'GST Return', 'Audit', 'TDS Filing', 'Bookkeeping', 'Company Registration', 'Tax Planning', 'Other'];
const STATUSES   = ['pending', 'in-progress', 'completed'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

export function CATasksPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    client_id: '', task_type: '', financial_year: '', due_date: '', status: 'pending',
    priority: 'normal', description: '', fees: '', fees_paid: '0', staff_id: '',
  });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['ca-tasks', tenantId, filterStatus],
    queryFn: () => listCATasks(tenantId, { status: filterStatus || undefined }),
    enabled: !!tenantId,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['ca-clients', tenantId, ''],
    queryFn: () => listCAClients(tenantId),
    enabled: !!tenantId,
  });

  const add = useMutation({
    mutationFn: () => createCATask(tenantId, {
      client_id: form.client_id, task_type: form.task_type, financial_year: form.financial_year,
      due_date: form.due_date || null, status: form.status, priority: form.priority,
      description: form.description, fees: parseFloat(form.fees) || 0, fees_paid: parseFloat(form.fees_paid) || 0,
      staff_id: form.staff_id,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ca-tasks'] }); qc.invalidateQueries({ queryKey: ['ca-stats'] }); setShowAdd(false); toast.success('Task created'); },
    onError: (e) => toast.error(String(e)),
  });

  const markDone = useMutation({
    mutationFn: (id: string) => updateCATask(tenantId, id, { status: 'completed', completed_at: new Date().toISOString() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ca-tasks'] }); qc.invalidateQueries({ queryKey: ['ca-stats'] }); toast.success('Task completed'); },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteCATask(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ca-tasks'] }); toast.success('Task deleted'); },
  });

  function isOverdue(t: { status: string; due_date: string | null }) {
    return t.status !== 'completed' && t.due_date && t.due_date < today;
  }

  function clientName(id: string) {
    return clients.find(c => c.id === id)?.name ?? '—';
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Tasks</h1>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-500 transition-colors">
          <Plus className="h-4 w-4" /> New Task
        </button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {['', 'pending', 'in-progress', 'completed'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filterStatus === s ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300'}`}>
            {s === '' ? 'All' : s}
          </button>
        ))}
      </div>

      {isLoading ? <p className="text-slate-400 text-sm text-center py-8">Loading…</p> : (
        <div className="space-y-2">
          {tasks.map(t => {
            const overdue = isOverdue(t);
            return (
              <div key={t.id} className={`bg-white rounded-2xl border shadow-sm p-4 ${overdue ? 'border-red-200 bg-red-50' : 'border-slate-100'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {overdue ? <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" /> : t.status === 'completed' ? <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" /> : <Clock className="h-4 w-4 text-amber-500 flex-shrink-0" />}
                      <p className={`font-semibold ${overdue ? 'text-red-800' : 'text-slate-800'}`}>{t.task_type}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${t.priority === 'urgent' ? 'bg-red-100 text-red-700' : t.priority === 'high' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{t.priority}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{clientName(t.client_id)} · FY: {t.financial_year || '—'}</p>
                    {t.description && <p className="text-xs text-slate-400 mt-0.5">{t.description}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                      <span>Due: {t.due_date ? new Date(t.due_date).toLocaleDateString('en-IN') : '—'}</span>
                      <span>Fees: ₹{t.fees.toLocaleString('en-IN')}</span>
                      <span>Paid: ₹{t.fees_paid.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {t.status !== 'completed' && (
                      <button onClick={() => markDone.mutate(t.id)} className="text-xs px-2.5 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 font-medium transition-colors">Done</button>
                    )}
                    <button onClick={() => { if (confirm('Delete task?')) del.mutate(t.id); }} className="text-xs px-2.5 py-1 rounded-lg bg-slate-50 text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors">Del</button>
                  </div>
                </div>
              </div>
            );
          })}
          {tasks.length === 0 && <p className="text-slate-400 text-sm text-center py-8">No tasks found</p>}
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-3 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-800">New Task</h2>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Client *</label>
              <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none" value={form.client_id} onChange={e => setForm(p => ({ ...p, client_id: e.target.value }))}>
                <option value="">— Select client —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Task Type *</label>
              <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none" value={form.task_type} onChange={e => setForm(p => ({ ...p, task_type: e.target.value }))}>
                <option value="">— Select type —</option>
                {TASK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {[
              { key: 'financial_year', label: 'Financial Year', placeholder: 'e.g. 2024-25' },
              { key: 'due_date', label: 'Due Date', type: 'date' },
              { key: 'fees', label: 'Fees (₹)', placeholder: '0', type: 'number' },
              { key: 'fees_paid', label: 'Fees Paid (₹)', placeholder: '0', type: 'number' },
              { key: 'description', label: 'Description', placeholder: 'Optional notes' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                <input type={f.type ?? 'text'} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  placeholder={f.placeholder} value={(form as Record<string, string>)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Priority</label>
                <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600">Cancel</button>
              <button onClick={() => add.mutate()} disabled={!form.client_id || !form.task_type || add.isPending}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 disabled:opacity-40">
                {add.isPending ? 'Saving…' : 'Create Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

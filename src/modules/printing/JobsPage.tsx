// [printing] [all tenants]
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { listPRJobs, updatePRJob } from '@/lib/db/printing';
import { now } from '@/lib/db/index';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

const STATUS_COLORS: Record<string, string> = {
  received:   'bg-blue-100 text-blue-700',
  printing:   'bg-amber-100 text-amber-700',
  ready:      'bg-green-100 text-green-700',
  delivered:  'bg-slate-100 text-slate-600',
  cancelled:  'bg-red-100 text-red-700',
};

const STATUS_FLOW: Record<string, string> = {
  received: 'printing',
  printing: 'ready',
  ready: 'delivered',
};

const STATUS_BTN: Record<string, string> = {
  received: 'Start Printing',
  printing: 'Mark Ready',
  ready: 'Mark Delivered',
};

export function JobsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');

  const { data: jobs = [] } = useQuery({
    queryKey: ['pr-jobs', tenantId, statusFilter],
    queryFn: () => listPRJobs(tenantId, statusFilter || undefined),
    enabled: !!tenantId,
  });

  async function advanceStatus(id: string, currentStatus: string) {
    const next = STATUS_FLOW[currentStatus];
    if (!next) return;
    try {
      const updates: any = { status: next };
      if (next === 'delivered') updates.delivered_at = now();
      await updatePRJob(tenantId, id, updates);
      toast.success(`Job marked as ${next}`);
      qc.invalidateQueries({ queryKey: ['pr-jobs', tenantId] });
      qc.invalidateQueries({ queryKey: ['pr-stats', tenantId] });
    } catch (e) { toast.error(String(e)); }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Print Jobs</h1>
        <button onClick={() => navigate('/printing/jobs/new')} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors">
          + New Job
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['', 'received', 'printing', 'ready', 'delivered', 'cancelled'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {jobs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
            <p className="text-slate-400 text-sm">No jobs found</p>
          </div>
        ) : jobs.map(j => {
          const balance = j.total_amount - j.advance_paid;
          return (
            <div key={j.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-slate-900">{j.customer_name}</span>
                    <span className="text-xs text-slate-400">{j.job_no}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[j.status] ?? 'bg-slate-100 text-slate-600'}`}>{j.status}</span>
                    {j.job_type && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{j.job_type}</span>}
                  </div>
                  <p className="text-sm text-slate-600">{j.description}</p>
                  <div className="flex gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                    <span>Qty: {j.quantity}</span>
                    {j.paper_type && <span>Paper: {j.paper_type}</span>}
                    {j.size && <span>Size: {j.size}</span>}
                    <span>{j.color_type === 'color' ? 'Colour' : 'B&W'}</span>
                    {j.promised_date && <span>By: {j.promised_date}</span>}
                  </div>
                </div>
                <div className="text-right ml-4">
                  <p className="font-bold text-slate-900">{fmt(j.total_amount)}</p>
                  {balance > 0 && <p className="text-xs text-red-500">Pending: {fmt(balance)}</p>}
                  {STATUS_FLOW[j.status] && (
                    <button onClick={() => advanceStatus(j.id, j.status)}
                      className="mt-2 px-3 py-1 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs font-medium transition-colors">
                      {STATUS_BTN[j.status]}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

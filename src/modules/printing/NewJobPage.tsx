// [printing] [all tenants]
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { createPRJob } from '@/lib/db/printing';

const JOB_TYPES = ['Visiting Cards', 'Banner', 'Pamphlet', 'Booklet', 'Photocopy', 'Poster', 'Sticker', 'Other'];

export function NewJobPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    customer_name: '', customer_phone: '',
    job_type: 'Visiting Cards', description: '',
    quantity: '1', paper_type: '', size: '',
    color_type: 'bw', total_amount: '', advance_paid: '',
    promised_date: '', notes: '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.customer_name || !form.description) { toast.error('Customer name and description required'); return; }
    setSaving(true);
    try {
      const count = Date.now();
      await createPRJob(tenantId, {
        job_no: `J${count.toString().slice(-6)}`,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        job_type: form.job_type,
        description: form.description,
        quantity: parseInt(form.quantity) || 1,
        paper_type: form.paper_type,
        size: form.size,
        color_type: form.color_type,
        total_amount: parseFloat(form.total_amount) || 0,
        advance_paid: parseFloat(form.advance_paid) || 0,
        status: 'received',
        promised_date: form.promised_date || null,
        notes: form.notes,
      });
      toast.success('Job created');
      qc.invalidateQueries({ queryKey: ['pr-jobs', tenantId] });
      qc.invalidateQueries({ queryKey: ['pr-stats', tenantId] });
      navigate('/printing/jobs');
    } catch (e) { toast.error(String(e)); }
    finally { setSaving(false); }
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/printing/jobs')} className="text-slate-500 hover:text-slate-900">←</button>
        <h1 className="text-2xl font-bold text-slate-900">New Print Job</h1>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        {/* Customer */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Customer Name *</label>
            <input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Customer name"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
            <input value={form.customer_phone} onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="9999999999"
            />
          </div>
        </div>

        {/* Job type */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">Job Type</label>
          <div className="flex flex-wrap gap-2">
            {JOB_TYPES.map(t => (
              <button key={t} onClick={() => setForm(f => ({ ...f, job_type: t }))}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${form.job_type === t ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Description *</label>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            placeholder="e.g. Double-sided visiting card with logo, 500 pcs"
          />
        </div>

        {/* Details */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Quantity</label>
            <input type="number" min="1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Paper Type</label>
            <input value={form.paper_type} onChange={e => setForm(f => ({ ...f, paper_type: e.target.value }))}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="e.g. 130 gsm matte"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Size</label>
            <input value={form.size} onChange={e => setForm(f => ({ ...f, size: e.target.value }))}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="e.g. A4, 3.5x2 inch"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Color</label>
            <select value={form.color_type} onChange={e => setForm(f => ({ ...f, color_type: e.target.value }))}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="bw">Black & White</option>
              <option value="color">Full Colour</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Total Amount (₹)</label>
            <input type="number" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="0" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Advance Paid (₹)</label>
            <input type="number" value={form.advance_paid} onChange={e => setForm(f => ({ ...f, advance_paid: e.target.value }))}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="0" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Promised Date</label>
            <input type="date" value={form.promised_date} onChange={e => setForm(f => ({ ...f, promised_date: e.target.value }))}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
        </div>

        <button onClick={handleSave} disabled={saving || !form.customer_name || !form.description}
          className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors disabled:opacity-40">
          {saving ? 'Creating…' : 'Create Job'}
        </button>
      </div>
    </div>
  );
}

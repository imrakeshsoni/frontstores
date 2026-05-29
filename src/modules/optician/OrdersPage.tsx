// [optician] [all tenants]
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { listOptOrders, createOptOrder, updateOptOrder, deleteOptOrder, listOptPatients, listOptPrescriptions } from '@/lib/db/optician';
import { now } from '@/lib/db/index';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

const STATUS_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  order_placed: { label: 'Order Placed', bg: '#dbeafe', text: '#1d4ed8' },
  lens_received: { label: 'Lens Received', bg: '#fef3c7', text: '#92400e' },
  ready: { label: 'Ready', bg: '#dcfce7', text: '#166534' },
  delivered: { label: 'Delivered', bg: '#f1f5f9', text: '#64748b' },
};

const LENS_TYPES = ['Single Vision', 'Bifocal', 'Progressive', 'Reading', 'Computer', 'Photochromic', 'Polarized'];
const COATINGS = ['None', 'Anti-Reflective', 'Blue Light', 'UV Protection', 'Scratch Resistant', 'Hydrophobic'];

export function OrdersPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    patient_id: '', prescription_id: '', frame_desc: '',
    lens_type: '', lens_brand: '', coating: '', tint: '',
    advance_paid: '', total_amount: '', status: 'order_placed',
    promised_date: '', delivered_at: '', order_no: '',
  });

  const { data: patients = [] } = useQuery({ queryKey: ['opt-patients', tenantId, ''], queryFn: () => listOptPatients(tenantId), enabled: !!tenantId });
  const { data: prescriptions = [] } = useQuery({
    queryKey: ['opt-prescriptions-p', tenantId, form.patient_id],
    queryFn: () => listOptPrescriptions(tenantId, form.patient_id),
    enabled: !!form.patient_id,
  });
  const { data: orders = [] } = useQuery({
    queryKey: ['opt-orders', tenantId, filter],
    queryFn: () => filter === 'all' ? listOptOrders(tenantId) : listOptOrders(tenantId, filter),
    enabled: !!tenantId,
  });

  function resetForm() {
    setForm({ patient_id: '', prescription_id: '', frame_desc: '', lens_type: '', lens_brand: '', coating: '', tint: '', advance_paid: '', total_amount: '', status: 'order_placed', promised_date: '', delivered_at: '', order_no: '' });
    setEditId(null); setShowForm(false);
  }

  async function handleSave() {
    if (!form.patient_id) { toast.error('Select patient'); return; }
    try {
      const data = {
        patient_id: form.patient_id, prescription_id: form.prescription_id,
        order_no: form.order_no || `OPT-${Date.now()}`,
        frame_desc: form.frame_desc, lens_type: form.lens_type, lens_brand: form.lens_brand,
        coating: form.coating, tint: form.tint,
        advance_paid: Number(form.advance_paid) || 0,
        total_amount: Number(form.total_amount) || 0,
        status: form.status,
        promised_date: form.promised_date || null,
        delivered_at: form.delivered_at || null,
      };
      if (editId) { await updateOptOrder(tenantId, editId, data); toast.success('Updated'); }
      else { await createOptOrder(tenantId, data); toast.success('Order created'); }
      qc.invalidateQueries({ queryKey: ['opt-orders'] });
      qc.invalidateQueries({ queryKey: ['optician-stats'] });
      resetForm();
    } catch { toast.error('Failed'); }
  }

  async function handleStatusChange(id: string, status: string) {
    const update: any = { status };
    if (status === 'delivered') update.delivered_at = now();
    await updateOptOrder(tenantId, id, update);
    qc.invalidateQueries({ queryKey: ['opt-orders'] });
    toast.success('Status updated');
  }

  function startEdit(o: any) {
    setForm({
      patient_id: o.patient_id, prescription_id: o.prescription_id ?? '',
      order_no: o.order_no, frame_desc: o.frame_desc, lens_type: o.lens_type,
      lens_brand: o.lens_brand, coating: o.coating, tint: o.tint,
      advance_paid: String(o.advance_paid), total_amount: String(o.total_amount),
      status: o.status, promised_date: o.promised_date ?? '', delivered_at: o.delivered_at ?? '',
    });
    setEditId(o.id); setShowForm(true);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Orders</h1>
          <p className="text-slate-500 text-sm">{orders.length} orders</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: '#0891b2' }}>
          <Plus className="h-4 w-4" /> New Order
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['all', 'order_placed', 'lens_received', 'ready', 'delivered'].map(s => {
          const info = STATUS_LABELS[s] ?? { label: 'All', bg: '#f1f5f9', text: '#64748b' };
          return (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${filter === s ? 'border-transparent' : 'border-slate-200 text-slate-600 bg-white'}`}
              style={filter === s ? { background: info.bg, color: info.text } : {}}>
              {s === 'all' ? 'All' : info.label}
            </button>
          );
        })}
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-slate-900">{editId ? 'Edit Order' : 'New Order'}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-slate-500 block mb-1">Patient *</label>
              <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.patient_id} onChange={e => setForm(f => ({ ...f, patient_id: e.target.value, prescription_id: '' }))}>
                <option value="">Select patient</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select></div>
            <div><label className="text-xs font-medium text-slate-500 block mb-1">Prescription</label>
              <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.prescription_id} onChange={e => setForm(f => ({ ...f, prescription_id: e.target.value }))}>
                <option value="">Select Rx</option>
                {prescriptions.map(rx => <option key={rx.id} value={rx.id}>{new Date(rx.exam_date).toLocaleDateString('en-IN')}</option>)}
              </select></div>
            <div className="col-span-2"><label className="text-xs font-medium text-slate-500 block mb-1">Frame Description</label>
              <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="e.g. Ray-Ban RB3589 Black Full Rim" value={form.frame_desc} onChange={e => setForm(f => ({ ...f, frame_desc: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-slate-500 block mb-1">Lens Type</label>
              <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.lens_type} onChange={e => setForm(f => ({ ...f, lens_type: e.target.value }))}>
                <option value="">Select</option>{LENS_TYPES.map(l => <option key={l} value={l}>{l}</option>)}</select></div>
            <div><label className="text-xs font-medium text-slate-500 block mb-1">Lens Brand</label>
              <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.lens_brand} onChange={e => setForm(f => ({ ...f, lens_brand: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-slate-500 block mb-1">Coating</label>
              <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.coating} onChange={e => setForm(f => ({ ...f, coating: e.target.value }))}>
                <option value="">Select</option>{COATINGS.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label className="text-xs font-medium text-slate-500 block mb-1">Tint</label>
              <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="e.g. Brown, Grey" value={form.tint} onChange={e => setForm(f => ({ ...f, tint: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-slate-500 block mb-1">Total Amount</label>
              <input type="number" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-slate-500 block mb-1">Advance Paid</label>
              <input type="number" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.advance_paid} onChange={e => setForm(f => ({ ...f, advance_paid: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-slate-500 block mb-1">Promised Date</label>
              <input type="date" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.promised_date} onChange={e => setForm(f => ({ ...f, promised_date: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-slate-500 block mb-1">Status</label>
              <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="px-5 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: '#0891b2' }}>Save</button>
            <button onClick={resetForm} className="px-5 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {orders.map(o => {
          const sc = STATUS_LABELS[o.status] ?? STATUS_LABELS.order_placed;
          const balance = o.total_amount - o.advance_paid;
          const overdue = o.status !== 'delivered' && o.promised_date && new Date(o.promised_date) < new Date();
          return (
            <div key={o.id} className={`bg-white rounded-2xl border shadow-sm p-4 ${overdue ? 'border-orange-200' : 'border-slate-100'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{o.patient_name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: sc.bg, color: sc.text }}>{sc.label}</span>
                    {overdue && <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">Overdue</span>}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{o.order_no}</p>
                  {o.frame_desc && <p className="text-xs text-slate-600 mt-0.5">Frame: {o.frame_desc}</p>}
                  <p className="text-xs text-slate-500">{o.lens_type} {o.lens_brand && `· ${o.lens_brand}`} {o.coating && `· ${o.coating}`}</p>
                  {o.promised_date && <p className="text-xs text-slate-400">Promised: {new Date(o.promised_date).toLocaleDateString('en-IN')}</p>}
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900">{fmt(o.total_amount)}</p>
                  <p className="text-xs text-green-600">Adv: {fmt(o.advance_paid)}</p>
                  {balance > 0 && <p className="text-xs text-orange-500">Due: {fmt(balance)}</p>}
                </div>
              </div>
              <div className="flex gap-2 mt-3 pt-3 border-t border-slate-50">
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <button key={k} onClick={() => handleStatusChange(o.id, k)}
                    disabled={o.status === k}
                    className="px-2 py-1 rounded-lg text-xs font-medium border transition-all disabled:opacity-40"
                    style={o.status === k ? { background: sc.bg, color: sc.text, borderColor: sc.text + '40' } : { borderColor: '#e2e8f0', color: '#64748b' }}>
                    {v.label}
                  </button>
                ))}
                <button onClick={() => startEdit(o)} className="ml-auto p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-blue-500">
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button onClick={async () => { if (confirm('Delete?')) { await deleteOptOrder(tenantId, o.id); qc.invalidateQueries({ queryKey: ['opt-orders'] }); toast.success('Deleted'); }}} className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-red-500">✕</button>
              </div>
            </div>
          );
        })}
        {orders.length === 0 && <p className="text-center text-slate-400 py-12">No orders found</p>}
      </div>
    </div>
  );
}

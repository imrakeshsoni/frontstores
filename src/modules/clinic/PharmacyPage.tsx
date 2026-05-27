// [clinic] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/app/store/app.store';
import {
  listClinicMedicines, createClinicMedicine, getLowStockMedicines,
  getExpiringMedicines, type ClinicMedicine,
} from '@/lib/db/clinic';
import { getDb, uuid, now } from '@/lib/db/index';
import { toast } from 'sonner';
import { Plus, Search, AlertTriangle } from 'lucide-react';

type MedForm = {
  name: string; generic_name: string; form: string; strength: string; unit: string;
  stock_qty: string; min_stock_qty: string; selling_price: string; cost_price: string;
  gst_rate: string; expiry_date: string;
};

const emptyForm = (): MedForm => ({
  name: '', generic_name: '', form: 'tablet', strength: '', unit: 'tablet',
  stock_qty: '0', min_stock_qty: '10', selling_price: '0', cost_price: '',
  gst_rate: '12', expiry_date: '',
});

const FORMS = ['tablet', 'capsule', 'syrup', 'injection', 'cream', 'ointment', 'drops', 'inhaler', 'powder', 'sachet'];
const UNITS = ['tablet', 'capsule', 'ml', 'mg', 'gm', 'vial', 'strip', 'bottle', 'tube', 'sachet'];

export function PharmacyPage() {
  const { config } = useAppStore();
  const tid = config?.tenant_id ?? '';
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'add' | 'stock' | null>(null);
  const [selectedMed, setSelectedMed] = useState<ClinicMedicine | null>(null);
  const [stockQty, setStockQty] = useState('');
  const [form, setForm] = useState<MedForm>(emptyForm());
  const [activeTab, setActiveTab] = useState<'all' | 'low' | 'expiring'>('all');

  const { data: medicines = [] } = useQuery({
    queryKey: ['clinic-medicines', tid, search],
    queryFn: () => listClinicMedicines(tid, search),
  });
  const { data: lowStock = [] } = useQuery({
    queryKey: ['clinic-medicines-low', tid],
    queryFn: () => getLowStockMedicines(tid),
    enabled: activeTab === 'low',
  });
  const { data: expiring = [] } = useQuery({
    queryKey: ['clinic-medicines-expiring', tid],
    queryFn: () => getExpiringMedicines(tid, 60),
    enabled: activeTab === 'expiring',
  });

  const createMut = useMutation({
    mutationFn: () => createClinicMedicine(tid, {
      name: form.name.trim(),
      generic_name: form.generic_name || null,
      form: form.form || null,
      strength: form.strength || null,
      unit: form.unit,
      stock_qty: Number(form.stock_qty),
      min_stock_qty: Number(form.min_stock_qty),
      selling_price: Number(form.selling_price),
      cost_price: form.cost_price ? Number(form.cost_price) : null,
      gst_rate: Number(form.gst_rate),
      expiry_date: form.expiry_date || null,
      is_active: true,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clinic-medicines'] });
      toast.success('Medicine added');
      setModal(null); setForm(emptyForm());
    },
    onError: (e) => toast.error(String(e)),
  });

  const addStockMut = useMutation({
    mutationFn: async () => {
      if (!selectedMed) return;
      const db = await getDb();
      await db.execute(
        `UPDATE clinic_medicines SET stock_qty = stock_qty + ?, updated_at = ? WHERE id = ? AND tenant_id = ?`,
        [Number(stockQty), now(), selectedMed.id, tid]
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clinic-medicines'] });
      toast.success('Stock updated');
      setModal(null); setStockQty(''); setSelectedMed(null);
    },
    onError: (e) => toast.error(String(e)),
  });

  const displayList = activeTab === 'low' ? lowStock : activeTab === 'expiring' ? expiring : medicines;

  const inp = (field: keyof MedForm, label: string, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      <input type={type} placeholder={placeholder} value={form[field]}
        onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
        className="w-full rounded-xl px-3 py-2 text-sm"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }} />
    </div>
  );

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Pharmacy</h1>
        <button onClick={() => { setForm(emptyForm()); setModal('add'); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: 'var(--accent)' }}>
          <Plus className="h-4 w-4" /> Add Medicine
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['all', 'low', 'expiring'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            style={activeTab === tab
              ? { background: 'var(--accent)', color: 'white' }
              : { background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
            {tab === 'all' ? 'All Stock' : tab === 'low' ? '⚠ Low Stock' : '⏰ Expiring Soon'}
          </button>
        ))}
      </div>

      {/* Search (only on all tab) */}
      {activeTab === 'all' && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
          <input placeholder="Search medicine by name…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }} />
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--surface-border)', background: 'var(--surface)' }}>
        {displayList.length === 0 ? (
          <p className="text-center py-10 text-sm" style={{ color: 'var(--text-tertiary)' }}>
            {activeTab === 'all' ? 'No medicines yet' : activeTab === 'low' ? 'No low stock items' : 'Nothing expiring soon'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--surface-border)', background: 'var(--surface-2)' }}>
                {['Name', 'Form', 'Stock', 'Min Stock', 'Selling Price', 'Expiry', 'Action'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayList.map(m => {
                const isLow = m.stock_qty <= m.min_stock_qty;
                const isExpired = m.expiry_date && m.expiry_date < new Date().toISOString().slice(0, 10);
                return (
                  <tr key={m.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--surface-border)' }}>
                    <td className="px-4 py-3">
                      <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{m.name}</p>
                      {m.generic_name && <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{m.generic_name}</p>}
                      {m.strength && <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{m.strength}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{m.form ?? m.unit}</td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-bold ${isLow ? 'text-red-600' : ''}`} style={isLow ? {} : { color: 'var(--text-primary)' }}>
                        {m.stock_qty} {m.unit}
                      </span>
                      {isLow && <AlertTriangle className="inline h-3 w-3 ml-1 text-red-500" />}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{m.min_stock_qty}</td>
                    <td className="px-4 py-3 text-sm font-semibold" style={{ color: '#059669' }}>₹{m.selling_price}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: isExpired ? '#dc2626' : 'var(--text-secondary)' }}>
                      {m.expiry_date ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => { setSelectedMed(m); setStockQty(''); setModal('stock'); }}
                        className="text-xs px-2 py-1 rounded-lg" style={{ background: '#dbeafe', color: '#2563eb' }}>
                        + Stock
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Medicine Modal */}
      {modal === 'add' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ background: 'var(--surface)' }}>
            <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Add Medicine</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">{inp('name', 'Brand Name *', 'text', 'e.g. Crocin')}</div>
              {inp('generic_name', 'Generic Name', 'text', 'e.g. Paracetamol')}
              {inp('strength', 'Strength', 'text', 'e.g. 500mg')}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Form</label>
                <select value={form.form} onChange={e => setForm(f => ({ ...f, form: e.target.value }))}
                  className="w-full rounded-xl px-3 py-2 text-sm"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }}>
                  {FORMS.map(f => <option key={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Unit</label>
                <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                  className="w-full rounded-xl px-3 py-2 text-sm"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }}>
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              {inp('stock_qty', 'Opening Stock', 'number', '0')}
              {inp('min_stock_qty', 'Minimum Stock Alert', 'number', '10')}
              {inp('selling_price', 'Selling Price (₹)', 'number', '0')}
              {inp('cost_price', 'Cost Price (₹)', 'number', '0')}
              {inp('gst_rate', 'GST Rate (%)', 'number', '12')}
              {inp('expiry_date', 'Expiry Date', 'date')}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setModal(null)} className="flex-1 py-2 rounded-xl text-sm border"
                style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Cancel</button>
              <button onClick={() => createMut.mutate()} disabled={!form.name.trim() || createMut.isPending}
                className="flex-1 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ background: 'var(--accent)' }}>
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Stock Modal */}
      {modal === 'stock' && selectedMed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-2xl p-6 w-full max-w-sm" style={{ background: 'var(--surface)' }}>
            <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Add Stock</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              {selectedMed.name} — Current: {selectedMed.stock_qty} {selectedMed.unit}
            </p>
            <input type="number" placeholder="Quantity to add" value={stockQty}
              onChange={e => setStockQty(e.target.value)} min={1}
              className="w-full rounded-xl px-3 py-2.5 text-sm mb-4"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }} />
            <div className="flex gap-3">
              <button onClick={() => { setModal(null); setSelectedMed(null); }} className="flex-1 py-2 rounded-xl text-sm border"
                style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Cancel</button>
              <button onClick={() => addStockMut.mutate()} disabled={!stockQty || Number(stockQty) <= 0 || addStockMut.isPending}
                className="flex-1 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ background: 'var(--accent)' }}>
                Add Stock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

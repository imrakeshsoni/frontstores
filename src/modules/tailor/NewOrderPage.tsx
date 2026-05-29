// [tailor] [all tenants]
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import {
  listTailorCustomers, saveTailorCustomer, saveTailorOrder,
  type TailorCustomer,
} from '@/lib/db/tailor';

const ITEM_TYPES = [
  'Kurta', 'Salwar', 'Kurti', 'Blouse', 'Saree Fall', 'Lehenga', 'Anarkali',
  'Trousers', 'Shirt', 'Suit', 'Coat', 'Sherwani', 'Frock', 'Pant', 'Other',
];

const MEASUREMENT_FIELDS = [
  'Chest', 'Waist', 'Hip', 'Shoulder', 'Sleeve Length', 'Body Length',
  'Neck', 'Inseam', 'Thigh', 'Wrist',
];

export function NewOrderPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [custSearch, setCustSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<TailorCustomer | null>(null);
  const [showNewCust, setShowNewCust] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');

  const [form, setForm] = useState({
    item_type: '',
    description: '',
    fabric_by: 'customer' as 'customer' | 'shop',
    fabric_meters: '',
    fabric_desc: '',
    advance_paid: '',
    total_amount: '',
    delivery_date: '',
    notes: '',
  });
  const [measurements, setMeasurements] = useState<Record<string, string>>({});

  const { data: customers = [] } = useQuery({
    queryKey: ['tailor-customers', tenantId, custSearch],
    queryFn: () => listTailorCustomers(tenantId, { search: custSearch }),
    enabled: !!tenantId && custSearch.length > 0,
  });

  const createCustomer = useMutation({
    mutationFn: () => saveTailorCustomer(tenantId, { name: newCustName, phone: newCustPhone }),
    onSuccess: async (id) => {
      const cust = await listTailorCustomers(tenantId, { search: newCustName });
      const found = cust.find(c => c.id === id);
      if (found) setSelectedCustomer(found);
      setShowNewCust(false);
      setNewCustName('');
      setNewCustPhone('');
      qc.invalidateQueries({ queryKey: ['tailor-customers'] });
      toast.success('Customer added');
    },
  });

  const saveOrder = useMutation({
    mutationFn: () => {
      if (!selectedCustomer) throw new Error('Select a customer');
      if (!form.item_type) throw new Error('Select item type');
      return saveTailorOrder(tenantId, {
        customer_id: selectedCustomer.id,
        item_type: form.item_type,
        description: form.description,
        fabric_by: form.fabric_by,
        fabric_meters: parseFloat(form.fabric_meters) || 0,
        fabric_desc: form.fabric_desc,
        measurements,
        advance_paid: parseFloat(form.advance_paid) || 0,
        total_amount: parseFloat(form.total_amount) || 0,
        delivery_date: form.delivery_date || null,
        notes: form.notes,
        status: 'received',
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tailor-orders'] });
      qc.invalidateQueries({ queryKey: ['tailor-stats'] });
      toast.success('Order created');
      navigate('/tailor/orders');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to save order'),
  });

  const upd = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/tailor/orders')} className="p-2 rounded-xl hover:bg-slate-100">
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </button>
        <h1 className="text-xl font-bold text-slate-900">New Order</h1>
      </div>

      {/* Customer */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
        <h2 className="font-semibold text-slate-900">Customer</h2>
        {selectedCustomer ? (
          <div className="flex items-center justify-between bg-purple-50 rounded-xl px-4 py-3">
            <div>
              <p className="font-semibold text-slate-900">{selectedCustomer.name}</p>
              <p className="text-sm text-slate-500">{selectedCustomer.phone}</p>
            </div>
            <button onClick={() => setSelectedCustomer(null)} className="text-sm text-red-500 hover:underline">Change</button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search customer by name or phone…"
                value={custSearch}
                onChange={e => setCustSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
            </div>
            {customers.length > 0 && (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                {customers.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedCustomer(c); setCustSearch(''); }}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0 text-left"
                  >
                    <span className="font-medium text-slate-800">{c.name}</span>
                    <span className="text-sm text-slate-400">{c.phone}</span>
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowNewCust(!showNewCust)}
              className="flex items-center gap-2 text-sm text-purple-600 hover:underline"
            >
              <Plus className="h-4 w-4" /> Add new customer
            </button>
            {showNewCust && (
              <div className="space-y-2 p-3 bg-slate-50 rounded-xl">
                <input
                  placeholder="Customer name"
                  value={newCustName}
                  onChange={e => setNewCustName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none"
                />
                <input
                  placeholder="Phone"
                  value={newCustPhone}
                  onChange={e => setNewCustPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none"
                />
                <button
                  onClick={() => createCustomer.mutate()}
                  disabled={!newCustName.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: '#7c3aed' }}
                >
                  Add Customer
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Order details */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
        <h2 className="font-semibold text-slate-900">Order Details</h2>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Item Type *</label>
          <select
            value={form.item_type}
            onChange={e => upd('item_type', e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
          >
            <option value="">Select item type…</option>
            {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
          <input
            value={form.description}
            onChange={e => upd('description', e.target.value)}
            placeholder="Color, design, style notes…"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Fabric Provided By</label>
          <div className="flex gap-3">
            {(['customer', 'shop'] as const).map(v => (
              <button
                key={v}
                onClick={() => upd('fabric_by', v)}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={form.fabric_by === v
                  ? { background: '#7c3aed', color: 'white' }
                  : { background: '#f1f5f9', color: '#64748b' }}
              >
                {v === 'customer' ? 'Customer Fabric' : 'Shop Fabric'}
              </button>
            ))}
          </div>
        </div>

        {form.fabric_by === 'shop' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Fabric Meters</label>
              <input
                type="number"
                value={form.fabric_meters}
                onChange={e => upd('fabric_meters', e.target.value)}
                placeholder="0.0"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Fabric Description</label>
              <input
                value={form.fabric_desc}
                onChange={e => upd('fabric_desc', e.target.value)}
                placeholder="Cotton, Silk…"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Delivery Date</label>
          <input
            type="date"
            value={form.delivery_date}
            onChange={e => upd('delivery_date', e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Total Amount (₹)</label>
            <input
              type="number"
              value={form.total_amount}
              onChange={e => upd('total_amount', e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Advance Paid (₹)</label>
            <input
              type="number"
              value={form.advance_paid}
              onChange={e => upd('advance_paid', e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={e => upd('notes', e.target.value)}
            placeholder="Any special instructions…"
            rows={2}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none resize-none"
          />
        </div>
      </div>

      {/* Measurements */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
        <h2 className="font-semibold text-slate-900">Measurements (inches)</h2>
        <div className="grid grid-cols-2 gap-3">
          {MEASUREMENT_FIELDS.map(field => (
            <div key={field}>
              <label className="block text-xs font-medium text-slate-500 mb-1">{field}</label>
              <input
                type="number"
                value={measurements[field] ?? ''}
                onChange={e => setMeasurements(prev => ({ ...prev, [field]: e.target.value }))}
                placeholder="0.0"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none"
              />
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() => saveOrder.mutate()}
        disabled={saveOrder.isPending || !selectedCustomer || !form.item_type}
        className="w-full py-3 rounded-2xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
        style={{ background: '#7c3aed' }}
      >
        {saveOrder.isPending ? 'Saving…' : 'Create Order'}
      </button>
    </div>
  );
}

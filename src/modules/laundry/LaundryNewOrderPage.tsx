// [laundry] [all tenants]
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Minus, Save, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { listLaundryServices, createLaundryOrder, type LaundryOrderItem } from '@/lib/db/laundry';
import { now } from '@/lib/db/index';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function LaundryNewOrderPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [promisedDate, setPromisedDate] = useState('');
  const [advance, setAdvance] = useState(0);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<LaundryOrderItem[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: services = [] } = useQuery({
    queryKey: ['laundry-services', tenantId],
    queryFn: () => listLaundryServices(tenantId),
    enabled: !!tenantId,
  });

  const totalAmount = items.reduce((s, i) => s + i.price * i.qty, 0);

  function addItem(svc: { id: string; item_name: string; service_type: string; price: number }) {
    const existing = items.find(i => i.service_id === svc.id);
    if (existing) {
      setItems(prev => prev.map(i => i.service_id === svc.id ? { ...i, qty: i.qty + 1 } : i));
    } else {
      setItems(prev => [...prev, { service_id: svc.id, item_name: svc.item_name, service_type: svc.service_type, qty: 1, price: svc.price }]);
    }
  }

  function changeQty(serviceId: string, delta: number) {
    setItems(prev => {
      const updated = prev.map(i => i.service_id === serviceId ? { ...i, qty: Math.max(0, i.qty + delta) } : i);
      return updated.filter(i => i.qty > 0);
    });
  }

  async function save() {
    if (!customerName.trim()) { toast.error('Customer name is required'); return; }
    if (items.length === 0) { toast.error('Add at least one item'); return; }
    setSaving(true);
    try {
      await createLaundryOrder(tenantId, {
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        items,
        total_amount: totalAmount,
        advance_paid: advance,
        status: 'received',
        received_at: now(),
        promised_date: promisedDate || null,
        delivered_at: null,
        notes: notes.trim(),
        order_no: '',
      });
      qc.invalidateQueries({ queryKey: ['laundry-orders'] });
      qc.invalidateQueries({ queryKey: ['laundry-stats'] });
      toast.success('Order created!');
      navigate('/laundry/orders');
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to save order');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>New Laundry Order</h1>
      </div>

      {/* Customer info */}
      <div className="rounded-2xl border p-5 space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Customer Details</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Name *</label>
            <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer name"
              className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Phone</label>
            <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Phone number"
              className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Promise Date</label>
            <input type="date" value={promisedDate} onChange={e => setPromisedDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Advance Paid (₹)</label>
            <input type="number" value={advance || ''} onChange={e => setAdvance(Number(e.target.value))} placeholder="0"
              className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any special instructions…" rows={2}
              className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none resize-none"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
          </div>
        </div>
      </div>

      {/* Services selection */}
      <div className="rounded-2xl border p-5 space-y-3" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Select Items</h2>
        {services.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: 'var(--text-tertiary)' }}>
            No services set up yet. <button onClick={() => navigate('/laundry/services')} className="underline" style={{ color: 'var(--accent)' }}>Add services →</button>
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {services.map(svc => {
              const inOrder = items.find(i => i.service_id === svc.id);
              return (
                <div key={svc.id} className="flex items-center justify-between p-3 rounded-xl border"
                  style={{ background: inOrder ? '#cffafe' : 'var(--surface-2)', borderColor: inOrder ? '#0891b2' : 'var(--surface-border)' }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{svc.item_name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{svc.service_type} · {fmt(svc.price)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {inOrder ? (
                      <>
                        <button onClick={() => changeQty(svc.id, -1)} className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: '#0891b2', color: 'white' }}>
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{inOrder.qty}</span>
                        <button onClick={() => changeQty(svc.id, 1)} className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: '#0891b2', color: 'white' }}>
                          <Plus className="h-3 w-3" />
                        </button>
                      </>
                    ) : (
                      <button onClick={() => addItem(svc)} className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent)', color: 'white' }}>
                        <Plus className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Order summary */}
      {items.length > 0 && (
        <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
          <h2 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Order Summary</h2>
          <div className="space-y-1 mb-3">
            {items.map(item => (
              <div key={item.service_id} className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-secondary)' }}>{item.qty}x {item.item_name} ({item.service_type})</span>
                <span style={{ color: 'var(--text-primary)' }}>{fmt(item.qty * item.price)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between font-bold text-base pt-3 border-t" style={{ borderColor: 'var(--surface-border)' }}>
            <span style={{ color: 'var(--text-primary)' }}>Total</span>
            <span style={{ color: 'var(--accent)' }}>{fmt(totalAmount)}</span>
          </div>
          {advance > 0 && (
            <div className="flex justify-between text-sm mt-1">
              <span style={{ color: 'var(--text-tertiary)' }}>Balance due</span>
              <span style={{ color: 'var(--text-primary)' }}>{fmt(totalAmount - advance)}</span>
            </div>
          )}
        </div>
      )}

      <button onClick={save} disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white disabled:opacity-50"
        style={{ background: 'var(--accent)' }}>
        <Save className="h-4 w-4" />
        {saving ? 'Saving…' : 'Create Order'}
      </button>
    </div>
  );
}

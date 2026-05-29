// [catering] [all tenants]
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Minus, Save, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { listCateringMenuItems, createCateringEvent, type CateringEventMenuItem } from '@/lib/db/catering';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

const EVENT_TYPES = ['Wedding', 'Birthday', 'Corporate', 'Pooja', 'Anniversary', 'Engagement', 'Other'];

export function CateringNewEventPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [eventType, setEventType] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [venue, setVenue] = useState('');
  const [guestCount, setGuestCount] = useState(0);
  const [advance, setAdvance] = useState(0);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'inquiry' | 'confirmed'>('confirmed');
  const [menuItems, setMenuItems] = useState<CateringEventMenuItem[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: availableItems = [] } = useQuery({
    queryKey: ['catering-menu', tenantId],
    queryFn: () => listCateringMenuItems(tenantId),
    enabled: !!tenantId,
  });

  const totalAmount = menuItems.reduce((s, i) => s + i.price_per_plate * i.qty * guestCount, 0);

  function toggleItem(item: { id: string; name: string; category: string; price_per_plate: number }) {
    const existing = menuItems.find(m => m.menu_item_id === item.id);
    if (existing) {
      setMenuItems(prev => prev.filter(m => m.menu_item_id !== item.id));
    } else {
      setMenuItems(prev => [...prev, { menu_item_id: item.id, name: item.name, category: item.category, price_per_plate: item.price_per_plate, qty: 1 }]);
    }
  }

  async function save() {
    if (!customerName.trim()) { toast.error('Customer name is required'); return; }
    if (!eventDate) { toast.error('Event date is required'); return; }
    setSaving(true);
    try {
      await createCateringEvent(tenantId, {
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        event_type: eventType,
        event_date: eventDate,
        venue: venue.trim(),
        guest_count: guestCount,
        menu: menuItems,
        total_amount: totalAmount,
        advance_paid: advance,
        status,
        notes: notes.trim(),
      });
      qc.invalidateQueries({ queryKey: ['catering-events'] });
      qc.invalidateQueries({ queryKey: ['catering-stats'] });
      toast.success('Event created!');
      navigate('/catering/events');
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to save event');
    } finally {
      setSaving(false);
    }
  }

  const categories = [...new Set(availableItems.map(i => i.category))];

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>New Catering Event</h1>
      </div>

      {/* Customer & event details */}
      <div className="rounded-2xl border p-5 space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Event Details</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Customer Name *</label>
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
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Event Type</label>
            <select value={eventType} onChange={e => setEventType(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}>
              <option value="">Select type…</option>
              {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Event Date *</label>
            <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Venue</label>
            <input value={venue} onChange={e => setVenue(e.target.value)} placeholder="Venue / location"
              className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Guest Count</label>
            <input type="number" value={guestCount || ''} onChange={e => setGuestCount(Number(e.target.value))} placeholder="0"
              className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Advance Paid (₹)</label>
            <input type="number" value={advance || ''} onChange={e => setAdvance(Number(e.target.value))} placeholder="0"
              className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as 'inquiry' | 'confirmed')}
              className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}>
              <option value="inquiry">Inquiry</option>
              <option value="confirmed">Confirmed</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Special requirements…" rows={2}
              className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none resize-none"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
          </div>
        </div>
      </div>

      {/* Menu selection */}
      <div className="rounded-2xl border p-5 space-y-3" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Menu Selection</h2>
        {availableItems.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: 'var(--text-tertiary)' }}>
            No menu items set up yet. <button onClick={() => navigate('/catering/menu')} className="underline" style={{ color: 'var(--accent)' }}>Add menu →</button>
          </p>
        ) : categories.map(cat => (
          <div key={cat}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-tertiary)' }}>{cat}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {availableItems.filter(i => i.category === cat).map(item => {
                const selected = menuItems.find(m => m.menu_item_id === item.id);
                return (
                  <button key={item.id} onClick={() => toggleItem(item)}
                    className="flex items-center justify-between p-3 rounded-xl border text-left transition-colors"
                    style={{ background: selected ? '#cffafe' : 'var(--surface-2)', borderColor: selected ? '#0891b2' : 'var(--surface-border)' }}>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{fmt(item.price_per_plate)}/plate</p>
                    </div>
                    <span className="text-sm" style={{ color: selected ? '#0891b2' : 'var(--text-tertiary)' }}>{selected ? '✓' : '+'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      {(menuItems.length > 0 || guestCount > 0) && (
        <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
          <h2 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Summary</h2>
          <div className="space-y-1 text-sm mb-3">
            {menuItems.map(item => (
              <div key={item.menu_item_id} className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>{item.name} × {guestCount} guests</span>
                <span style={{ color: 'var(--text-primary)' }}>{fmt(item.price_per_plate * guestCount)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between font-bold text-base pt-3 border-t" style={{ borderColor: 'var(--surface-border)' }}>
            <span style={{ color: 'var(--text-primary)' }}>Total ({guestCount} guests)</span>
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
        {saving ? 'Saving…' : 'Create Event'}
      </button>
    </div>
  );
}

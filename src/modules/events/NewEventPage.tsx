// [events] [all tenants]
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/app/store/app.store';
import { createEvent } from '@/lib/db/events';
import { toast } from 'sonner';

const EVENT_TYPES = ['Wedding', 'Birthday', 'Corporate', 'Baby Shower', 'Anniversary', 'Reception', 'Conference', 'Other'];

export function NewEventPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    client_name: '', client_phone: '', event_type: '', event_date: '',
    venue: '', guest_count: '', quoted_amount: '', advance_paid: '0',
    status: 'inquiry', notes: '', event_no: '',
  });

  const save = useMutation({
    mutationFn: () => createEvent(tenantId, {
      event_no: form.event_no, client_name: form.client_name, client_phone: form.client_phone,
      event_type: form.event_type, event_date: form.event_date, venue: form.venue,
      guest_count: parseInt(form.guest_count) || 0,
      quoted_amount: parseFloat(form.quoted_amount) || 0,
      advance_paid: parseFloat(form.advance_paid) || 0,
      status: form.status, notes: form.notes,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['event-stats'] });
      toast.success('Event created');
      navigate('/events/list');
    },
    onError: (e) => toast.error(String(e)),
  });

  const up = (key: string, value: string) => setForm(p => ({ ...p, [key]: value }));

  return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/events/list')} className="text-slate-400 hover:text-slate-700 text-sm">← Back</button>
        <h1 className="text-2xl font-bold text-slate-900">New Event</h1>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        {[
          { key: 'client_name', label: 'Client Name *', placeholder: 'Client / family name' },
          { key: 'client_phone', label: 'Phone', placeholder: '9xxxxxxxxx' },
          { key: 'event_date', label: 'Event Date *', type: 'date' },
          { key: 'venue', label: 'Venue', placeholder: 'Venue / location' },
          { key: 'guest_count', label: 'Guest Count', placeholder: '100', type: 'number' },
          { key: 'quoted_amount', label: 'Quoted Amount (₹)', placeholder: '50000', type: 'number' },
          { key: 'advance_paid', label: 'Advance Paid (₹)', placeholder: '10000', type: 'number' },
          { key: 'notes', label: 'Notes', placeholder: 'Any special requirements' },
        ].map(f => (
          <div key={f.key}>
            <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
            <input type={f.type ?? 'text'} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
              placeholder={f.placeholder} value={(form as Record<string, string>)[f.key]}
              onChange={e => up(f.key, e.target.value)} />
          </div>
        ))}

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Event Type</label>
          <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none" value={form.event_type} onChange={e => up('event_type', e.target.value)}>
            <option value="">— Select type —</option>
            {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
          <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none" value={form.status} onChange={e => up('status', e.target.value)}>
            {['inquiry', 'confirmed', 'completed', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <button onClick={() => save.mutate()} disabled={!form.client_name || !form.event_date || save.isPending}
          className="w-full py-3 rounded-xl bg-pink-600 text-white text-sm font-semibold hover:bg-pink-500 disabled:opacity-40 transition-colors">
          {save.isPending ? 'Saving…' : 'Create Event'}
        </button>
      </div>
    </div>
  );
}

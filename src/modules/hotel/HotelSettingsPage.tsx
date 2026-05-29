// [hotel] [all tenants]
import { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { toast } from 'sonner';

interface HotelSettings {
  hotel_name: string;
  address: string;
  phone: string;
  gst_number: string;
  default_check_in_time: string;
  default_check_out_time: string;
  extra_bed_rate: number;
  tax_rate: number;
  receipt_footer: string;
}

const DEFAULTS: HotelSettings = {
  hotel_name: '',
  address: '',
  phone: '',
  gst_number: '',
  default_check_in_time: '12:00',
  default_check_out_time: '11:00',
  extra_bed_rate: 500,
  tax_rate: 12,
  receipt_footer: 'Thank you for staying with us!',
};

const LS_KEY = 'hotel_settings';

export function HotelSettingsPage() {
  const shopName = useAppStore(s => s.config?.shop_name ?? '');
  const [form, setForm] = useState<HotelSettings>({ ...DEFAULTS, hotel_name: shopName });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setForm({ ...DEFAULTS, hotel_name: shopName, ...JSON.parse(raw) });
      else setForm(f => ({ ...f, hotel_name: shopName }));
    } catch { /* ignore */ }
  }, [shopName]);

  const up = (k: keyof HotelSettings, v: any) => setForm(f => ({ ...f, [k]: v }));

  function handleSave() {
    localStorage.setItem(LS_KEY, JSON.stringify(form));
    setSaved(true);
    toast.success('Hotel settings saved');
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Settings className="h-5 w-5 text-slate-600" />
        <h1 className="text-xl font-bold text-slate-900">Hotel Settings</h1>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
        <h2 className="font-semibold text-slate-800">Property Details</h2>
        <div className="grid grid-cols-1 gap-4">
          <div><label className="block text-xs font-medium text-slate-600 mb-1">Hotel Name</label><input className="input w-full" value={form.hotel_name} onChange={e => up('hotel_name', e.target.value)} /></div>
          <div><label className="block text-xs font-medium text-slate-600 mb-1">Address</label><textarea className="input w-full" rows={2} value={form.address} onChange={e => up('address', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Phone</label><input className="input w-full" value={form.phone} onChange={e => up('phone', e.target.value)} /></div>
            <div><label className="block text-xs font-medium text-slate-600 mb-1">GST Number</label><input className="input w-full" value={form.gst_number} onChange={e => up('gst_number', e.target.value)} placeholder="e.g. 27AABCU9603R1ZX" /></div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
        <h2 className="font-semibold text-slate-800">Check-in / Check-out</h2>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-xs font-medium text-slate-600 mb-1">Default Check-in Time</label><input type="time" className="input w-full" value={form.default_check_in_time} onChange={e => up('default_check_in_time', e.target.value)} /></div>
          <div><label className="block text-xs font-medium text-slate-600 mb-1">Default Check-out Time</label><input type="time" className="input w-full" value={form.default_check_out_time} onChange={e => up('default_check_out_time', e.target.value)} /></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
        <h2 className="font-semibold text-slate-800">Charges & Tax</h2>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-xs font-medium text-slate-600 mb-1">Extra Bed Rate (₹/night)</label><input type="number" min={0} className="input w-full" value={form.extra_bed_rate} onChange={e => up('extra_bed_rate', Number(e.target.value))} /></div>
          <div><label className="block text-xs font-medium text-slate-600 mb-1">GST / Tax Rate (%)</label><input type="number" min={0} max={100} className="input w-full" value={form.tax_rate} onChange={e => up('tax_rate', Number(e.target.value))} /></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <h2 className="font-semibold text-slate-800">Receipt</h2>
        <div><label className="block text-xs font-medium text-slate-600 mb-1">Footer Text</label><textarea className="input w-full" rows={2} value={form.receipt_footer} onChange={e => up('receipt_footer', e.target.value)} placeholder="Message printed on guest bills…" /></div>
      </div>

      <button onClick={handleSave} className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors ${saved ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
        {saved ? '✓ Saved' : 'Save Settings'}
      </button>
    </div>
  );
}

// [pestcontrol] [all tenants]
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, ArrowLeft, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { listPCCustomers, createPCJob, savePCCustomer } from '@/lib/db/pestcontrol';
import { now } from '@/lib/db/index';

const SERVICE_TYPES = ['Cockroach', 'Termite', 'Mosquito', 'Rodent', 'Bed Bug', 'General Pest', 'Bird', 'Other'];
const PEST_TYPES = ['German Cockroach', 'American Cockroach', 'Termite', 'Rats', 'Mosquito', 'Ants', 'Bed Bugs', 'Flies', 'Other'];
const PAYMENT_MODES = ['cash', 'upi', 'card', 'bank-transfer', 'cheque'];
const PROPERTY_TYPES = ['residential', 'commercial', 'industrial', 'restaurant', 'hotel', 'warehouse'];

export function PCNewJobPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Customer
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustPropertyType, setNewCustPropertyType] = useState('residential');

  // Job
  const [serviceType, setServiceType] = useState('');
  const [pestType, setPestType] = useState('');
  const [chemicalUsed, setChemicalUsed] = useState('');
  const [technician, setTechnician] = useState('');
  const [jobDate, setJobDate] = useState(now().substring(0, 10));
  const [nextServiceDate, setNextServiceDate] = useState('');
  const [amount, setAmount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState('cash');
  const [isAMC, setIsAMC] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: customers = [] } = useQuery({
    queryKey: ['pc-customers', tenantId, customerSearch],
    queryFn: () => listPCCustomers(tenantId, customerSearch),
    enabled: !!tenantId,
  });

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  async function createCustomerAndSelect() {
    if (!newCustName.trim() || !newCustAddress.trim()) { toast.error('Name and address required'); return; }
    const id = await savePCCustomer(tenantId, { name: newCustName.trim(), phone: newCustPhone.trim(), address: newCustAddress.trim(), property_type: newCustPropertyType });
    qc.invalidateQueries({ queryKey: ['pc-customers'] });
    setSelectedCustomerId(id);
    setShowNewCustomer(false);
    toast.success('Customer added');
  }

  async function save() {
    if (!selectedCustomerId) { toast.error('Select a customer'); return; }
    if (!serviceType) { toast.error('Select service type'); return; }
    if (!jobDate) { toast.error('Job date required'); return; }
    setSaving(true);
    try {
      await createPCJob(tenantId, {
        customer_id: selectedCustomerId,
        service_type: serviceType,
        pest_type: pestType,
        chemical_used: chemicalUsed,
        technician,
        job_date: jobDate,
        next_service_date: nextServiceDate || null,
        amount,
        paid_amount: paidAmount,
        payment_mode: paymentMode,
        status: 'scheduled',
        amc: isAMC ? 1 : 0,
        notes,
      });
      qc.invalidateQueries({ queryKey: ['pc-jobs'] });
      qc.invalidateQueries({ queryKey: ['pc-stats'] });
      toast.success('Job created!');
      navigate('/pestcontrol/jobs');
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const inp = "w-full px-3 py-2.5 rounded-xl border text-sm outline-none";
  const inpStyle = { background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>New Pest Control Job</h1>
      </div>

      {/* Customer selection */}
      <div className="rounded-2xl border p-5 space-y-3" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Customer</h2>
          <button onClick={() => setShowNewCustomer(!showNewCustomer)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl"
            style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
            <UserPlus className="h-3.5 w-3.5" />New Customer
          </button>
        </div>
        {showNewCustomer && (
          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl" style={{ background: 'var(--surface-2)' }}>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Name *</label>
              <input value={newCustName} onChange={e => setNewCustName(e.target.value)} placeholder="Customer name" className={inp} style={inpStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Phone</label>
              <input value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)} placeholder="Phone" className={inp} style={inpStyle} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Address *</label>
              <input value={newCustAddress} onChange={e => setNewCustAddress(e.target.value)} placeholder="Full address" className={inp} style={inpStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Property Type</label>
              <select value={newCustPropertyType} onChange={e => setNewCustPropertyType(e.target.value)} className={inp} style={inpStyle}>
                {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={createCustomerAndSelect} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>
                Add Customer
              </button>
            </div>
          </div>
        )}
        <input value={customerSearch} onChange={e => { setCustomerSearch(e.target.value); setSelectedCustomerId(''); }} placeholder="Search customer by name or phone…"
          className={inp} style={inpStyle} />
        {selectedCustomer ? (
          <div className="p-3 rounded-xl" style={{ background: '#dcfce7', border: '1px solid #86efac' }}>
            <p className="font-medium text-sm text-green-800">✓ {selectedCustomer.name}</p>
            <p className="text-xs text-green-700">{selectedCustomer.phone} · {selectedCustomer.address}</p>
          </div>
        ) : customerSearch && customers.length > 0 ? (
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {customers.map(c => (
              <button key={c.id} onClick={() => { setSelectedCustomerId(c.id); setCustomerSearch(c.name); }}
                className="w-full text-left p-2.5 rounded-xl text-sm transition-colors"
                style={{ background: 'var(--surface-2)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-border)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{c.phone} · {c.address}</p>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Job details */}
      <div className="rounded-2xl border p-5 space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Job Details</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Service Type *</label>
            <select value={serviceType} onChange={e => setServiceType(e.target.value)} className={inp} style={inpStyle}>
              <option value="">Select…</option>
              {SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Pest Type</label>
            <select value={pestType} onChange={e => setPestType(e.target.value)} className={inp} style={inpStyle}>
              <option value="">Select…</option>
              {PEST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Chemical Used</label>
            <input value={chemicalUsed} onChange={e => setChemicalUsed(e.target.value)} placeholder="Chemical name" className={inp} style={inpStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Technician</label>
            <input value={technician} onChange={e => setTechnician(e.target.value)} placeholder="Technician name" className={inp} style={inpStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Job Date *</label>
            <input type="date" value={jobDate} onChange={e => setJobDate(e.target.value)} className={inp} style={inpStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Next Service Date</label>
            <input type="date" value={nextServiceDate} onChange={e => setNextServiceDate(e.target.value)} className={inp} style={inpStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Amount (₹)</label>
            <input type="number" value={amount || ''} onChange={e => setAmount(Number(e.target.value))} placeholder="0" className={inp} style={inpStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Paid Amount (₹)</label>
            <input type="number" value={paidAmount || ''} onChange={e => setPaidAmount(Number(e.target.value))} placeholder="0" className={inp} style={inpStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Payment Mode</label>
            <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} className={inp} style={inpStyle}>
              {PAYMENT_MODES.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3 py-2">
            <input type="checkbox" id="amc" checked={isAMC} onChange={e => setIsAMC(e.target.checked)} className="h-4 w-4" />
            <label htmlFor="amc" className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>AMC Contract</label>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any special instructions…" rows={2}
              className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none resize-none"
              style={inpStyle} />
          </div>
        </div>
      </div>

      <button onClick={save} disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white disabled:opacity-50"
        style={{ background: 'var(--accent)' }}>
        <Save className="h-4 w-4" />
        {saving ? 'Saving…' : 'Create Job'}
      </button>
    </div>
  );
}

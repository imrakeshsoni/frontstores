// [tailor] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Trash2, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { listTailorCustomers, saveTailorCustomer, deleteTailorCustomer, type TailorCustomer } from '@/lib/db/tailor';

const MEASUREMENT_FIELDS = [
  'Chest', 'Waist', 'Hip', 'Shoulder', 'Sleeve Length', 'Body Length',
  'Neck', 'Inseam', 'Thigh', 'Wrist',
];

export function MeasurementsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<TailorCustomer | null>(null);
  const [editing, setEditing] = useState(false);
  const [measurements, setMeasurements] = useState<Record<string, string>>({});
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const { data: customers = [] } = useQuery({
    queryKey: ['tailor-customers', tenantId, search],
    queryFn: () => listTailorCustomers(tenantId, { search: search || undefined }),
    enabled: !!tenantId,
  });

  const saveCustomer = useMutation({
    mutationFn: (data: Partial<TailorCustomer> & { name: string }) =>
      saveTailorCustomer(tenantId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tailor-customers'] });
      toast.success('Customer saved');
      setEditing(false);
      setShowAdd(false);
      setNewName('');
      setNewPhone('');
    },
  });

  const deleteCustomer = useMutation({
    mutationFn: (id: string) => deleteTailorCustomer(tenantId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tailor-customers'] });
      setSelected(null);
      toast.success('Customer deleted');
    },
  });

  function selectCustomer(c: TailorCustomer) {
    setSelected(c);
    setMeasurements(c.measurements);
    setEditName(c.name);
    setEditPhone(c.phone);
    setEditNotes(c.notes);
    setEditing(false);
  }

  function handleSaveMeasurements() {
    if (!selected) return;
    saveCustomer.mutate({
      id: selected.id,
      name: editName,
      phone: editPhone,
      notes: editNotes,
      measurements,
    });
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Measurements Directory</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: '#7c3aed' }}
        >
          <Plus className="h-4 w-4" /> Add Customer
        </button>
      </div>

      {showAdd && (
        <div className="bg-purple-50 border border-purple-100 rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold text-slate-900">New Customer</h2>
          <input
            placeholder="Name *"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none"
          />
          <input
            placeholder="Phone"
            value={newPhone}
            onChange={e => setNewPhone(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none"
          />
          <div className="flex gap-3">
            <button
              onClick={() => saveCustomer.mutate({ name: newName, phone: newPhone })}
              disabled={!newName.trim()}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: '#7c3aed' }}
            >
              Save
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl text-sm text-slate-500 hover:bg-slate-100">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search customers…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Customer list */}
        <div className="lg:col-span-1 space-y-2">
          {customers.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">No customers yet</p>
          ) : customers.map(c => (
            <button
              key={c.id}
              onClick={() => selectCustomer(c)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${selected?.id === c.id ? 'border-purple-200 bg-purple-50' : 'border-slate-100 bg-white hover:bg-slate-50'}`}
            >
              <p className="font-medium text-slate-900">{c.name}</p>
              <p className="text-xs text-slate-400">{c.phone || 'No phone'}</p>
              {Object.keys(c.measurements).filter(k => c.measurements[k]).length > 0 && (
                <p className="text-xs text-purple-600 mt-0.5">
                  {Object.keys(c.measurements).filter(k => c.measurements[k]).length} measurements saved
                </p>
              )}
            </button>
          ))}
        </div>

        {/* Measurement detail */}
        {selected && (
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                {editing ? (
                  <div className="space-y-2">
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold"
                    />
                    <input
                      value={editPhone}
                      onChange={e => setEditPhone(e.target.value)}
                      placeholder="Phone"
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm"
                    />
                  </div>
                ) : (
                  <>
                    <h2 className="font-semibold text-slate-900">{selected.name}</h2>
                    <p className="text-sm text-slate-500">{selected.phone}</p>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditing(!editing)}
                  className="p-2 rounded-xl hover:bg-slate-100 text-slate-500"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => { if (confirm('Delete customer?')) deleteCustomer.mutate(selected.id); }}
                  className="p-2 rounded-xl hover:bg-red-50 text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {MEASUREMENT_FIELDS.map(field => (
                <div key={field}>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{field} (inches)</label>
                  <input
                    type="number"
                    value={measurements[field] ?? ''}
                    onChange={e => setMeasurements(prev => ({ ...prev, [field]: e.target.value }))}
                    placeholder="0.0"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none"
                  />
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
              <textarea
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                rows={2}
                placeholder="Any notes…"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none resize-none"
              />
            </div>

            <button
              onClick={handleSaveMeasurements}
              disabled={saveCustomer.isPending}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: '#7c3aed' }}
            >
              {saveCustomer.isPending ? 'Saving…' : 'Save Measurements'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

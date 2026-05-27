// [clinic] [all tenants]
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAppStore } from '@/app/store/app.store';
import {
  searchPatients, listDoctors, getTodayTokens,
  createVisit, listClinicMedicines,
  type ClinicPrescriptionItem,
} from '@/lib/db/clinic';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { appCacheDir } from '@tauri-apps/api/path';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { open as shellOpen } from '@tauri-apps/plugin-shell';

type RxItem = { medicine_name: string; dosage: string; frequency: string; duration: string; instructions: string; quantity: string };
type Vitals = { bp_systolic: string; bp_diastolic: string; pulse: string; temperature: string; spo2: string; weight: string; height: string; blood_sugar: string };

const emptyRx = (): RxItem => ({ medicine_name: '', dosage: '', frequency: '', duration: '', instructions: '', quantity: '' });
const emptyVitals = (): Vitals => ({ bp_systolic: '', bp_diastolic: '', pulse: '', temperature: '', spo2: '', weight: '', height: '', blood_sugar: '' });

const FREQ_OPTIONS = ['Once daily', 'Twice daily', 'Three times daily', 'Four times daily', 'Every 8 hours', 'Every 6 hours', 'As needed (SOS)', 'At bedtime', 'Before meals', 'After meals'];
const DURATION_OPTIONS = ['3 days', '5 days', '7 days', '10 days', '14 days', '1 month', '2 months', '3 months', 'Continue'];

export function VisitPage() {
  const { config } = useAppStore();
  const tid = config?.tenant_id ?? '';
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const prePatientId = sp.get('patient') ?? '';
  const preTokenId = sp.get('token') ?? '';

  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [selectedToken, setSelectedToken] = useState<any>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);

  const [chiefComplaint, setChiefComplaint] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');

  const [vitals, setVitals] = useState<Vitals>(emptyVitals());
  const [rxItems, setRxItems] = useState<RxItem[]>([emptyRx()]);
  const [labTests, setLabTests] = useState<string[]>(['']);
  const [medSearch, setMedSearch] = useState('');
  const [medSearchIdx, setMedSearchIdx] = useState<number | null>(null);

  const { data: patients = [] } = useQuery({
    queryKey: ['clinic-patients-search', tid, patientSearch],
    queryFn: () => searchPatients(tid, patientSearch, 8),
    enabled: patientSearch.length >= 2,
  });
  const { data: doctors = [] } = useQuery({
    queryKey: ['clinic-doctors', tid],
    queryFn: () => listDoctors(tid),
  });
  const { data: tokens = [] } = useQuery({
    queryKey: ['clinic-tokens', tid],
    queryFn: () => getTodayTokens(tid),
    enabled: !prePatientId,
  });
  const { data: medicines = [] } = useQuery({
    queryKey: ['clinic-medicines-search', tid, medSearch],
    queryFn: () => listClinicMedicines(tid, medSearch),
    enabled: medSearch.length >= 2,
  });

  // Auto-load patient from URL param
  useEffect(() => {
    if (!prePatientId) return;
    searchPatients(tid, prePatientId, 1).then(r => { if (r[0]) setSelectedPatient(r[0]); });
  }, [prePatientId, tid]);

  // Auto-load token
  useEffect(() => {
    if (!preTokenId || tokens.length === 0) return;
    const t = tokens.find(tk => tk.id === preTokenId);
    if (t) {
      setSelectedToken(t);
      if (t.patient_name && !selectedPatient) {
        searchPatients(tid, t.patient_name, 1).then(r => { if (r[0]) setSelectedPatient(r[0]); });
      }
    }
  }, [preTokenId, tokens]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!selectedPatient) throw new Error('Please select a patient');
      const v = vitals;
      return createVisit(tid, {
        patient_id: selectedPatient.id,
        patient_name: selectedPatient.name,
        doctor_id: selectedDoctor?.id,
        doctor_name: selectedDoctor?.name,
        token_id: selectedToken?.id,
        chief_complaint: chiefComplaint.trim() || undefined,
        diagnosis: diagnosis.trim() || undefined,
        notes: notes.trim() || undefined,
        follow_up_date: followUpDate || undefined,
        follow_up_notes: followUpNotes.trim() || undefined,
        vitals: {
          bp_systolic: v.bp_systolic ? Number(v.bp_systolic) : undefined,
          bp_diastolic: v.bp_diastolic ? Number(v.bp_diastolic) : undefined,
          pulse: v.pulse ? Number(v.pulse) : undefined,
          temperature: v.temperature ? Number(v.temperature) : undefined,
          spo2: v.spo2 ? Number(v.spo2) : undefined,
          weight: v.weight ? Number(v.weight) : undefined,
          height: v.height ? Number(v.height) : undefined,
          blood_sugar: v.blood_sugar ? Number(v.blood_sugar) : undefined,
        },
        prescription_items: rxItems.filter(r => r.medicine_name.trim()).map(r => ({
          medicine_name: r.medicine_name,
          dosage: r.dosage || undefined,
          frequency: r.frequency || undefined,
          duration: r.duration || undefined,
          instructions: r.instructions || undefined,
          quantity: r.quantity ? Number(r.quantity) : undefined,
        })),
        lab_orders: labTests.filter(t => t.trim()),
      });
    },
    onSuccess: (visit) => {
      toast.success('Visit saved!');
      handlePrint(visit);
      navigate('/clinic/dashboard');
    },
    onError: (e) => toast.error(String(e)),
  });

  async function handlePrint(visit: any) {
    const shopName = config?.shop_name ?? 'Clinic';
    const doctorLine = selectedDoctor ? `Dr. ${selectedDoctor.name}${selectedDoctor.specialization ? `, ${selectedDoctor.specialization}` : ''}` : '';
    const rxRows = rxItems.filter(r => r.medicine_name.trim()).map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${r.medicine_name}</strong>${r.dosage ? ` (${r.dosage})` : ''}</td>
        <td>${r.frequency || '—'}</td>
        <td>${r.duration || '—'}</td>
        <td>${r.instructions || '—'}</td>
      </tr>`).join('');
    const labRows = labTests.filter(t => t.trim()).map(t => `<li>${t}</li>`).join('');
    const html = `<!DOCTYPE html><html><head><title>Prescription</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; padding: 20px; max-width: 800px; margin: 0 auto; }
  .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 12px; }
  .header h1 { margin: 0; font-size: 20px; } .header p { margin: 2px 0; color: #555; }
  .patient-info { background: #f5f5f5; padding: 10px; border-radius: 6px; margin-bottom: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
  .vitals-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 6px; margin-bottom: 12px; }
  .vital-box { background: #f0f9ff; border-radius: 6px; padding: 6px; text-align: center; }
  .vital-box .label { font-size: 10px; color: #666; } .vital-box .val { font-size: 14px; font-weight: bold; color: #1d4ed8; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th { background: #1d4ed8; color: white; padding: 6px 8px; text-align: left; font-size: 11px; }
  td { padding: 5px 8px; border-bottom: 1px solid #eee; }
  tr:nth-child(even) { background: #f8f8f8; }
  .rx-symbol { font-size: 28px; color: #1d4ed8; font-weight: bold; margin-bottom: 4px; }
  .section { margin-bottom: 10px; } .section-title { font-weight: bold; font-size: 11px; color: #555; text-transform: uppercase; margin-bottom: 4px; }
  .footer { margin-top: 30px; display: flex; justify-content: space-between; border-top: 1px solid #ccc; padding-top: 10px; }
  @media print { body { padding: 10px; } }
</style></head><body onload="window.print()">
<div class="header">
  <h1>${shopName}</h1>
  ${doctorLine ? `<p>${doctorLine}</p>` : ''}
  ${config?.phone ? `<p>📞 ${config.phone}</p>` : ''}
  ${config?.address_line1 ? `<p>${config.address_line1}, ${config.city || ''}</p>` : ''}
</div>
<div class="patient-info">
  <div><strong>Patient:</strong> ${selectedPatient?.name}</div>
  <div><strong>UHID:</strong> ${selectedPatient?.patient_no}</div>
  <div><strong>Age/Gender:</strong> ${selectedPatient?.age ? `${selectedPatient.age} ${selectedPatient.age_unit}` : '—'} / ${selectedPatient?.gender ?? '—'}</div>
  <div><strong>Date:</strong> ${new Date().toLocaleDateString('en-IN')}</div>
  ${visit.chief_complaint ? `<div class="col-span-2"><strong>Chief Complaint:</strong> ${visit.chief_complaint}</div>` : ''}
  ${visit.diagnosis ? `<div class="col-span-2"><strong>Diagnosis:</strong> <strong>${visit.diagnosis}</strong></div>` : ''}
</div>
${Object.values(vitals).some(v => v) ? `
<div class="vitals-grid">
  ${vitals.bp_systolic && vitals.bp_diastolic ? `<div class="vital-box"><div class="label">BP</div><div class="val">${vitals.bp_systolic}/${vitals.bp_diastolic}</div></div>` : ''}
  ${vitals.pulse ? `<div class="vital-box"><div class="label">Pulse</div><div class="val">${vitals.pulse}/min</div></div>` : ''}
  ${vitals.temperature ? `<div class="vital-box"><div class="label">Temp</div><div class="val">${vitals.temperature}°F</div></div>` : ''}
  ${vitals.spo2 ? `<div class="vital-box"><div class="label">SpO2</div><div class="val">${vitals.spo2}%</div></div>` : ''}
  ${vitals.weight ? `<div class="vital-box"><div class="label">Weight</div><div class="val">${vitals.weight} kg</div></div>` : ''}
  ${vitals.blood_sugar ? `<div class="vital-box"><div class="label">Blood Sugar</div><div class="val">${vitals.blood_sugar}</div></div>` : ''}
</div>` : ''}
${rxRows ? `<div class="rx-symbol">℞</div>
<table><thead><tr><th>#</th><th>Medicine</th><th>Frequency</th><th>Duration</th><th>Instructions</th></tr></thead>
<tbody>${rxRows}</tbody></table>` : ''}
${labRows ? `<div class="section"><div class="section-title">Lab Tests Ordered</div><ul>${labRows}</ul></div>` : ''}
${notes ? `<div class="section"><div class="section-title">Notes</div><p>${notes}</p></div>` : ''}
${followUpDate ? `<div class="section"><div class="section-title">Follow Up</div><p>${followUpDate}${followUpNotes ? ` — ${followUpNotes}` : ''}</p></div>` : ''}
<div class="footer"><span>Patient signature: ___________</span><span>Doctor signature: ___________</span></div>
</body></html>`;
    try {
      const dir = await appCacheDir();
      const path = `${dir}/clinic_rx_${Date.now()}.html`;
      await writeTextFile(path, html);
      await shellOpen(path);
    } catch {}
  }

  const v = (field: keyof Vitals, label: string, unit = '') => (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}{unit && <span style={{ color: 'var(--text-tertiary)' }}> ({unit})</span>}</label>
      <input type="number" value={vitals[field]} onChange={e => setVitals(vv => ({ ...vv, [field]: e.target.value }))}
        className="w-full rounded-xl px-3 py-2 text-sm"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }} />
    </div>
  );

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>New Visit / Consultation</h1>
        <button onClick={() => navigate(-1)} className="text-sm" style={{ color: 'var(--text-secondary)' }}>← Back</button>
      </div>

      {/* Patient + Doctor */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Patient & Doctor</h2>
        <div className="grid grid-cols-2 gap-4">
          {/* Patient Search */}
          <div className="col-span-2 lg:col-span-1">
            {selectedPatient ? (
              <div className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: 'var(--surface-2)', border: '1px solid var(--accent)' }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{selectedPatient.name}</p>
                  <p className="text-xs" style={{ color: 'var(--accent)' }}>{selectedPatient.patient_no} · {selectedPatient.age ? `${selectedPatient.age} ${selectedPatient.age_unit}` : ''} {selectedPatient.gender ?? ''}</p>
                </div>
                <button onClick={() => setSelectedPatient(null)} className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Change</button>
              </div>
            ) : (
              <div className="relative">
                <input placeholder="Search patient by name or phone…" value={patientSearch}
                  onChange={e => setPatientSearch(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }} />
                {patients.length > 0 && patientSearch.length >= 2 && (
                  <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl shadow-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
                    {patients.map(p => (
                      <button key={p.id} onClick={() => { setSelectedPatient(p); setPatientSearch(''); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b last:border-b-0"
                        style={{ borderColor: 'var(--surface-border)' }}>
                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</span>
                        <span className="ml-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>{p.patient_no} · {p.phone ?? ''}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Doctor */}
          <div>
            <select value={selectedDoctor?.id ?? ''} onChange={e => setSelectedDoctor(doctors.find(d => d.id === e.target.value) ?? null)}
              className="w-full rounded-xl px-3 py-2.5 text-sm"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }}>
              <option value="">Select Doctor</option>
              {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.name}{d.specialization ? ` (${d.specialization})` : ''}</option>)}
            </select>
          </div>
          {/* Token */}
          {!preTokenId && tokens.filter(t => t.status !== 'done').length > 0 && (
            <div>
              <select value={selectedToken?.id ?? ''} onChange={e => setSelectedToken(tokens.find(t => t.id === e.target.value) ?? null)}
                className="w-full rounded-xl px-3 py-2.5 text-sm"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }}>
                <option value="">Link to Token (optional)</option>
                {tokens.filter(t => t.status !== 'done').map(t => <option key={t.id} value={t.id}>#{t.token_no} — {t.patient_name || 'Walk-in'}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Chief Complaint + Diagnosis */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Clinical Notes</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 lg:col-span-1">
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Chief Complaint</label>
            <textarea value={chiefComplaint} onChange={e => setChiefComplaint(e.target.value)}
              placeholder="Patient's main complaint…" rows={2}
              className="w-full rounded-xl px-3 py-2 text-sm resize-none"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }} />
          </div>
          <div className="col-span-2 lg:col-span-1">
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Diagnosis</label>
            <textarea value={diagnosis} onChange={e => setDiagnosis(e.target.value)}
              placeholder="Final diagnosis…" rows={2}
              className="w-full rounded-xl px-3 py-2 text-sm resize-none"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Doctor Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Internal notes…" rows={2}
              className="w-full rounded-xl px-3 py-2 text-sm resize-none"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }} />
          </div>
        </div>
      </div>

      {/* Vitals */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Vitals</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Blood Pressure</label>
            <div className="flex gap-2 items-center">
              <input type="number" placeholder="Systolic" value={vitals.bp_systolic}
                onChange={e => setVitals(vv => ({ ...vv, bp_systolic: e.target.value }))}
                className="flex-1 rounded-xl px-3 py-2 text-sm"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }} />
              <span style={{ color: 'var(--text-tertiary)' }}>/</span>
              <input type="number" placeholder="Diastolic" value={vitals.bp_diastolic}
                onChange={e => setVitals(vv => ({ ...vv, bp_diastolic: e.target.value }))}
                className="flex-1 rounded-xl px-3 py-2 text-sm"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }} />
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>mmHg</span>
            </div>
          </div>
          {v('pulse', 'Pulse', '/min')}
          {v('temperature', 'Temperature', '°F')}
          {v('spo2', 'SpO2', '%')}
          {v('weight', 'Weight', 'kg')}
          {v('height', 'Height', 'cm')}
          {v('blood_sugar', 'Blood Sugar', 'mg/dL')}
        </div>
      </div>

      {/* Prescription */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>℞ Prescription</h2>
          <button onClick={() => setRxItems(r => [...r, emptyRx()])}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg text-white" style={{ background: 'var(--accent)' }}>
            <Plus className="h-3 w-3" /> Add Medicine
          </button>
        </div>
        <div className="space-y-3">
          {rxItems.map((rx, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-start">
              <div className="col-span-12 lg:col-span-3 relative">
                <input placeholder="Medicine name…" value={rx.medicine_name}
                  onChange={e => {
                    const v = e.target.value;
                    setRxItems(r => r.map((x, j) => j === i ? { ...x, medicine_name: v } : x));
                    setMedSearch(v); setMedSearchIdx(i);
                  }}
                  className="w-full rounded-xl px-3 py-2 text-sm"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }} />
                {medSearchIdx === i && medicines.length > 0 && rx.medicine_name.length >= 2 && (
                  <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl shadow-lg overflow-hidden"
                    style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
                    {medicines.slice(0, 5).map(m => (
                      <button key={m.id} onClick={() => {
                        setRxItems(r => r.map((x, j) => j === i ? { ...x, medicine_name: `${m.name}${m.strength ? ` ${m.strength}` : ''}` } : x));
                        setMedSearchIdx(null); setMedSearch('');
                      }} className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 border-b last:border-b-0"
                        style={{ borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}>
                        {m.name} {m.strength ?? ''} ({m.form ?? m.unit})
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="col-span-4 lg:col-span-2">
                <input placeholder="Dosage" value={rx.dosage}
                  onChange={e => setRxItems(r => r.map((x, j) => j === i ? { ...x, dosage: e.target.value } : x))}
                  className="w-full rounded-xl px-3 py-2 text-sm"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }} />
              </div>
              <div className="col-span-8 lg:col-span-3">
                <select value={rx.frequency}
                  onChange={e => setRxItems(r => r.map((x, j) => j === i ? { ...x, frequency: e.target.value } : x))}
                  className="w-full rounded-xl px-3 py-2 text-sm"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }}>
                  <option value="">Frequency</option>
                  {FREQ_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="col-span-6 lg:col-span-2">
                <select value={rx.duration}
                  onChange={e => setRxItems(r => r.map((x, j) => j === i ? { ...x, duration: e.target.value } : x))}
                  className="w-full rounded-xl px-3 py-2 text-sm"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }}>
                  <option value="">Duration</option>
                  {DURATION_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="col-span-5 lg:col-span-1">
                <button onClick={() => setRxItems(r => r.filter((_, j) => j !== i))}
                  className="w-full py-2 rounded-xl flex items-center justify-center"
                  style={{ background: '#fee2e2', color: '#dc2626' }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lab Orders */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Lab / Investigation Orders</h2>
          <button onClick={() => setLabTests(t => [...t, ''])}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg text-white" style={{ background: '#ca8a04' }}>
            <Plus className="h-3 w-3" /> Add Test
          </button>
        </div>
        <div className="space-y-2">
          {labTests.map((t, i) => (
            <div key={i} className="flex gap-2">
              <input placeholder="Test name (e.g. CBC, LFT, X-Ray chest)" value={t}
                onChange={e => setLabTests(ts => ts.map((v, j) => j === i ? e.target.value : v))}
                className="flex-1 rounded-xl px-3 py-2 text-sm"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }} />
              <button onClick={() => setLabTests(ts => ts.filter((_, j) => j !== i))}
                className="px-3 py-2 rounded-xl" style={{ background: '#fee2e2', color: '#dc2626' }}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Follow Up */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Follow Up</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Follow Up Date</label>
            <input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)}
              className="w-full rounded-xl px-3 py-2 text-sm"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Follow Up Note</label>
            <input placeholder="e.g. Review reports" value={followUpNotes} onChange={e => setFollowUpNotes(e.target.value)}
              className="w-full rounded-xl px-3 py-2 text-sm"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }} />
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex gap-3 pb-6">
        <button onClick={() => navigate(-1)} className="flex-1 py-3 rounded-2xl text-sm border"
          style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>
          Cancel
        </button>
        <button onClick={() => saveMut.mutate()}
          disabled={!selectedPatient || saveMut.isPending}
          className="flex-2 px-8 py-3 rounded-2xl text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: 'var(--accent)' }}>
          {saveMut.isPending ? 'Saving…' : 'Save Visit & Print Rx'}
        </button>
      </div>
    </div>
  );
}

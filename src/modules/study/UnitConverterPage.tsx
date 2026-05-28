// [study] [all tenants]
import { useState } from 'react';
import { ArrowLeftRight, Calculator } from 'lucide-react';

interface Unit { label: string; toBase: (v: number) => number; fromBase: (v: number) => number; }
interface Category { name: string; icon: string; units: Unit[]; }

const CATEGORIES: Category[] = [
  { name: 'Length', icon: '📏', units: [
    { label: 'Metre (m)', toBase: v => v, fromBase: v => v },
    { label: 'Kilometre (km)', toBase: v => v * 1000, fromBase: v => v / 1000 },
    { label: 'Centimetre (cm)', toBase: v => v / 100, fromBase: v => v * 100 },
    { label: 'Millimetre (mm)', toBase: v => v / 1000, fromBase: v => v * 1000 },
    { label: 'Mile', toBase: v => v * 1609.344, fromBase: v => v / 1609.344 },
    { label: 'Foot (ft)', toBase: v => v * 0.3048, fromBase: v => v / 0.3048 },
    { label: 'Inch (in)', toBase: v => v * 0.0254, fromBase: v => v / 0.0254 },
    { label: 'Nanometre (nm)', toBase: v => v * 1e-9, fromBase: v => v * 1e9 },
    { label: 'Ångström (Å)', toBase: v => v * 1e-10, fromBase: v => v * 1e10 },
  ]},
  { name: 'Mass', icon: '⚖️', units: [
    { label: 'Kilogram (kg)', toBase: v => v, fromBase: v => v },
    { label: 'Gram (g)', toBase: v => v / 1000, fromBase: v => v * 1000 },
    { label: 'Milligram (mg)', toBase: v => v * 1e-6, fromBase: v => v * 1e6 },
    { label: 'Tonne (t)', toBase: v => v * 1000, fromBase: v => v / 1000 },
    { label: 'Pound (lb)', toBase: v => v * 0.453592, fromBase: v => v / 0.453592 },
    { label: 'Ounce (oz)', toBase: v => v * 0.0283495, fromBase: v => v / 0.0283495 },
    { label: 'Atomic mass unit (u)', toBase: v => v * 1.66054e-27, fromBase: v => v / 1.66054e-27 },
  ]},
  { name: 'Temperature', icon: '🌡️', units: [
    { label: 'Celsius (°C)', toBase: v => v, fromBase: v => v },
    { label: 'Kelvin (K)', toBase: v => v - 273.15, fromBase: v => v + 273.15 },
    { label: 'Fahrenheit (°F)', toBase: v => (v - 32) * 5 / 9, fromBase: v => v * 9 / 5 + 32 },
  ]},
  { name: 'Time', icon: '⏰', units: [
    { label: 'Second (s)', toBase: v => v, fromBase: v => v },
    { label: 'Millisecond (ms)', toBase: v => v / 1000, fromBase: v => v * 1000 },
    { label: 'Microsecond (μs)', toBase: v => v * 1e-6, fromBase: v => v * 1e6 },
    { label: 'Minute (min)', toBase: v => v * 60, fromBase: v => v / 60 },
    { label: 'Hour (h)', toBase: v => v * 3600, fromBase: v => v / 3600 },
    { label: 'Day', toBase: v => v * 86400, fromBase: v => v / 86400 },
    { label: 'Year', toBase: v => v * 31536000, fromBase: v => v / 31536000 },
  ]},
  { name: 'Speed', icon: '🚀', units: [
    { label: 'm/s', toBase: v => v, fromBase: v => v },
    { label: 'km/h', toBase: v => v / 3.6, fromBase: v => v * 3.6 },
    { label: 'mph', toBase: v => v * 0.44704, fromBase: v => v / 0.44704 },
    { label: 'knot', toBase: v => v * 0.514444, fromBase: v => v / 0.514444 },
    { label: 'Mach (at sea level)', toBase: v => v * 343, fromBase: v => v / 343 },
  ]},
  { name: 'Pressure', icon: '🔵', units: [
    { label: 'Pascal (Pa)', toBase: v => v, fromBase: v => v },
    { label: 'kilopascal (kPa)', toBase: v => v * 1000, fromBase: v => v / 1000 },
    { label: 'Atmosphere (atm)', toBase: v => v * 101325, fromBase: v => v / 101325 },
    { label: 'Bar', toBase: v => v * 1e5, fromBase: v => v / 1e5 },
    { label: 'mmHg (torr)', toBase: v => v * 133.322, fromBase: v => v / 133.322 },
    { label: 'psi', toBase: v => v * 6894.76, fromBase: v => v / 6894.76 },
  ]},
  { name: 'Energy', icon: '⚡', units: [
    { label: 'Joule (J)', toBase: v => v, fromBase: v => v },
    { label: 'kilojoule (kJ)', toBase: v => v * 1000, fromBase: v => v / 1000 },
    { label: 'Calorie (cal)', toBase: v => v * 4.184, fromBase: v => v / 4.184 },
    { label: 'kilocalorie (kcal)', toBase: v => v * 4184, fromBase: v => v / 4184 },
    { label: 'Electronvolt (eV)', toBase: v => v * 1.60218e-19, fromBase: v => v / 1.60218e-19 },
    { label: 'kWh', toBase: v => v * 3.6e6, fromBase: v => v / 3.6e6 },
  ]},
  { name: 'Amount (Moles)', icon: '🧪', units: [
    { label: 'Mole (mol)', toBase: v => v, fromBase: v => v },
    { label: 'Millimole (mmol)', toBase: v => v / 1000, fromBase: v => v * 1000 },
    { label: 'Molecules (×10²³)', toBase: v => v * 6.022, fromBase: v => v / 6.022 },
  ]},
  { name: 'Volume', icon: '🧊', units: [
    { label: 'Litre (L)', toBase: v => v, fromBase: v => v },
    { label: 'Millilitre (mL)', toBase: v => v / 1000, fromBase: v => v * 1000 },
    { label: 'Cubic metre (m³)', toBase: v => v * 1000, fromBase: v => v / 1000 },
    { label: 'Cubic cm (cm³)', toBase: v => v / 1000, fromBase: v => v * 1000 },
    { label: 'Gallon (US)', toBase: v => v * 3.78541, fromBase: v => v / 3.78541 },
    { label: 'Fluid ounce (fl oz)', toBase: v => v * 0.0295735, fromBase: v => v / 0.0295735 },
  ]},
  { name: 'Area', icon: '📐', units: [
    { label: 'Square metre (m²)', toBase: v => v, fromBase: v => v },
    { label: 'Square km (km²)', toBase: v => v * 1e6, fromBase: v => v / 1e6 },
    { label: 'Square cm (cm²)', toBase: v => v / 1e4, fromBase: v => v * 1e4 },
    { label: 'Hectare (ha)', toBase: v => v * 1e4, fromBase: v => v / 1e4 },
    { label: 'Acre', toBase: v => v * 4046.86, fromBase: v => v / 4046.86 },
    { label: 'Square foot (ft²)', toBase: v => v * 0.0929, fromBase: v => v / 0.0929 },
  ]},
];

function fmt(n: number): string {
  if (!isFinite(n)) return '—';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e9 || (abs > 0 && abs < 1e-6)) return n.toExponential(4);
  if (Number.isInteger(n)) return n.toString();
  return parseFloat(n.toPrecision(8)).toString();
}

export function UnitConverterPage() {
  const [activeCat, setActiveCat] = useState(0);
  const [fromIdx, setFromIdx] = useState(0);
  const [toIdx, setToIdx] = useState(1);
  const [inputVal, setInputVal] = useState('1');

  const cat = CATEGORIES[activeCat];
  const fromUnit = cat.units[fromIdx];
  const toUnit = cat.units[toIdx];
  const numInput = parseFloat(inputVal);
  const result = isNaN(numInput) ? null : toUnit.fromBase(fromUnit.toBase(numInput));

  const swap = () => { setFromIdx(toIdx); setToIdx(fromIdx); };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: '#dcfce7' }}>
          <Calculator className="h-5 w-5" style={{ color: '#16a34a' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Unit Converter</h1>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Physics, Chemistry, Math — all units offline</p>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((c, i) => (
          <button key={c.name} onClick={() => { setActiveCat(i); setFromIdx(0); setToIdx(1); }}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold"
            style={activeCat === i ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
            <span>{c.icon}</span>{c.name}
          </button>
        ))}
      </div>

      {/* Converter card */}
      <div className="rounded-2xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{cat.icon} {cat.name}</h2>

        {/* From */}
        <div className="space-y-2">
          <label className="text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>FROM</label>
          <select value={fromIdx} onChange={e => setFromIdx(Number(e.target.value))}
            className="w-full px-4 py-3 rounded-xl text-sm border outline-none"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}>
            {cat.units.map((u, i) => <option key={u.label} value={i}>{u.label}</option>)}
          </select>
          <input type="number" value={inputVal} onChange={e => setInputVal(e.target.value)}
            className="w-full px-4 py-4 rounded-xl text-2xl font-bold border outline-none text-center"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
        </div>

        {/* Swap button */}
        <div className="flex justify-center">
          <button onClick={swap} className="h-10 w-10 rounded-full flex items-center justify-center text-white" style={{ background: 'var(--accent)' }}>
            <ArrowLeftRight className="h-5 w-5" />
          </button>
        </div>

        {/* To */}
        <div className="space-y-2">
          <label className="text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>TO</label>
          <select value={toIdx} onChange={e => setToIdx(Number(e.target.value))}
            className="w-full px-4 py-3 rounded-xl text-sm border outline-none"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}>
            {cat.units.map((u, i) => <option key={u.label} value={i}>{u.label}</option>)}
          </select>
          <div className="w-full px-4 py-4 rounded-xl text-2xl font-black text-center"
            style={{ background: result !== null ? 'var(--accent-soft)' : 'var(--surface-2)', color: 'var(--accent)' }}>
            {result !== null ? fmt(result) : '—'}
          </div>
        </div>
      </div>

      {/* Quick reference — all conversions from input */}
      {result !== null && (
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <p className="text-sm font-bold mb-3" style={{ color: 'var(--text-secondary)' }}>All conversions for {fmt(numInput)} {fromUnit.label}</p>
          <div className="space-y-2">
            {cat.units.filter((_, i) => i !== fromIdx).map(u => (
              <div key={u.label} className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: 'var(--surface-2)' }}>
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{u.label}</span>
                <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{fmt(u.fromBase(fromUnit.toBase(numInput)))}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

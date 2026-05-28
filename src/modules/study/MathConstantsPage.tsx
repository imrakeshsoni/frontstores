// [study] [all tenants]
import { useState } from 'react';
import { toast } from 'sonner';

interface ConstantEntry {
  name: string;
  symbol: string;
  value: string;
  unit: string;
  description: string;
}

const PHYSICS_CONSTANTS: ConstantEntry[] = [
  { name: 'Speed of Light', symbol: 'c', value: '2.998 × 10⁸', unit: 'm/s', description: 'Speed of electromagnetic radiation in vacuum' },
  { name: "Planck's Constant", symbol: 'h', value: '6.626 × 10⁻³⁴', unit: 'J·s', description: 'Quantum of action; relates energy and frequency of photons' },
  { name: "Reduced Planck's Constant", symbol: 'ℏ', value: '1.055 × 10⁻³⁴', unit: 'J·s', description: 'h divided by 2π; used in quantum mechanics' },
  { name: 'Gravitational Constant', symbol: 'G', value: '6.674 × 10⁻¹¹', unit: 'N·m²/kg²', description: 'Constant in Newton\'s law of universal gravitation' },
  { name: 'Elementary Charge', symbol: 'e', value: '1.602 × 10⁻¹⁹', unit: 'C', description: 'Magnitude of charge of a single electron or proton' },
  { name: 'Electron Mass', symbol: 'mₑ', value: '9.109 × 10⁻³¹', unit: 'kg', description: 'Rest mass of an electron' },
  { name: 'Proton Mass', symbol: 'mₚ', value: '1.673 × 10⁻²⁷', unit: 'kg', description: 'Rest mass of a proton' },
  { name: 'Neutron Mass', symbol: 'mₙ', value: '1.675 × 10⁻²⁷', unit: 'kg', description: 'Rest mass of a neutron' },
  { name: 'Boltzmann Constant', symbol: 'k_B', value: '1.381 × 10⁻²³', unit: 'J/K', description: 'Relates thermal energy to temperature' },
  { name: "Avogadro's Number", symbol: 'Nₐ', value: '6.022 × 10²³', unit: 'mol⁻¹', description: 'Number of particles in one mole of a substance' },
  { name: 'Permittivity of Free Space', symbol: 'ε₀', value: '8.854 × 10⁻¹²', unit: 'F/m', description: 'Electric permittivity of vacuum' },
  { name: 'Permeability of Free Space', symbol: 'μ₀', value: '1.257 × 10⁻⁶', unit: 'H/m', description: 'Magnetic permeability of vacuum' },
  { name: 'Stefan-Boltzmann Constant', symbol: 'σ', value: '5.670 × 10⁻⁸', unit: 'W/m²/K⁴', description: 'Relates black-body radiation power to temperature' },
  { name: 'Rydberg Constant', symbol: 'R∞', value: '1.097 × 10⁷', unit: 'm⁻¹', description: 'Appears in atomic spectra calculations' },
  { name: 'Bohr Radius', symbol: 'a₀', value: '5.292 × 10⁻¹¹', unit: 'm', description: 'Most probable radius of electron orbit in hydrogen atom' },
  { name: 'Fine Structure Constant', symbol: 'α', value: '7.297 × 10⁻³ ≈ 1/137', unit: 'dimensionless', description: 'Characterizes strength of electromagnetic interaction' },
];

const MATH_IDENTITIES: ConstantEntry[] = [
  { name: 'Pi', symbol: 'π', value: '3.14159265358979…', unit: 'dimensionless', description: 'Ratio of circumference to diameter of a circle' },
  { name: "Euler's Number", symbol: 'e', value: '2.71828182845904…', unit: 'dimensionless', description: 'Base of natural logarithm; limit of (1+1/n)ⁿ as n→∞' },
  { name: 'Golden Ratio', symbol: 'φ', value: '1.61803398874989…', unit: 'dimensionless', description: '(1+√5)/2; ratio where a/b = (a+b)/a' },
  { name: "Euler's Identity", symbol: 'e^(iπ)+1=0', value: 'e^(iπ) = −1', unit: 'identity', description: 'Relates e, i, π, 1, and 0 — often called the most beautiful equation' },
  { name: 'Quadratic Formula', symbol: 'x', value: '(−b ± √(b²−4ac)) / 2a', unit: 'formula', description: 'Solves ax² + bx + c = 0' },
  { name: 'Pythagorean Theorem', symbol: 'a²+b²=c²', value: 'c = √(a² + b²)', unit: 'identity', description: 'Relation between sides of a right triangle' },
  { name: 'Natural Log Identity', symbol: 'ln(e)', value: '= 1', unit: 'identity', description: 'log base e of e equals 1' },
  { name: 'Log Product Rule', symbol: 'log(ab)', value: '= log a + log b', unit: 'identity', description: 'Logarithm of a product equals sum of logarithms' },
  { name: 'Log Quotient Rule', symbol: 'log(a/b)', value: '= log a − log b', unit: 'identity', description: 'Logarithm of a quotient equals difference of logarithms' },
  { name: 'Log Power Rule', symbol: 'log(aⁿ)', value: '= n·log a', unit: 'identity', description: 'Logarithm of a power equals exponent times logarithm' },
  { name: 'Trig: sin²+cos²', symbol: 'sin²θ+cos²θ', value: '= 1', unit: 'identity', description: 'Fundamental Pythagorean trigonometric identity' },
  { name: 'Trig: 1+tan²', symbol: '1+tan²θ', value: '= sec²θ', unit: 'identity', description: 'Pythagorean identity in terms of tangent' },
  { name: 'Trig: 1+cot²', symbol: '1+cot²θ', value: '= csc²θ', unit: 'identity', description: 'Pythagorean identity in terms of cotangent' },
  { name: 'Area of Circle', symbol: 'A', value: 'π r²', unit: 'formula', description: 'Area enclosed by a circle of radius r' },
  { name: 'Volume of Sphere', symbol: 'V', value: '(4/3) π r³', unit: 'formula', description: 'Volume enclosed by a sphere of radius r' },
  { name: 'Area of Triangle', symbol: 'A', value: '(1/2) b h', unit: 'formula', description: 'Area of a triangle with base b and height h' },
  { name: "Newton's Binomial", symbol: '(a+b)ⁿ', value: 'Σ C(n,k) aᵏ bⁿ⁻ᵏ', unit: 'formula', description: 'Expansion of a binomial raised to the n-th power' },
];

const CHEMISTRY_CONSTANTS: ConstantEntry[] = [
  { name: 'Molar Gas Constant', symbol: 'R', value: '8.314', unit: 'J/(mol·K)', description: 'Appears in ideal gas law: PV = nRT' },
  { name: 'Faraday Constant', symbol: 'F', value: '96,485', unit: 'C/mol', description: 'Charge of one mole of electrons; used in electrochemistry' },
  { name: 'Standard Temperature', symbol: 'STP T', value: '273.15', unit: 'K (0 °C)', description: 'Standard temperature — 0 degrees Celsius' },
  { name: 'Standard Pressure', symbol: 'STP P', value: '101,325', unit: 'Pa (1 atm)', description: 'Standard atmospheric pressure' },
  { name: 'Molar Volume (STP)', symbol: 'Vm', value: '22.414', unit: 'L/mol', description: 'Volume of 1 mol ideal gas at STP' },
  { name: 'Ideal Gas Constant (atm)', symbol: 'R', value: '0.0821', unit: 'L·atm/(mol·K)', description: 'R in units convenient for gas law problems' },
  { name: 'Water Ionisation Constant', symbol: 'Kw', value: '1.0 × 10⁻¹⁴', unit: 'mol²/L²', description: 'Product of [H⁺][OH⁻] in pure water at 25°C' },
  { name: 'Molar Mass of Water', symbol: 'M(H₂O)', value: '18.015', unit: 'g/mol', description: 'Mass of one mole of water molecules' },
  { name: 'Molar Mass of CO₂', symbol: 'M(CO₂)', value: '44.010', unit: 'g/mol', description: 'Mass of one mole of carbon dioxide' },
  { name: 'Molar Mass of NaCl', symbol: 'M(NaCl)', value: '58.443', unit: 'g/mol', description: 'Mass of one mole of sodium chloride (table salt)' },
  { name: 'Density of Water (25°C)', symbol: 'ρ(H₂O)', value: '0.997', unit: 'g/mL', description: 'Density of liquid water at room temperature' },
  { name: 'Bond Length C-C', symbol: 'C-C', value: '154', unit: 'pm', description: 'Typical single carbon-carbon bond length' },
  { name: 'Bond Length C=C', symbol: 'C=C', value: '134', unit: 'pm', description: 'Typical carbon-carbon double bond length' },
  { name: 'Bond Length C-H', symbol: 'C-H', value: '109', unit: 'pm', description: 'Typical carbon-hydrogen bond length' },
  { name: 'pH of Pure Water', symbol: 'pH', value: '7.00', unit: 'at 25°C', description: 'Neutral pH; equal concentrations of H⁺ and OH⁻' },
];

const CONVERSIONS: ConstantEntry[] = [
  { name: 'Inch to CM', symbol: '1 in', value: '2.54', unit: 'cm', description: '1 inch = 2.54 centimetres' },
  { name: 'Foot to Metre', symbol: '1 ft', value: '0.3048', unit: 'm', description: '1 foot = 0.3048 metres' },
  { name: 'Mile to KM', symbol: '1 mi', value: '1.609', unit: 'km', description: '1 mile = 1.60934 kilometres' },
  { name: 'KM to Mile', symbol: '1 km', value: '0.6214', unit: 'miles', description: '1 kilometre = 0.6214 miles' },
  { name: 'Pound to KG', symbol: '1 lb', value: '0.4536', unit: 'kg', description: '1 pound = 0.453592 kilograms' },
  { name: 'KG to Pound', symbol: '1 kg', value: '2.2046', unit: 'lbs', description: '1 kilogram = 2.2046 pounds' },
  { name: 'Litre to Gallon', symbol: '1 L', value: '0.2642', unit: 'gal (US)', description: '1 litre = 0.26417 US gallons' },
  { name: 'Gallon to Litre', symbol: '1 gal', value: '3.7854', unit: 'L', description: '1 US gallon = 3.7854 litres' },
  { name: 'Celsius to Fahrenheit', symbol: '°F', value: '(°C × 9/5) + 32', unit: '°F', description: 'Convert Celsius to Fahrenheit' },
  { name: 'Fahrenheit to Celsius', symbol: '°C', value: '(°F − 32) × 5/9', unit: '°C', description: 'Convert Fahrenheit to Celsius' },
  { name: 'Kelvin to Celsius', symbol: '°C', value: 'K − 273.15', unit: '°C', description: 'Convert Kelvin to Celsius' },
  { name: 'Joule to Calorie', symbol: '1 J', value: '0.2390', unit: 'cal', description: '1 joule = 0.2390 calories' },
  { name: 'Calorie to Joule', symbol: '1 cal', value: '4.184', unit: 'J', description: '1 calorie = 4.184 joules' },
  { name: 'eV to Joule', symbol: '1 eV', value: '1.602 × 10⁻¹⁹', unit: 'J', description: '1 electron-volt in joules' },
  { name: 'Atmosphere to Pascal', symbol: '1 atm', value: '101,325', unit: 'Pa', description: '1 standard atmosphere in pascals' },
  { name: 'Bar to Pascal', symbol: '1 bar', value: '100,000', unit: 'Pa', description: '1 bar = 100,000 pascals' },
  { name: 'Newton to kgf', symbol: '1 N', value: '0.1020', unit: 'kgf', description: '1 newton = 0.1020 kilogram-force' },
  { name: 'Watt to HP', symbol: '1 W', value: '0.001341', unit: 'hp', description: '1 watt = 0.001341 horsepower' },
  { name: 'Horsepower to Watt', symbol: '1 hp', value: '745.7', unit: 'W', description: '1 horsepower = 745.7 watts' },
  { name: 'rad to degree', symbol: '1 rad', value: '57.296', unit: '°', description: '1 radian = 180/π degrees' },
];

type Tab = 'physics' | 'math' | 'chemistry' | 'conversions';

const TABS: { key: Tab; label: string; emoji: string; data: ConstantEntry[] }[] = [
  { key: 'physics', label: 'Physics Constants', emoji: '⚡', data: PHYSICS_CONSTANTS },
  { key: 'math', label: 'Math Identities', emoji: '∑', data: MATH_IDENTITIES },
  { key: 'chemistry', label: 'Chemistry Constants', emoji: '⚗️', data: CHEMISTRY_CONSTANTS },
  { key: 'conversions', label: 'Conversions', emoji: '🔄', data: CONVERSIONS },
];

export function MathConstantsPage() {
  const [tab, setTab] = useState<Tab>('physics');
  const [search, setSearch] = useState('');

  const activeTab = TABS.find(t => t.key === tab)!;
  const q = search.toLowerCase().trim();
  const filtered = q
    ? activeTab.data.filter(e => e.name.toLowerCase().includes(q) || e.symbol.toLowerCase().includes(q) || e.description.toLowerCase().includes(q))
    : activeTab.data;

  function copyValue(entry: ConstantEntry) {
    navigator.clipboard.writeText(`${entry.name}: ${entry.symbol} = ${entry.value} ${entry.unit}`);
    toast.success('Copied to clipboard');
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Constants & Identities</h1>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Quick reference for Physics, Math, Chemistry & Conversions</p>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search constants…"
          className="px-4 py-2 rounded-xl border text-sm w-64"
          style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setSearch(''); }}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={tab === t.key ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--surface-border)' }}>
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--surface-border)' }}>
        {/* Header row */}
        <div className="grid px-4 py-2.5" style={{ gridTemplateColumns: '2fr 1fr 2fr 1fr 3fr 36px', background: 'var(--surface-2)', borderBottom: '1px solid var(--surface-border)' }}>
          {['Name', 'Symbol', 'Value', 'Unit', 'Description', ''].map((h, i) => (
            <p key={i} className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{h}</p>
          ))}
        </div>
        {filtered.length === 0 && (
          <div className="p-8 text-center">
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No results for "{search}"</p>
          </div>
        )}
        {filtered.map((entry, i) => (
          <div key={i}
            className="grid px-4 py-3 items-start hover:bg-[var(--surface-2)] transition-colors"
            style={{ gridTemplateColumns: '2fr 1fr 2fr 1fr 3fr 36px', borderBottom: i < filtered.length - 1 ? '1px solid var(--surface-border)' : 'none', background: i % 2 === 0 ? 'var(--surface)' : 'transparent' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{entry.name}</p>
            <p className="text-sm font-bold" style={{ color: 'var(--accent)', fontFamily: 'monospace' }}>{entry.symbol}</p>
            <p className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{entry.value}</p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{entry.unit}</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{entry.description}</p>
            <button onClick={() => copyValue(entry)}
              className="h-7 w-7 rounded-lg flex items-center justify-center text-xs transition-all"
              style={{ background: 'var(--surface-2)', color: 'var(--text-tertiary)' }}
              title="Copy">
              📋
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>
        {filtered.length} entries · Click 📋 to copy any constant
      </p>
    </div>
  );
}

// [study] [all tenants]
import { useState } from 'react';
import { Delete } from 'lucide-react';

type Mode = 'basic' | 'scientific';

const BUTTONS_BASIC = [
  ['C', '±', '%', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '−'],
  ['1', '2', '3', '+'],
  ['0', '.', '⌫', '='],
];

const BUTTONS_SCI = [
  ['sin', 'cos', 'tan', 'log'],
  ['√', 'x²', 'xⁿ', '1/x'],
  ['π', 'e', '(', ')'],
  ['EE', 'ln', '|x|', '!'],
];

function safeEval(expr: string): string {
  try {
    // Replace display symbols with JS equivalents
    let e = expr
      .replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-')
      .replace(/π/g, String(Math.PI))
      .replace(/e(?!\d)/g, String(Math.E));
    // eslint-disable-next-line no-new-func
    const result = new Function(`"use strict"; return (${e})`)();
    if (typeof result !== 'number' || !isFinite(result)) return 'Error';
    return parseFloat(result.toPrecision(12)).toString();
  } catch {
    return 'Error';
  }
}

export function CalculatorPage() {
  const [display, setDisplay] = useState('0');
  const [expr, setExpr] = useState('');
  const [mode, setMode] = useState<Mode>('scientific');
  const [justEvaled, setJustEvaled] = useState(false);

  const append = (val: string) => {
    if (justEvaled && !isNaN(Number(val))) { setDisplay(val); setExpr(val); setJustEvaled(false); return; }
    if (justEvaled) { setJustEvaled(false); }
    const next = (display === '0' && !isNaN(Number(val))) ? val : display + val;
    setDisplay(next);
    setExpr(prev => prev + val);
  };

  const handleBtn = (btn: string) => {
    switch (btn) {
      case 'C': setDisplay('0'); setExpr(''); setJustEvaled(false); break;
      case '⌫': {
        const next = display.length > 1 ? display.slice(0, -1) : '0';
        setDisplay(next); setExpr(prev => prev.slice(0, -1)); break;
      }
      case '=': {
        const result = safeEval(expr || display);
        setDisplay(result); setExpr(result === 'Error' ? '' : result); setJustEvaled(true); break;
      }
      case '±': {
        const toggled = display.startsWith('-') ? display.slice(1) : '-' + display;
        setDisplay(toggled); setExpr(toggled); break;
      }
      case '%': {
        const r = safeEval(`(${expr || display}) / 100`);
        setDisplay(r); setExpr(r); break;
      }
      case 'x²': {
        const r = safeEval(`(${expr || display}) ** 2`);
        setDisplay(r); setExpr(r); setJustEvaled(true); break;
      }
      case 'xⁿ': append('**'); break;
      case '√': { const r = safeEval(`Math.sqrt(${expr || display})`); setDisplay(r); setExpr(r); setJustEvaled(true); break; }
      case '1/x': { const r = safeEval(`1 / (${expr || display})`); setDisplay(r); setExpr(r); setJustEvaled(true); break; }
      case '|x|': { const r = safeEval(`Math.abs(${expr || display})`); setDisplay(r); setExpr(r); setJustEvaled(true); break; }
      case 'log': { const r = safeEval(`Math.log10(${expr || display})`); setDisplay(r); setExpr(r); setJustEvaled(true); break; }
      case 'ln':  { const r = safeEval(`Math.log(${expr || display})`);   setDisplay(r); setExpr(r); setJustEvaled(true); break; }
      case 'sin': { const r = safeEval(`Math.sin((${expr || display}) * Math.PI / 180)`); setDisplay(r); setExpr(r); setJustEvaled(true); break; }
      case 'cos': { const r = safeEval(`Math.cos((${expr || display}) * Math.PI / 180)`); setDisplay(r); setExpr(r); setJustEvaled(true); break; }
      case 'tan': { const r = safeEval(`Math.tan((${expr || display}) * Math.PI / 180)`); setDisplay(r); setExpr(r); setJustEvaled(true); break; }
      case 'EE': append('e+'); break;
      case '!': {
        const n = parseInt(display);
        if (n >= 0 && n <= 20) {
          let f = 1; for (let i = 2; i <= n; i++) f *= i;
          setDisplay(String(f)); setExpr(String(f)); setJustEvaled(true);
        }
        break;
      }
      default: append(btn);
    }
  };

  const btnStyle = (btn: string) => {
    const isOp = ['÷', '×', '−', '+', '='].includes(btn);
    const isFunc = ['C', 'sin', 'cos', 'tan', 'log', 'ln', '√', 'x²', 'xⁿ', '1/x', '|x|', '!', 'EE'].includes(btn);
    if (btn === '=') return { background: 'var(--accent)', color: '#fff' };
    if (isOp) return { background: '#dbeafe', color: '#2563eb' };
    if (isFunc) return { background: '#f1f5f9', color: '#64748b' };
    if (btn === 'C') return { background: '#fee2e2', color: '#dc2626' };
    return { background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' };
  };

  return (
    <div className="flex-1 flex flex-col items-center p-6 gap-5">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: '#ede9fe' }}>
            <span className="text-xl">🔢</span>
          </div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Calculator</h1>
          <div className="flex gap-1 ml-auto">
            {(['basic', 'scientific'] as Mode[]).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize"
                style={mode === m ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Display */}
        <div className="rounded-2xl p-5 mb-4" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <p className="text-xs text-right mb-1 h-4 truncate" style={{ color: 'var(--text-tertiary)' }}>{expr || ' '}</p>
          <p className="text-4xl font-bold text-right truncate" style={{ color: 'var(--text-primary)' }}>{display}</p>
        </div>

        {/* Scientific functions */}
        {mode === 'scientific' && (
          <div className="grid grid-cols-4 gap-2 mb-2">
            {BUTTONS_SCI.flat().map(btn => (
              <button key={btn} onClick={() => handleBtn(btn)}
                className="h-12 rounded-xl text-sm font-semibold transition-all active:scale-95"
                style={btnStyle(btn)}>
                {btn}
              </button>
            ))}
          </div>
        )}

        {/* Basic buttons */}
        <div className="grid grid-cols-4 gap-2">
          {BUTTONS_BASIC.flat().map((btn, i) => (
            <button key={i} onClick={() => handleBtn(btn)}
              className={`h-14 rounded-xl font-bold text-lg transition-all active:scale-95 ${btn === '0' ? '' : ''}`}
              style={btnStyle(btn)}>
              {btn === '⌫' ? <Delete className="h-5 w-5 mx-auto" /> : btn}
            </button>
          ))}
        </div>

        <p className="text-xs text-center mt-3" style={{ color: 'var(--text-tertiary)' }}>Trig functions use degrees • log = log₁₀ • ln = natural log</p>
      </div>
    </div>
  );
}

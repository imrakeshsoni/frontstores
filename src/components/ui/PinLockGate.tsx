// [carwash] [all tenants] — PIN lock overlay for protected sections
import { useState, useEffect, useRef, useCallback } from 'react';
import { Lock, Delete } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';

interface Props {
  settingKey: string; // e.g. 'pin_lock_dashboard'
  label: string;      // e.g. 'Dashboard'
  children: React.ReactNode;
}

export function PinLockGate({ settingKey, label, children }: Props) {
  const settings = useAppStore((s) => s.config?.settings ?? {});
  const isLocked = !!(settings[settingKey] as boolean);
  const savedPin = (settings['pin_lock_code'] as string) ?? '';

  const [unlocked, setUnlocked] = useState(false);
  const [digits, setDigits] = useState('');
  const [shake, setShake] = useState(false);
  const [wrongCount, setWrongCount] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  // reset unlock state whenever we remount (user navigated away and back)
  useEffect(() => {
    setUnlocked(false);
    setDigits('');
    setShake(false);
    setWrongCount(0);
    setLockedUntil(0);
  }, [settingKey]);

  // tick for lockout countdown
  useEffect(() => {
    if (lockedUntil === 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const remaining = Math.max(0, Math.ceil((lockedUntil - now) / 1000));

  const handleDigit = useCallback((d: string) => {
    if (remaining > 0) return;
    setDigits(prev => {
      const next = (prev + d).slice(0, 6);
      if (next.length === 6) {
        setTimeout(() => {
          if (next === savedPin) {
            setUnlocked(true);
          } else {
            setShake(true);
            setTimeout(() => setShake(false), 600);
            setDigits('');
            setWrongCount(c => {
              const newCount = c + 1;
              if (newCount >= 3) {
                setLockedUntil(Date.now() + 30000);
                setNow(Date.now());
                return 0;
              }
              return newCount;
            });
          }
        }, 100);
      }
      return next;
    });
  }, [savedPin, remaining]);

  const handleDelete = () => setDigits(prev => prev.slice(0, -1));

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isLocked || unlocked) return;
    if (e.key >= '0' && e.key <= '9') handleDigit(e.key);
    if (e.key === 'Backspace') handleDelete();
  }, [isLocked, unlocked, handleDigit]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!isLocked || !savedPin || unlocked) return <>{children}</>;

  const PAD = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  return (
    <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className={`flex flex-col items-center gap-6 ${shake ? 'animate-shake' : ''}`}
        style={{ width: 280 }}>
        {/* Icon + title */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(245,158,11,0.15)' }}>
            <Lock className="h-8 w-8" style={{ color: '#f59e0b' }} />
          </div>
          <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{label}</p>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Enter PIN to continue</p>
        </div>

        {/* PIN dots */}
        <div className="flex gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-4 h-4 rounded-full transition-all"
              style={{ background: i < digits.length ? '#f59e0b' : 'var(--surface-border)', transform: i < digits.length ? 'scale(1.2)' : 'scale(1)' }} />
          ))}
        </div>

        {/* Lockout message */}
        {remaining > 0 && (
          <p className="text-sm font-semibold text-center" style={{ color: '#dc2626' }}>
            Too many wrong attempts. Try in {remaining}s
          </p>
        )}

        {/* Wrong attempt hint */}
        {wrongCount > 0 && remaining === 0 && (
          <p className="text-xs" style={{ color: '#dc2626' }}>
            Wrong PIN — {3 - wrongCount} attempt{3 - wrongCount !== 1 ? 's' : ''} left
          </p>
        )}

        {/* Number pad */}
        <div className="grid grid-cols-3 gap-3" style={{ width: 240 }}>
          {PAD.map((key, i) => {
            if (key === '') return <div key={i} />;
            if (key === '⌫') return (
              <button key={i} onClick={handleDelete} disabled={remaining > 0}
                className="h-14 rounded-2xl flex items-center justify-center font-bold text-lg transition-all active:scale-95 disabled:opacity-30"
                style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                <Delete className="h-5 w-5" />
              </button>
            );
            return (
              <button key={i} onClick={() => handleDigit(key)} disabled={remaining > 0}
                className="h-14 rounded-2xl flex items-center justify-center font-bold text-xl transition-all active:scale-95 disabled:opacity-30"
                style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }}>
                {key}
              </button>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-8px)}
          40%{transform:translateX(8px)}
          60%{transform:translateX(-6px)}
          80%{transform:translateX(6px)}
        }
        .animate-shake { animation: shake 0.5s ease-in-out; }
      `}</style>
    </div>
  );
}

// [core] [all tenants] — App login screen with per-shop-type theming
import { useEffect, useState } from 'react';
import { useAppStore } from '@/app/store/app.store';
import { verifyAuth, resetPasswordWithCode, unlockWithCode, getAuthUsername } from '@/lib/db/auth';
import { enqueue } from '@/lib/syncQueue';
import { uuid, now } from '@/lib/db/index';
import { toast } from 'sonner';

type Screen = 'login' | 'forgot' | 'reset-code' | 'locked' | 'unlock-code';

function minutesLeft(lockedUntil: string): number {
  return Math.max(1, Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 60_000));
}

// ── Per-app theme config ──────────────────────────────────────────────────────
interface AppTheme {
  bgFrom: string;
  bgTo: string;
  accent: string;
  accentDark: string;
  accentLight: string;
  icon: string;
  tagline: string;
  cardBg: string;
  cardBorder: string;
  inputBg: string;
  labelColor: string;
}

const THEMES: Record<string, AppTheme> = {
  medical: {
    bgFrom: '#022c22', bgTo: '#0f172a',
    accent: '#10b981', accentDark: '#059669', accentLight: '#6ee7b7',
    icon: '➕',
    tagline: 'Pharmacy & Medical Store',
    cardBg: 'rgba(2, 44, 34, 0.8)', cardBorder: 'rgba(16, 185, 129, 0.3)',
    inputBg: 'rgba(6, 78, 59, 0.5)', labelColor: '#6ee7b7',
  },
  restaurant: {
    bgFrom: '#431407', bgTo: '#1c0a03',
    accent: '#f97316', accentDark: '#ea580c', accentLight: '#fed7aa',
    icon: '🍽️',
    tagline: 'Restaurant & Café Management',
    cardBg: 'rgba(67, 20, 7, 0.85)', cardBorder: 'rgba(249, 115, 22, 0.3)',
    inputBg: 'rgba(120, 40, 10, 0.5)', labelColor: '#fed7aa',
  },
  grocery: {
    bgFrom: '#052e16', bgTo: '#0c1a0e',
    accent: '#22c55e', accentDark: '#16a34a', accentLight: '#bbf7d0',
    icon: '🛒',
    tagline: 'Kirana & Grocery Store',
    cardBg: 'rgba(5, 46, 22, 0.85)', cardBorder: 'rgba(34, 197, 94, 0.3)',
    inputBg: 'rgba(10, 80, 30, 0.5)', labelColor: '#bbf7d0',
  },
  carwash: {
    bgFrom: '#172554', bgTo: '#0f172a',
    accent: '#3b82f6', accentDark: '#2563eb', accentLight: '#bfdbfe',
    icon: '🚗',
    tagline: 'Car Wash & Detailing',
    cardBg: 'rgba(23, 37, 84, 0.85)', cardBorder: 'rgba(59, 130, 246, 0.3)',
    inputBg: 'rgba(30, 58, 138, 0.5)', labelColor: '#bfdbfe',
  },
  clinic: {
    bgFrom: '#0c1445', bgTo: '#0a0a2e',
    accent: '#38bdf8', accentDark: '#0891b2', accentLight: '#bae6fd',
    icon: '🏥',
    tagline: 'Hospital & Clinic Management',
    cardBg: 'rgba(12, 20, 69, 0.85)', cardBorder: 'rgba(56, 189, 248, 0.3)',
    inputBg: 'rgba(14, 30, 100, 0.5)', labelColor: '#bae6fd',
  },
  beauty: {
    bgFrom: '#500724', bgTo: '#2e0a3a',
    accent: '#f472b6', accentDark: '#db2777', accentLight: '#fbcfe8',
    icon: '💅',
    tagline: 'Beauty Parlor & Salon',
    cardBg: 'rgba(80, 7, 36, 0.85)', cardBorder: 'rgba(244, 114, 182, 0.3)',
    inputBg: 'rgba(131, 24, 67, 0.4)', labelColor: '#fbcfe8',
  },
  study: {
    bgFrom: '#06121f', bgTo: '#0c1e35',
    accent: '#7dd3fc', accentDark: '#0ea5e9', accentLight: '#e0f2fe',
    icon: '📚',
    tagline: 'Your AI Study Companion',
    cardBg: 'rgba(12, 30, 53, 0.92)', cardBorder: 'rgba(125, 211, 252, 0.28)',
    inputBg: 'rgba(24, 51, 86, 0.85)', labelColor: '#bae6fd',
  },
};

const DEFAULT_THEME: AppTheme = {
  bgFrom: '#0f172a', bgTo: '#020617',
  accent: '#6366f1', accentDark: '#4f46e5', accentLight: '#c7d2fe',
  icon: '🏪',
  tagline: 'Business Management',
  cardBg: 'rgba(15, 23, 42, 0.9)', cardBorder: 'rgba(99, 102, 241, 0.3)',
  inputBg: 'rgba(30, 41, 59, 0.8)', labelColor: '#c7d2fe',
};

export function AppLoginScreen() {
  const { config, setAuthenticated } = useAppStore();
  const tenantId  = config?.tenant_id ?? '';
  const shopName  = config?.shop_name ?? 'FrontStores';
  const shopType  = config?.shop_type ?? '';
  const maxAttempts: number = ((config?.settings as Record<string, unknown>)?.maxLoginAttempts as number) ?? 5;

  // For study type, load the user's saved theme colors for the login screen
  const baseTheme = THEMES[shopType] ?? DEFAULT_THEME;
  const [studyColors, setStudyColors] = useState<{ accent: string; bg: string } | null>(null);
  useEffect(() => {
    if (shopType !== 'study') return;
    import('@/lib/study/studyThemes').then(({ STUDY_THEMES, getSavedThemeId }) => {
      const saved = STUDY_THEMES.find(t => t.id === getSavedThemeId());
      if (saved) setStudyColors({ accent: saved.accent, bg: saved.bg });
    });
  }, [shopType]);
  const theme: AppTheme = shopType === 'study' && studyColors ? {
    ...baseTheme,
    bgFrom: studyColors.bg, bgTo: studyColors.bg,
    accent: studyColors.accent, accentDark: studyColors.accent,
    cardBg: `${studyColors.bg}ee`,
    cardBorder: `${studyColors.accent}40`,
    inputBg: `${studyColors.bg}cc`,
  } : baseTheme;

  const [screen, setScreen]       = useState<Screen>('login');
  const [username, setUsername]   = useState('');
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [lockedUntil, setLockedUntil] = useState('');
  const [minsLeft, setMinsLeft]   = useState(0);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [unlockCode, setUnlockCode] = useState('');

  useEffect(() => {
    if (screen !== 'locked' || !lockedUntil) return;
    const update = () => {
      setMinsLeft(minutesLeft(lockedUntil));
      if (new Date(lockedUntil) <= new Date()) setScreen('login');
    };
    update();
    const t = setInterval(update, 30_000);
    return () => clearInterval(t);
  }, [screen, lockedUntil]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    try {
      const result = await verifyAuth(tenantId, username, password, maxAttempts);
      if (result.ok) {
        setAuthenticated(true);
      } else if (result.locked) {
        setLockedUntil(result.lockedUntil!);
        setScreen('locked');
      } else if (result.attemptsLeft !== undefined && result.attemptsLeft <= 0) {
        toast.error('Too many failed attempts. Account locked for 30 minutes.');
      } else if (result.attemptsLeft !== undefined) {
        toast.error(`Incorrect credentials. ${result.attemptsLeft} attempt${result.attemptsLeft !== 1 ? 's' : ''} left.`);
      } else {
        toast.error('Incorrect username or password');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotRequest() {
    setLoading(true);
    try {
      const storedUsername = await getAuthUsername(tenantId);
      await enqueue('reset_request', tenantId, { tenant_id: tenantId, shop_name: shopName, username: storedUsername, requested_at: now(), request_id: uuid() });
      toast.success('Reset request sent. Contact FrontStores support for your reset code.');
      setScreen('reset-code');
    } finally { setLoading(false); }
  }

  async function handleUnlockRequest() {
    setLoading(true);
    try {
      const storedUsername = await getAuthUsername(tenantId);
      await enqueue('unlock_request', tenantId, { tenant_id: tenantId, shop_name: shopName, username: storedUsername, requested_at: now(), request_id: uuid() });
      toast.success('Unlock request sent. Contact FrontStores support for your unlock code.');
      setScreen('unlock-code');
    } finally { setLoading(false); }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetCode.trim()) { toast.error('Enter the reset code'); return; }
    if (newPassword.length < 4) { toast.error('Password must be at least 4 characters'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    setLoading(true);
    try {
      const result = await resetPasswordWithCode(tenantId, resetCode.trim(), newPassword);
      if (result.ok) { toast.success('Password reset. Please log in.'); setScreen('login'); setPassword(''); setResetCode(''); setNewPassword(''); setConfirmPassword(''); }
      else toast.error(result.error ?? 'Reset failed');
    } finally { setLoading(false); }
  }

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!unlockCode.trim()) { toast.error('Enter the unlock code'); return; }
    setLoading(true);
    try {
      const result = await unlockWithCode(tenantId, unlockCode.trim());
      if (result.ok) { toast.success('Account unlocked. Please log in.'); setUnlockCode(''); setScreen('login'); }
      else toast.error(result.error ?? 'Invalid unlock code');
    } finally { setLoading(false); }
  }

  // ── Shared input style ───────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    background: theme.inputBg,
    border: `1px solid ${theme.cardBorder}`,
    color: 'white',
    borderRadius: '12px',
    padding: '10px 14px',
    width: '100%',
    fontSize: '14px',
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '11px',
    fontWeight: 600,
    marginBottom: '6px',
    color: theme.labelColor,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  const cardStyle: React.CSSProperties = {
    background: theme.cardBg,
    border: `1px solid ${theme.cardBorder}`,
    borderRadius: '20px',
    padding: '28px',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
  };

  const btnPrimary: React.CSSProperties = {
    background: `linear-gradient(135deg, ${theme.accent}, ${theme.accentDark})`,
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    padding: '11px 0',
    width: '100%',
    fontWeight: 700,
    fontSize: '14px',
    cursor: 'pointer',
    boxShadow: `0 4px 20px ${theme.accent}40`,
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: `linear-gradient(135deg, ${theme.bgFrom} 0%, ${theme.bgTo} 100%)` }}
    >
      {/* Decorative glow */}
      <div style={{
        position: 'fixed', top: '-20%', left: '50%', transform: 'translateX(-50%)',
        width: '600px', height: '600px', borderRadius: '50%',
        background: `radial-gradient(circle, ${theme.accent}18 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <div className="w-full max-w-sm relative">
        {/* App logo + name */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-20 h-20 rounded-3xl text-4xl mb-4 shadow-2xl"
            style={{ background: `linear-gradient(135deg, ${theme.accent}30, ${theme.accentDark}50)`, border: `2px solid ${theme.accent}50` }}
          >
            {theme.icon}
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{shopName}</h1>
          <p className="text-sm mt-1 font-medium" style={{ color: theme.accentLight }}>{theme.tagline}</p>
        </div>

        {/* ── LOGIN ── */}
        {screen === 'login' && (
          <form onSubmit={handleLogin} style={cardStyle} className="space-y-4">
            <p className="text-center text-sm font-semibold text-white/70 mb-2">Sign in to continue</p>
            <div>
              <label style={labelStyle}>Username</label>
              <input style={inputStyle} placeholder="Enter your username" value={username} onChange={e => setUsername(e.target.value)} autoFocus />
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <div className="relative">
                <input style={{ ...inputStyle, paddingRight: '52px' }} type={showPass ? 'text' : 'password'} placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold"
                  style={{ color: theme.accentLight }}>
                  {showPass ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <div className="pt-1">
              <button type="submit" disabled={loading || !username || !password} style={{ ...btnPrimary, opacity: (loading || !username || !password) ? 0.5 : 1 }}>
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </div>
            <button type="button" onClick={() => setScreen('forgot')}
              className="w-full text-center text-xs pt-1 transition-colors"
              style={{ color: theme.labelColor, opacity: 0.7 }}>
              Forgot password?
            </button>
          </form>
        )}

        {/* ── LOCKED ── */}
        {screen === 'locked' && (
          <div style={{ ...cardStyle, borderColor: 'rgba(239,68,68,0.4)' }} className="space-y-4">
            <div className="text-center">
              <div className="text-4xl mb-3">🔒</div>
              <h2 className="text-white font-bold text-lg">Account Locked</h2>
              <p className="text-sm mt-2" style={{ color: theme.labelColor }}>
                Too many failed attempts.<br />
                Try again in <strong style={{ color: '#f87171' }}>{minsLeft} minute{minsLeft !== 1 ? 's' : ''}</strong>.
              </p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <p className="text-xs" style={{ color: '#fca5a5' }}>Contact FrontStores support to unlock immediately</p>
              <p className="text-xs font-bold mt-1 text-white">+91 93404 19566 · WhatsApp</p>
            </div>
            <button onClick={handleUnlockRequest} disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.5 : 1 }}>
              {loading ? 'Sending…' : 'Send Unlock Request'}
            </button>
            <button onClick={() => setScreen('unlock-code')} className="w-full text-center text-xs" style={{ color: theme.labelColor, opacity: 0.7 }}>
              Already have an unlock code? Enter it here
            </button>
          </div>
        )}

        {/* ── UNLOCK CODE ── */}
        {screen === 'unlock-code' && (
          <form onSubmit={handleUnlock} style={cardStyle} className="space-y-4">
            <h2 className="text-white font-bold text-center text-lg">Enter Unlock Code</h2>
            <p className="text-sm text-center" style={{ color: theme.labelColor }}>Enter the 6-digit code from FrontStores support.</p>
            <div>
              <label style={labelStyle}>Unlock Code</label>
              <input style={{ ...inputStyle, textAlign: 'center', letterSpacing: '0.3em', fontSize: '20px' }} placeholder="000000" maxLength={6} value={unlockCode} onChange={e => setUnlockCode(e.target.value.replace(/\D/g, ''))} autoFocus />
            </div>
            <button type="submit" disabled={loading || unlockCode.length !== 6} style={{ ...btnPrimary, opacity: (loading || unlockCode.length !== 6) ? 0.5 : 1 }}>
              {loading ? 'Verifying…' : 'Unlock Account'}
            </button>
            <button type="button" onClick={() => setScreen('login')} className="w-full text-center text-xs" style={{ color: theme.labelColor, opacity: 0.7 }}>← Back to login</button>
          </form>
        )}

        {/* ── FORGOT ── */}
        {screen === 'forgot' && (
          <div style={cardStyle} className="space-y-4">
            <h2 className="text-white font-bold text-center text-lg">Reset Password</h2>
            <p className="text-sm text-center" style={{ color: theme.labelColor }}>We'll send a reset request to support. You'll get a 6-digit code via WhatsApp.</p>
            <button onClick={handleForgotRequest} disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.5 : 1 }}>
              {loading ? 'Sending…' : 'Send Reset Request'}
            </button>
            <button onClick={() => setScreen('reset-code')} className="w-full text-center text-xs" style={{ color: theme.labelColor, opacity: 0.7 }}>Already have a code? Enter it here</button>
            <button onClick={() => setScreen('login')} className="w-full text-center text-xs" style={{ color: theme.labelColor, opacity: 0.7 }}>← Back to login</button>
          </div>
        )}

        {/* ── RESET CODE ── */}
        {screen === 'reset-code' && (
          <form onSubmit={handleResetPassword} style={cardStyle} className="space-y-4">
            <h2 className="text-white font-bold text-center text-lg">Enter Reset Code</h2>
            <p className="text-sm text-center" style={{ color: theme.labelColor }}>Enter the 6-digit code from FrontStores support.</p>
            <div>
              <label style={labelStyle}>Reset Code</label>
              <input style={{ ...inputStyle, textAlign: 'center', letterSpacing: '0.3em', fontSize: '20px' }} placeholder="000000" maxLength={6} value={resetCode} onChange={e => setResetCode(e.target.value.replace(/\D/g, ''))} />
            </div>
            <div>
              <label style={labelStyle}>New Password</label>
              <input style={inputStyle} type="password" placeholder="New password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Confirm Password</label>
              <input style={inputStyle} type="password" placeholder="Confirm new password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
            </div>
            <button type="submit" disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.5 : 1 }}>
              {loading ? 'Resetting…' : 'Reset Password'}
            </button>
            <button type="button" onClick={() => setScreen('login')} className="w-full text-center text-xs" style={{ color: theme.labelColor, opacity: 0.7 }}>← Back to login</button>
          </form>
        )}

        {/* FrontStores watermark */}
        <p className="text-center mt-6 text-xs" style={{ color: theme.accent, opacity: 0.4 }}>
          Powered by FrontStores
        </p>
      </div>
    </div>
  );
}

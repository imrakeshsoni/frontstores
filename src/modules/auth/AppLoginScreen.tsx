// [core] [all tenants] — App login screen with per-shop-type theming
import { useEffect, useState } from 'react';
import { useAppStore } from '@/app/store/app.store';
import { verifyAuth, resetPasswordWithCode, resetPasswordWithPhonePin, unlockWithCode, getAuthUsername } from '@/lib/db/auth';
import { verifyStaffAuth } from '@/lib/db/staffUsers';
import { claimSession } from '@/lib/db/session';
import { enqueue } from '@/lib/syncQueue';
import { uuid, now } from '@/lib/db/index';
import { toast } from 'sonner';

type Screen = 'login' | 'forgot' | 'reset-code' | 'pin-reset' | 'locked' | 'unlock-code';

// [core] [all apps] [all tenants] — the frontstores.com spectrum brand system
export const SPEC_GRADIENT = 'linear-gradient(110deg, #ffb73d, #ff5e62 26%, #ff3d9a 50%, #8b5cf6 74%, #06d6f9)';
export const SPEC_BG = `radial-gradient(ellipse 62% 48% at 12% -4%, rgba(255,94,98,.32), transparent 60%),
  radial-gradient(ellipse 60% 44% at 88% -2%, rgba(255,61,154,.3), transparent 60%),
  radial-gradient(ellipse 52% 40% at 96% 48%, rgba(139,92,246,.32), transparent 62%),
  radial-gradient(ellipse 52% 40% at 2% 60%, rgba(6,214,249,.22), transparent 60%),
  radial-gradient(ellipse 80% 50% at 50% 112%, rgba(255,183,61,.24), transparent 62%),
  #18131f`;

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
  const { config, setAuthenticated, loadConfig } = useAppStore();
  const tenantId  = config?.tenant_id ?? '';
  const shopName  = config?.shop_name ?? 'FrontStores';
  const shopType  = config?.shop_type ?? '';
  const maxAttempts: number = ((config?.settings as Record<string, unknown>)?.maxLoginAttempts as number) ?? 5;

  // [core] [all apps] [all tenants] — after logout, every registered (purchased)
  // app on this device is listed below the login form. Pick an app → its login
  // screen appears → sign in with THAT app's username + password → the whole app
  // switches to that tenant's data.
  const [otherApps, setOtherApps] = useState<{ tenant_id: string; shop_type: string; shop_name: string }[]>([]);
  useEffect(() => {
    import('@/lib/db/linkedAccounts').then(({ getLinkedAccounts }) => {
      getLinkedAccounts().then(accounts => {
        setOtherApps(accounts.filter(a => a.status === 'active' && a.tenant_id !== tenantId));
      }).catch(() => {});
    });
  }, [tenantId]);

  async function handleSwitchToApp(otherTenantId: string) {
    const { switchActiveApp } = await import('@/lib/db/linkedAccounts');
    await switchActiveApp(otherTenantId);
    await loadConfig();
  }

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
  void studyColors; // superseded by the unified brand design below
  // [core] [all apps] [all tenants] — unified FrontStores spectrum design:
  // the login screen matches frontstores.com for every app. Per-app icon and
  // tagline remain; colours are one premium brand system.
  const theme: AppTheme = {
    ...baseTheme,
    bgFrom: '#18131f', bgTo: '#18131f',
    accent: '#ff3d9a', accentDark: '#8b5cf6', accentLight: '#ffb73d',
    cardBg: 'rgba(41,33,58,.72)', cardBorder: 'rgba(255,255,255,.16)',
    inputBg: 'rgba(36,29,53,.92)', labelColor: '#d3cce2',
  };

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
  const [pinPhone, setPinPhone] = useState('');
  const [pinCode, setPinCode] = useState('');

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

  // Completes login for either the owner or an approved staff login — each
  // holds its own single-session slot, keyed by username, so they don't block
  // each other across devices.
  async function completeLogin(loggedInUsername: string) {
    let claim = await claimSession(tenantId, loggedInUsername);
    if (claim.blocked) {
      // [core] [all tenants] — the same login can get "stuck" claimed by a device
      // that crashed/was reinstalled without releasing its slot. Offer to take over;
      // server only allows this if the other device hasn't sent a heartbeat recently
      // is bypassed here intentionally — it's the user's own account.
      const proceed = window.confirm(
        `${claim.error || `Already logged in on ${claim.activeDevice || 'another device'}`}.\n\n` +
        `If that device is no longer in use, click OK to log in here instead.`
      );
      if (!proceed) return;
      claim = await claimSession(tenantId, loggedInUsername, true);
      if (claim.blocked) {
        toast.error(claim.error || 'Could not log in — please try again.');
        return;
      }
    }
    if (claim.sessionId) sessionStorage.setItem('fs_session_id', claim.sessionId);
    sessionStorage.setItem('fs_logged_in_username', loggedInUsername);
    localStorage.setItem(`fs_remember_user_${tenantId}`, loggedInUsername);
    setAuthenticated(true);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    try {
      const ownerResult = await verifyAuth(tenantId, username, password, maxAttempts);
      if (ownerResult.ok) {
        await completeLogin('owner');
        return;
      }

      // If the owner account is locked, only stop here if the entered username IS
      // the owner's username — a staff member logging in with a different username
      // must still be able to try their own credentials.
      if (ownerResult.locked) {
        const ownerUsername = await getAuthUsername(tenantId);
        if (!ownerUsername || ownerUsername === username.trim().toLowerCase()) {
          setLockedUntil(ownerResult.lockedUntil!);
          setScreen('locked');
          return;
        }
      }

      // Staff login path
      const staffResult = await verifyStaffAuth(tenantId, username, password, maxAttempts);
      if (staffResult.ok) {
        await completeLogin(username.trim().toLowerCase());
        return;
      }
      if (staffResult.locked) {
        setLockedUntil(staffResult.lockedUntil!);
        setScreen('locked');
        return;
      }

      const attemptsLeft = staffResult.attemptsLeft ?? ownerResult.attemptsLeft;
      if (attemptsLeft !== undefined && attemptsLeft <= 0) {
        toast.error('Too many failed attempts. Account locked for 30 minutes.');
      } else if (attemptsLeft !== undefined) {
        toast.error(`Incorrect credentials. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} left.`);
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

  async function handlePinReset(e: React.FormEvent) {
    e.preventDefault();
    if (!pinPhone.trim()) { toast.error('Enter your mobile number'); return; }
    if (!/^\d{4,8}$/.test(pinCode)) { toast.error('Enter your 4–8 digit Cloud Sync PIN'); return; }
    if (newPassword.length < 4) { toast.error('Password must be at least 4 characters'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    setLoading(true);
    try {
      const result = await resetPasswordWithPhonePin(tenantId, pinPhone.trim(), pinCode, newPassword);
      if (result.ok) {
        toast.success('Password reset. Please log in.');
        setScreen('login'); setPassword(''); setPinPhone(''); setPinCode(''); setNewPassword(''); setConfirmPassword('');
      } else toast.error(result.error ?? 'Reset failed');
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
    background: SPEC_GRADIENT,
    color: '#1b0a14',
    border: 'none',
    borderRadius: '12px',
    padding: '11px 0',
    width: '100%',
    fontWeight: 700,
    fontSize: '14px',
    cursor: 'pointer',
    boxShadow: '0 0 26px rgba(255,61,154,.3), 0 6px 24px rgba(255,183,61,.2)',
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: SPEC_BG }}
    >
      <div className="w-full max-w-sm relative">
        {/* App logo + name */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-20 h-20 rounded-3xl text-4xl mb-4 shadow-2xl"
            style={{ background: 'rgba(41,33,58,.8)', border: '2px solid rgba(255,61,154,.45)', boxShadow: '0 0 34px rgba(255,61,154,.25)' }}
          >
            {theme.icon}
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{shopName}</h1>
          <p className="text-sm mt-1 font-medium" style={{ color: theme.accentLight }}>{theme.tagline}</p>
          <p className="text-xs mt-2 font-bold tracking-tight">
            <span style={{ color: '#fff' }}>Front</span>
            <span style={{ background: SPEC_GRADIENT, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Stores</span>
          </p>
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
            <div className="rounded-xl p-3 text-center" style={{ background: `${theme.accent}15`, border: `1px solid ${theme.accent}30` }}>
              <p className="text-xs" style={{ color: theme.labelColor }}>Set up Cloud Sync? Skip the wait —</p>
              <button onClick={() => setScreen('pin-reset')} className="text-xs font-bold mt-1" style={{ color: theme.accentLight }}>
                Reset instantly with phone + Cloud Sync PIN →
              </button>
            </div>
            <button onClick={() => setScreen('reset-code')} className="w-full text-center text-xs" style={{ color: theme.labelColor, opacity: 0.7 }}>Already have a code? Enter it here</button>
            <button onClick={() => setScreen('login')} className="w-full text-center text-xs" style={{ color: theme.labelColor, opacity: 0.7 }}>← Back to login</button>
          </div>
        )}

        {/* ── PIN RESET (self-service via phone + Cloud Sync PIN) ── */}
        {screen === 'pin-reset' && (
          <form onSubmit={handlePinReset} style={cardStyle} className="space-y-4">
            <h2 className="text-white font-bold text-center text-lg">Reset with Phone + PIN</h2>
            <p className="text-sm text-center" style={{ color: theme.labelColor }}>Enter the mobile number and Cloud Sync PIN you set up in Settings → Cloud Sync. No need to wait for support.</p>
            <div>
              <label style={labelStyle}>Mobile Number</label>
              <input style={inputStyle} type="tel" placeholder="98765 43210" value={pinPhone} onChange={e => setPinPhone(e.target.value)} autoFocus />
            </div>
            <div>
              <label style={labelStyle}>Cloud Sync PIN</label>
              <input style={{ ...inputStyle, textAlign: 'center', letterSpacing: '0.3em', fontSize: '20px' }} type="password" placeholder="••••" maxLength={8} value={pinCode} onChange={e => setPinCode(e.target.value.replace(/\D/g, ''))} />
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
              {loading ? 'Verifying…' : 'Reset Password'}
            </button>
            <button type="button" onClick={() => setScreen('forgot')} className="w-full text-center text-xs" style={{ color: theme.labelColor, opacity: 0.7 }}>← Back</button>
          </form>
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

        {/* [core] [all apps] [all tenants] — your other registered apps: pick one to go to its login */}
        {otherApps.length > 0 && (screen === 'login') && (
          <div className="mt-5 rounded-xl p-3" style={{ background: `${theme.accent}10`, border: `1px solid ${theme.cardBorder}` }}>
            <p className="text-xs text-center mb-2" style={{ color: theme.labelColor, opacity: 0.8 }}>Your other apps — select one to sign in</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {otherApps.map(app => (
                <button key={app.tenant_id} type="button" onClick={() => handleSwitchToApp(app.tenant_id)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                  style={{ background: theme.inputBg, color: theme.accentLight, border: `1px solid ${theme.cardBorder}` }}>
                  {app.shop_name} ({app.shop_type})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* FrontStores watermark */}
        <p className="text-center mt-6 text-xs" style={{ color: theme.accent, opacity: 0.4 }}>
          Powered by FrontStores
        </p>
      </div>
    </div>
  );
}

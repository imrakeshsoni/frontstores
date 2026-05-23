import { useState } from 'react';
import { useAppStore } from '@/app/store/app.store';
import { verifyAuth, resetPasswordWithCode, getAuthUsername } from '@/lib/db/auth';
import { enqueue } from '@/lib/syncQueue';
import { uuid, now } from '@/lib/db/index';
import { toast } from 'sonner';

type Screen = 'login' | 'forgot' | 'reset-code';

export function AppLoginScreen() {
  const { config, setAuthenticated } = useAppStore();
  const tenantId = config?.tenant_id ?? '';
  const shopName = config?.shop_name ?? 'FrontStores';

  const [screen, setScreen] = useState<Screen>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  // Reset flow
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    try {
      const ok = await verifyAuth(tenantId, username, password);
      if (ok) {
        setAuthenticated(true);
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
      await enqueue('reset_request', tenantId, {
        tenant_id: tenantId,
        shop_name: shopName,
        username: storedUsername,
        requested_at: now(),
        request_id: uuid(),
      });
      toast.success('Reset request sent. Contact FrontStores support for your reset code.');
      setScreen('reset-code');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetCode.trim()) { toast.error('Enter the reset code'); return; }
    if (newPassword.length < 4) { toast.error('Password must be at least 4 characters'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    setLoading(true);
    try {
      const result = await resetPasswordWithCode(tenantId, resetCode.trim(), newPassword);
      if (result.ok) {
        toast.success('Password reset successfully. Please log in.');
        setScreen('login');
        setPassword('');
        setResetCode('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error(result.error ?? 'Reset failed');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-3xl mb-2">💊</div>
          <h1 className="text-xl font-bold text-white">{shopName}</h1>
          <p className="text-slate-400 text-sm mt-1">FrontStores</p>
        </div>

        {/* ── LOGIN ── */}
        {screen === 'login' && (
          <form onSubmit={handleLogin} className="bg-slate-900 rounded-2xl p-6 space-y-4 border border-slate-800">
            <h2 className="text-white font-semibold text-center">Sign in to your store</h2>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Username</label>
              <input
                className="input w-full"
                placeholder="Enter username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Password</label>
              <div className="relative">
                <input
                  className="input w-full pr-10"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                >
                  {showPass ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || !username || !password}
              className="btn-primary w-full py-2.5 disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
            <button
              type="button"
              onClick={() => setScreen('forgot')}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-300 pt-1"
            >
              Forgot password?
            </button>
          </form>
        )}

        {/* ── FORGOT — step 1: send request ── */}
        {screen === 'forgot' && (
          <div className="bg-slate-900 rounded-2xl p-6 space-y-4 border border-slate-800">
            <h2 className="text-white font-semibold text-center">Reset Password</h2>
            <p className="text-slate-400 text-sm text-center">
              We'll send a reset request to FrontStores support. You'll receive a 6-digit code via phone or WhatsApp.
            </p>
            <button
              onClick={handleForgotRequest}
              disabled={loading}
              className="btn-primary w-full py-2.5 disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send Reset Request'}
            </button>
            <button
              onClick={() => setScreen('reset-code')}
              className="w-full text-center text-xs text-slate-400 hover:text-white"
            >
              Already have a code? Enter it here
            </button>
            <button
              onClick={() => setScreen('login')}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-300"
            >
              ← Back to login
            </button>
          </div>
        )}

        {/* ── FORGOT — step 2: enter code + new password ── */}
        {screen === 'reset-code' && (
          <form onSubmit={handleResetPassword} className="bg-slate-900 rounded-2xl p-6 space-y-4 border border-slate-800">
            <h2 className="text-white font-semibold text-center">Enter Reset Code</h2>
            <p className="text-slate-400 text-sm text-center">
              Enter the 6-digit code provided by FrontStores support.
            </p>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Reset Code</label>
              <input
                className="input w-full text-center tracking-widest text-lg"
                placeholder="000000"
                maxLength={6}
                value={resetCode}
                onChange={e => setResetCode(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">New Password</label>
              <input
                className="input w-full"
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Confirm Password</label>
              <input
                className="input w-full"
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 disabled:opacity-50"
            >
              {loading ? 'Resetting…' : 'Reset Password'}
            </button>
            <button
              type="button"
              onClick={() => setScreen('login')}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-300"
            >
              ← Back to login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

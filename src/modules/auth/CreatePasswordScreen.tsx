import { useState } from 'react';
import { useAppStore } from '@/app/store/app.store';
import { createAuth } from '@/lib/db/auth';
import { claimSession } from '@/lib/db/session';
import { toast } from 'sonner';
// [core] [all apps] [all tenants] — frontstores.com spectrum brand system
import { SPEC_GRADIENT, SPEC_BG } from './AppLoginScreen';

interface Props { onCreated: () => void; }

export function CreatePasswordScreen({ onCreated }: Props) {
  const { config, setAuthenticated } = useAppStore();
  const shopName = config?.shop_name ?? 'FrontStores';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const valid = username.trim().length >= 2 && password.length >= 4 && password === confirm;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || !config?.tenant_id) return;
    setLoading(true);
    try {
      await createAuth(config.tenant_id, username.trim(), password);
      const claim = await claimSession(config.tenant_id, 'owner');
      if (claim.sessionId) sessionStorage.setItem('fs_session_id', claim.sessionId);
      sessionStorage.setItem('fs_logged_in_username', 'owner');
      localStorage.setItem(`fs_remember_user_${config.tenant_id}`, 'owner');
      toast.success('Login created! You are now signed in.');
      onCreated();
      setAuthenticated(true);
    } catch (err) {
      toast.error(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: SPEC_BG }}>
      <div className="w-full max-w-sm">
        <div className="rounded-2xl p-8 shadow-2xl" style={{ background: 'rgba(41,33,58,.72)', border: '1px solid rgba(255,255,255,.16)', backdropFilter: 'blur(16px)' }}>
          <div className="flex flex-col items-center mb-6">
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-white font-black text-xl mb-3"
              style={{ background: 'linear-gradient(150deg, #d92b14, #8f1206)', boxShadow: '0 0 26px rgba(255,61,154,.3)' }}>
              FS
            </div>
            <h1 className="text-lg font-bold text-white">{shopName}</h1>
            <p className="text-sm text-slate-400 mt-1 text-center">Create a login to protect your shop data</p>
          </div>

          <div className="bg-amber-900/30 border border-amber-700/40 rounded-xl p-3 mb-5">
            <p className="text-xs text-amber-300 leading-relaxed">
              Your app has been updated. Please create a username and password — you will need these every time you open the app.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. rakesh"
                autoComplete="username"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 4 characters"
                  autoComplete="new-password"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent pr-10"
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs">
                  {showPass ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Re-enter password"
                autoComplete="new-password"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              {confirm && password !== confirm && (
                <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
              )}
            </div>

            <button
              type="submit"
              disabled={!valid || loading}
              className="w-full disabled:opacity-40 disabled:cursor-not-allowed font-bold py-2.5 rounded-xl text-sm transition-transform hover:scale-[1.01] mt-2"
              style={{ background: SPEC_GRADIENT, color: '#1b0a14', boxShadow: '0 0 26px rgba(255,61,154,.3)' }}
            >
              {loading ? 'Creating…' : 'Create Login & Open App'}
            </button>
          </form>

          <p className="text-xs text-slate-600 text-center mt-4">
            Password is stored only on this device. Contact FrontStores support if you forget it.
          </p>
        </div>
      </div>
    </div>
  );
}

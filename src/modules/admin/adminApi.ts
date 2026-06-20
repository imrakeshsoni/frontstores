// [admin] [all tenants] — shared API client for native admin panel → cloud Worker (update.frontstores.com)

export const ADMIN_API = 'https://update.frontstores.com';
const PWD_KEY = 'fs_admin_password';

export function getAdminPassword(): string {
  return localStorage.getItem(PWD_KEY) ?? '';
}

export function saveAdminPassword(pwd: string) {
  localStorage.setItem(PWD_KEY, pwd);
}

export function clearAdminPassword() {
  localStorage.removeItem(PWD_KEY);
}

export function adminHeaders(password = getAdminPassword()) {
  return {
    'Authorization': `Basic ${btoa(':' + password)}`,
    'Content-Type': 'application/json',
  };
}

export async function adminFetch(path: string, opts: RequestInit = {}) {
  return fetch(`${ADMIN_API}${path}`, {
    ...opts,
    headers: { ...adminHeaders(), ...(opts.headers ?? {}) },
  });
}

export async function adminGet<T>(path: string): Promise<T> {
  const res = await adminFetch(path);
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

export async function adminPost(path: string, body?: object) {
  const res = await adminFetch(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

export interface Tenant {
  tenant_id: string;
  shop_name: string;
  shop_type: string;
  owner_name?: string;
  phone?: string;
  email?: string;
  city?: string;
  state?: string;
  registered_at: string;
  expires_at: string;
  account_status: string;
  is_client?: boolean;
  sync_enabled?: boolean;
  sync_code?: string;
  plan?: string;
  extended_at?: string;
  frozen_at?: string;
  revoked_at?: string;
  approved_at?: string;
  history?: { action: string; label: string; at: string }[];
}

export interface ErrorReport {
  id: string;
  tenant_id: string;
  shop_name?: string;
  error: string;
  stack?: string;
  context?: string;
  app_version?: string;
  resolved?: boolean;
  at: string;
}

export interface Contact {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  message?: string;
  shop_type?: string;
  resolved?: boolean;
  at: string;
}

export function subStatus(t: Tenant): string {
  if (t.account_status === 'frozen') return 'frozen';
  if (t.account_status === 'revoked') return 'revoked';
  if (t.account_status === 'pending') return 'pending';
  const expires = new Date(t.expires_at);
  const now = new Date();
  const daysLeft = Math.floor((expires.getTime() - now.getTime()) / 86400000);
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= 14) return 'expiring';
  if (t.account_status === 'trial') return 'trial';
  return 'active';
}

export function daysLeft(expires_at: string): number {
  return Math.floor((new Date(expires_at).getTime() - Date.now()) / 86400000);
}

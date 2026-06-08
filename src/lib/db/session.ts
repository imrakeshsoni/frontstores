// [all apps] [all tenants] — Best-effort single-session enforcement.
// One tenant_id should only be "active" on one device at a time. This is advisory
// (server-checked when online, allowed when offline) — the app must keep working
// fully offline even if the server can't be reached.
import { getDeviceId } from './cloudSync';

const SERVER = 'https://update.frontstores.com';

export interface SessionClaimResult {
  ok: boolean;
  sessionId?: string;
  blocked?: boolean;
  activeDevice?: string;
  error?: string;
}

function deviceLabel(): string {
  const ua = navigator.userAgent;
  if (/Mac/.test(ua)) return 'Mac';
  if (/Win/.test(ua)) return 'Windows PC';
  return 'Desktop';
}

// `username` separates session slots so the owner and each staff login can each
// hold their own slot under the same tenant — only the SAME login is blocked
// from running on two devices at once. Defaults to 'owner' for the main login.
export async function claimSession(tenantId: string, username: string = 'owner'): Promise<SessionClaimResult> {
  const device_id = getDeviceId();
  try {
    const res = await fetch(`${SERVER}/session/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId, username, device_id, device_name: deviceLabel() }),
      signal: AbortSignal.timeout(6000),
    });
    const data = await res.json();
    if (data.ok) return { ok: true, sessionId: data.session_id };
    return { ok: false, blocked: true, activeDevice: data.active_device, error: data.error };
  } catch {
    return { ok: true }; // Offline — best effort: allow login locally
  }
}

export async function heartbeatSession(tenantId: string, sessionId: string, username: string = 'owner'): Promise<void> {
  const device_id = getDeviceId();
  try {
    await fetch(`${SERVER}/session/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId, username, device_id, session_id: sessionId }),
      signal: AbortSignal.timeout(6000),
    });
  } catch { /* offline — heartbeat will resume next time we're online */ }
}

export async function releaseSession(tenantId: string, sessionId: string, username: string = 'owner'): Promise<void> {
  const device_id = getDeviceId();
  try {
    await fetch(`${SERVER}/session/release`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId, username, device_id, session_id: sessionId }),
      signal: AbortSignal.timeout(6000),
    });
  } catch { /* offline — session will expire via TTL on the server */ }
}

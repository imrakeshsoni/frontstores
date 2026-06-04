// [all apps] [all tenants] — WhatsApp send utility
// Mode 1 (default): Opens WhatsApp Desktop / wa.me — free, no API, user taps Send manually
// Mode 2 (when API credentials set): WhatsApp Business API — sends automatically, silently

import { open as shellOpen } from '@tauri-apps/plugin-shell';
import { useAppStore } from '@/app/store/app.store';

const WA_API_VERSION = 'v18.0';

function getWaCredentials(): { phoneId: string; token: string } | null {
  const settings = useAppStore.getState().config?.settings ?? {};
  const phoneId = settings.wa_phone_id as string;
  const token   = settings.wa_token as string;
  if (phoneId?.trim() && token?.trim()) return { phoneId: phoneId.trim(), token: token.trim() };
  return null;
}

function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  // Normalize to full E.164 India format
  return digits.length === 10 ? `91${digits}` : digits.startsWith('91') ? digits : `91${digits.slice(-10)}`;
}

/**
 * Send a WhatsApp message.
 * - If Business API credentials are configured → sends automatically via Meta API
 * - Otherwise → opens WhatsApp Desktop (or wa.me fallback), user taps Send
 */
export async function sendWhatsApp(phone: string, text: string): Promise<void> {
  const e164 = normalizePhone(phone);
  if (!e164) return;

  const creds = getWaCredentials();

  if (creds) {
    // ── WhatsApp Business API mode ──
    const res = await fetch(
      `https://graph.facebook.com/${WA_API_VERSION}/${creds.phoneId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${creds.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: e164,
          type: 'text',
          text: { body: text, preview_url: false },
        }),
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message ?? `WhatsApp API error ${res.status}`);
    }
    return;
  }

  // ── Fallback: WhatsApp Desktop / wa.me ──
  const encoded = encodeURIComponent(text);
  try {
    await shellOpen(`whatsapp://send?phone=${e164}&text=${encoded}`);
  } catch {
    await shellOpen(`https://wa.me/${e164}?text=${encoded}`);
  }
}

/**
 * Send bulk WhatsApp messages to multiple recipients.
 * With API: sends all silently. Without API: opens one at a time (loop).
 * Returns { sent, failed } counts.
 */
export async function sendWhatsAppBulk(
  recipients: Array<{ phone: string; name: string }>,
  buildMessage: (name: string) => string,
  onProgress?: (done: number, total: number) => void
): Promise<{ sent: number; failed: number }> {
  let sent = 0, failed = 0;
  const creds = getWaCredentials();

  for (let i = 0; i < recipients.length; i++) {
    const { phone, name } = recipients[i];
    const e164 = normalizePhone(phone);
    if (!e164) { failed++; onProgress?.(i + 1, recipients.length); continue; }

    try {
      const text = buildMessage(name);
      if (creds) {
        const res = await fetch(
          `https://graph.facebook.com/${WA_API_VERSION}/${creds.phoneId}/messages`,
          {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${creds.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ messaging_product: 'whatsapp', to: e164, type: 'text', text: { body: text } }),
          }
        );
        if (res.ok) sent++; else failed++;
      } else {
        // Without API: open one at a time with small delay
        const encoded = encodeURIComponent(text);
        try { await shellOpen(`whatsapp://send?phone=${e164}&text=${encoded}`); }
        catch { await shellOpen(`https://wa.me/${e164}?text=${encoded}`); }
        sent++;
        await new Promise(r => setTimeout(r, 800)); // brief pause between opens
      }
    } catch { failed++; }

    onProgress?.(i + 1, recipients.length);
  }

  return { sent, failed };
}

/**
 * Test WhatsApp Business API credentials — sends a test ping.
 * Returns { ok, error }
 */
export async function testWaCredentials(phoneId: string, token: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/${WA_API_VERSION}/${phoneId}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    if (res.ok) return { ok: true };
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: err?.error?.message ?? `Error ${res.status}` };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Network error' };
  }
}

/** Open WhatsApp without a specific recipient (for sharing) */
export async function shareWhatsApp(text: string): Promise<void> {
  const encoded = encodeURIComponent(text);
  try { await shellOpen(`whatsapp://send?text=${encoded}`); }
  catch { await shellOpen(`https://wa.me/?text=${encoded}`); }
}

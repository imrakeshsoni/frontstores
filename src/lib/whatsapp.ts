// [all apps] [all tenants] — shared WhatsApp send utility
// Opens WhatsApp Desktop if installed, falls back to wa.me in browser.
// One-time setup: user installs WhatsApp Desktop — no API key, no cost.

import { open as shellOpen } from '@tauri-apps/plugin-shell';

/**
 * Send a WhatsApp message to a phone number.
 * Uses whatsapp:// protocol → opens WhatsApp Desktop directly.
 * Falls back to https://wa.me/ if Desktop not installed.
 *
 * @param phone  Indian mobile number (10 digits, with or without +91)
 * @param text   Message to pre-fill
 */
export async function sendWhatsApp(phone: string, text: string): Promise<void> {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return;

  // Normalize to full international format (India +91)
  const e164 = digits.length === 10 ? `91${digits}` : digits.startsWith('91') ? digits : `91${digits.slice(-10)}`;

  const encoded = encodeURIComponent(text);

  try {
    // Try WhatsApp Desktop protocol first — opens app directly, no browser
    await shellOpen(`whatsapp://send?phone=${e164}&text=${encoded}`);
  } catch {
    // Fallback: open wa.me in system browser
    await shellOpen(`https://wa.me/${e164}?text=${encoded}`);
  }
}

/** Open WhatsApp without a specific recipient (for forwarding/sharing) */
export async function shareWhatsApp(text: string): Promise<void> {
  const encoded = encodeURIComponent(text);
  try {
    await shellOpen(`whatsapp://send?text=${encoded}`);
  } catch {
    await shellOpen(`https://wa.me/?text=${encoded}`);
  }
}

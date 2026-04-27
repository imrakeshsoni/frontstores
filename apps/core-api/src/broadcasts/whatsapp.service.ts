import { Injectable, Logger } from '@nestjs/common';

export interface WhatsAppCredentials {
  accessToken: string;
  phoneNumberId: string;
  apiVersion?: string;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  resolveCredentials(override?: Partial<WhatsAppCredentials>): WhatsAppCredentials | null {
    const accessToken = override?.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = override?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!accessToken || !phoneNumberId) return null;
    return {
      accessToken,
      phoneNumberId,
      apiVersion: override?.apiVersion ?? process.env.WHATSAPP_API_VERSION ?? 'v22.0',
    };
  }

  async sendTextMessage(
    to: string,
    body: string,
    creds?: Partial<WhatsAppCredentials>,
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    return this.sendMessage(to, { type: 'text', text: { preview_url: false, body } }, creds);
  }

  async sendTemplateMessage(
    to: string,
    templateName: string,
    languageCode: string,
    bodyParameters: string[] = [],
    creds?: Partial<WhatsAppCredentials>,
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const components = bodyParameters.length > 0
      ? [{ type: 'body', parameters: bodyParameters.map((text) => ({ type: 'text', text })) }]
      : undefined;

    return this.sendMessage(to, {
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components ? { components } : {}),
      },
    }, creds);
  }

  async uploadMedia(
    file: Buffer,
    mimeType: string,
    fileName: string,
    creds?: Partial<WhatsAppCredentials>,
  ): Promise<{ success: boolean; mediaId?: string; data?: unknown; error?: string }> {
    const resolved = this.resolveCredentials(creds);
    if (!resolved) {
      return { success: false, error: 'WhatsApp API is not configured. Add credentials in Settings → WhatsApp.' };
    }

    try {
      const formData = new FormData();
      formData.append('messaging_product', 'whatsapp');
      formData.append('file', new Blob([file], { type: mimeType }), fileName);

      const response = await fetch(
        `https://graph.facebook.com/${resolved.apiVersion}/${resolved.phoneNumberId}/media`,
        { method: 'POST', headers: { Authorization: `Bearer ${resolved.accessToken}` }, body: formData },
      );

      const data = (await response.json()) as { id?: string; error?: { message?: string } };
      if (!response.ok || !data?.id) {
        this.logger.error(`WhatsApp media upload failed: ${JSON.stringify(data)}`);
        return { success: false, error: data?.error?.message ?? 'WhatsApp media upload failed', data };
      }

      return { success: true, mediaId: data.id, data };
    } catch (error: any) {
      this.logger.error(`WhatsApp media upload error: ${error?.message ?? error}`);
      return { success: false, error: error?.message ?? 'WhatsApp media upload failed' };
    }
  }

  async sendImageMessage(
    to: string,
    mediaId: string,
    caption?: string,
    creds?: Partial<WhatsAppCredentials>,
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    return this.sendMessage(to, {
      type: 'image',
      image: { id: mediaId, ...(caption ? { caption } : {}) },
    }, creds);
  }

  private async sendMessage(
    to: string,
    payload: Record<string, unknown>,
    creds?: Partial<WhatsAppCredentials>,
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const resolved = this.resolveCredentials(creds);
    if (!resolved) {
      return { success: false, error: 'WhatsApp API is not configured. Add credentials in Settings → WhatsApp.' };
    }

    const normalizedPhone = normalizeWhatsAppPhone(to);
    if (!normalizedPhone) {
      return { success: false, error: `Invalid phone number: ${to}` };
    }

    try {
      const response = await fetch(
        `https://graph.facebook.com/${resolved.apiVersion}/${resolved.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${resolved.accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ messaging_product: 'whatsapp', to: normalizedPhone, ...payload }),
        },
      );

      const data = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        this.logger.error(`WhatsApp send failed for ${normalizedPhone}: ${JSON.stringify(data)}`);
        return { success: false, error: data?.error?.message ?? 'WhatsApp send failed', data };
      }

      return { success: true, data };
    } catch (error: any) {
      this.logger.error(`WhatsApp request error for ${normalizedPhone}: ${error?.message ?? error}`);
      return { success: false, error: error?.message ?? 'WhatsApp request failed' };
    }
  }
}

function normalizeWhatsAppPhone(value: string): string | null {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) return `91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

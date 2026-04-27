import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';

interface SignupEmailPayload {
  ownerEmail: string;
  ownerName: string;
  shopName: string;
  tenantSlug: string;
  password: string;
}

@Injectable()
export class SignupEmailService {
  private readonly logger = new Logger(SignupEmailService.name);

  async sendLoginDetails(payload: SignupEmailPayload): Promise<void> {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      this.logger.warn('Signup email skipped: SMTP_HOST, SMTP_USER, or SMTP_PASS is not configured');
      return;
    }

    const port = Number(process.env.SMTP_PORT ?? 587);
    const from = process.env.SMTP_FROM ?? user;
    const appUrl = process.env.APP_URL ?? 'https://frontstores.com';
    const loginUrl = `${appUrl.replace(/\/$/, '')}/login?slug=${encodeURIComponent(payload.tenantSlug)}`;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from,
      to: payload.ownerEmail,
      subject: `Your ${payload.shopName} ShopOS login details`,
      text: [
        `Hi ${payload.ownerName},`,
        '',
        `Your ${payload.shopName} ShopOS account is ready.`,
        '',
        `Login URL: ${loginUrl}`,
        `Shop ID: ${payload.tenantSlug}`,
        `Email: ${payload.ownerEmail}`,
        `Password: ${payload.password}`,
        '',
        'Please keep these details private.',
      ].join('\n'),
      html: `
        <p>Hi ${this.escapeHtml(payload.ownerName)},</p>
        <p>Your <strong>${this.escapeHtml(payload.shopName)}</strong> ShopOS account is ready.</p>
        <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">
          <tr><td style="padding:6px 12px 6px 0"><strong>Login URL</strong></td><td><a href="${loginUrl}">${loginUrl}</a></td></tr>
          <tr><td style="padding:6px 12px 6px 0"><strong>Shop ID</strong></td><td>${this.escapeHtml(payload.tenantSlug)}</td></tr>
          <tr><td style="padding:6px 12px 6px 0"><strong>Email</strong></td><td>${this.escapeHtml(payload.ownerEmail)}</td></tr>
          <tr><td style="padding:6px 12px 6px 0"><strong>Password</strong></td><td>${this.escapeHtml(payload.password)}</td></tr>
        </table>
        <p>Please keep these details private.</p>
      `,
    });

    this.logger.log(`Signup email sent to ${payload.ownerEmail} for tenant ${payload.tenantSlug}`);
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

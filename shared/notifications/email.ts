import nodemailer from 'nodemailer';
import { AppError, ExternalServiceError } from '@shared/errors';

export interface EmailDeliveryStatus {
  configured: boolean;
  enabled: boolean;
  from: string | null;
  host: string | null;
  appBaseUrl: string | null;
}

export interface SendOnboardingEmailInput {
  to: string;
  name: string;
  token: string;
  purpose: 'invite' | 'password_reset';
}

export function getEmailDeliveryStatus(): EmailDeliveryStatus {
  return {
    configured: Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_FROM),
    enabled: process.env.EMAIL_DELIVERY_ENABLED === 'true',
    from: process.env.SMTP_FROM || null,
    host: process.env.SMTP_HOST || null,
    appBaseUrl: process.env.APP_BASE_URL || null,
  };
}

export async function sendOnboardingEmail(input: SendOnboardingEmailInput): Promise<{ sent: true; messageId: string | null }> {
  const status = getEmailDeliveryStatus();
  if (!status.enabled) {
    throw new AppError('Email delivery is disabled. Set EMAIL_DELIVERY_ENABLED=true after SMTP is configured.', 424, 'EMAIL_DELIVERY_DISABLED');
  }
  if (!status.configured || !process.env.SMTP_HOST || !process.env.SMTP_PORT || !process.env.SMTP_FROM) {
    throw new AppError('SMTP is not configured. Required: SMTP_HOST, SMTP_PORT, SMTP_FROM.', 424, 'SMTP_NOT_CONFIGURED');
  }
  if (!process.env.APP_BASE_URL) {
    throw new AppError('APP_BASE_URL is required to send onboarding links.', 424, 'APP_BASE_URL_MISSING');
  }

  const secure = process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465';
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure,
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD || '',
        }
      : undefined,
  });

  const url = new URL('/accept-onboarding', process.env.APP_BASE_URL);
  url.searchParams.set('token', input.token);
  const subject = input.purpose === 'password_reset'
    ? 'Reset your Tanaghum password'
    : 'Set up your Tanaghum account';
  const action = input.purpose === 'password_reset' ? 'reset your password' : 'activate your account';
  const text = [
    `Hello ${input.name},`,
    '',
    `Use this secure one-time link to ${action}:`,
    url.toString(),
    '',
    'This link expires in 24 hours. If you did not request this, contact your administrator.',
  ].join('\n');

  try {
    const result = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: input.to,
      subject,
      text,
    });
    return { sent: true, messageId: result.messageId || null };
  } catch (err) {
    throw new ExternalServiceError('SMTP', err instanceof Error ? err.message : 'Email send failed');
  }
}

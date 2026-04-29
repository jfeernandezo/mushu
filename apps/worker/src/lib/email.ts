import { createLogger } from '@mushu/shared/logger';
import nodemailer, { type Transporter } from 'nodemailer';

const logger = createLogger('worker.email');

/**
 * Minimal SMTP sender for the worker. Mirrors the configuration of the web
 * app (`apps/web/src/lib/email.ts`) but without the bounce-gating and
 * delivery-log table writes — those are nice-to-haves for the worker's
 * occasional notification emails (token expiring) and add infra coupling
 * we don't need.
 */
let _transporter: Transporter | null = null;
let _warnedNoSmtp = false;

function getTransporter(): Transporter | null {
  if (_transporter) return _transporter;

  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !user || !pass) {
    if (!_warnedNoSmtp) {
      logger.warn(
        'SMTP not configured (SMTP_HOST/SMTP_USER/SMTP_PASSWORD missing) — sendEmail will no-op',
      );
      _warnedNoSmtp = true;
    }
    return null;
  }

  const port = Number.parseInt(process.env.SMTP_PORT ?? '465', 10);
  const secure =
    process.env.SMTP_SECURE === undefined ? port === 465 : process.env.SMTP_SECURE === 'true';

  _transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    pool: true,
    maxConnections: 2,
    maxMessages: 50,
  });
  return _transporter;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) return false;
  const from = process.env.EMAIL_FROM?.trim();
  if (!from) {
    logger.warn('EMAIL_FROM not set — refusing to send without a From address');
    return false;
  }
  try {
    await transporter.sendMail({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    return true;
  } catch (err) {
    logger.error({ to: params.to, err }, 'send failed');
    return false;
  }
}

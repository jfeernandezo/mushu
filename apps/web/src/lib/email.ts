import nodemailer, { type Transporter } from 'nodemailer';
import { isHosted } from './mode';

/**
 * Outbound email via the operator's own SMTP (Hostinger by default — see
 * SELF_HOSTING.md for setup). Used for:
 *
 *   - Better Auth email verification
 *   - Better Auth password reset
 *   - Workspace invitations (auth.api.createInvitation)
 *   - Owner-transfer notifications (Sprint C)
 *
 * Selfhost mode without SMTP configured: email becomes a no-op with a warning
 * in logs. Forks that want full functionality (verification, invites) need to
 * set SMTP_HOST / SMTP_USER / SMTP_PASSWORD / EMAIL_FROM. Hosted mode requires
 * them — instrumentation.ts crashes the boot otherwise.
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
      console.warn(
        '[email] SMTP not configured (SMTP_HOST/SMTP_USER/SMTP_PASSWORD missing) — sendEmail will no-op. Set them in .env to enable.',
      );
      _warnedNoSmtp = true;
    }
    return null;
  }

  const port = Number.parseInt(process.env.SMTP_PORT ?? '465', 10);
  // Hostinger: 465 wants TLS upfront (secure: true); 587 negotiates with STARTTLS (secure: false).
  const secure =
    process.env.SMTP_SECURE === undefined ? port === 465 : process.env.SMTP_SECURE === 'true';

  _transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    // Modest pool — Hostinger basic plans cap at ~100/day; pool of 5 keeps
    // bursts smooth without burning the quota.
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });

  return _transporter;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

/**
 * Send a transactional email. Returns true on success, false on no-op
 * (SMTP missing in selfhost) or send failure. Never throws — callers should
 * not block their primary flow on email delivery.
 */
export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) return false;

  const from = process.env.EMAIL_FROM?.trim();
  if (!from) {
    console.warn('[email] EMAIL_FROM not set — refusing to send without a From address');
    return false;
  }

  try {
    await transporter.sendMail({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text ?? stripHtml(params.html),
      replyTo: params.replyTo,
    });
    return true;
  } catch (e) {
    console.error('[email] sendMail failed', {
      to: params.to,
      subject: params.subject,
      error: e instanceof Error ? e.message : String(e),
    });
    return false;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Env vars required when MUSHU_MODE=hosted. Validated at startup by
 * apps/web/instrumentation.ts. Selfhost forks can leave them empty —
 * sendEmail() no-ops silently.
 */
export const HOSTED_EMAIL_REQUIRED_ENV = [
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'EMAIL_FROM',
] as const;

// Re-export so consumers can check capability:
export function isEmailEnabled(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASSWORD &&
      process.env.EMAIL_FROM?.trim(),
  );
}

void isHosted; // imported for future per-mode behavior; keeps symbol referenced

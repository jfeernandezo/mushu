import { randomUUID } from 'node:crypto';
import { dbAdmin, emailDelivery } from '@mushu/db';
import { createLogger } from '@mushu/shared/logger';
import { and, eq, gte, sql } from 'drizzle-orm';
import nodemailer, { type Transporter } from 'nodemailer';
import { isHosted } from './mode';

const logger = createLogger('web.email');

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
      logger.warn(
        'SMTP not configured (SMTP_HOST/SMTP_USER/SMTP_PASSWORD missing) — sendEmail will no-op',
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

export type EmailMessageType =
  | 'verification'
  | 'reset_password'
  | 'invitation'
  | 'ownership_transfer'
  | 'other';

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  /** Categorisation for the delivery log; defaults to 'other'. */
  messageType?: EmailMessageType;
}

export type SendEmailResult =
  | { ok: true }
  | { ok: false; reason: 'no_smtp' | 'no_from' | 'bounced_recently' | 'send_failed' };

const BOUNCE_LOOKBACK_DAYS = 30;
const BOUNCE_THRESHOLD = 3;

/**
 * Pre-send gate: refuse to send to a recipient that bounced 3+ times in the
 * last 30 days. Protects sender reputation (SPF/DKIM scoring) and avoids
 * burning Hostinger's daily quota on dead addresses.
 *
 * Comparison is case-insensitive — the index in 0007 is on `lower(email)`.
 */
async function isBounced(recipientEmail: string): Promise<boolean> {
  try {
    const since = new Date(Date.now() - BOUNCE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const [row] = await dbAdmin
      .select({ count: sql<number>`count(*)::int` })
      .from(emailDelivery)
      .where(
        and(
          sql`lower(${emailDelivery.recipientEmail}) = ${recipientEmail.toLowerCase()}`,
          eq(emailDelivery.status, 'bounced'),
          gte(emailDelivery.sentAt, since),
        ),
      );
    return (row?.count ?? 0) >= BOUNCE_THRESHOLD;
  } catch (err) {
    // Fail open — better to attempt a send than to block one because the
    // bounce table is unreachable.
    logger.error({ to: recipientEmail, err }, 'bounce check failed; allowing send');
    return false;
  }
}

async function recordDelivery(args: {
  to: string;
  subject: string;
  messageType: EmailMessageType;
  status: 'sent' | 'bounced' | 'deferred';
  smtpResponse?: string | null;
  errorMessage?: string | null;
}): Promise<void> {
  try {
    await dbAdmin.insert(emailDelivery).values({
      id: randomUUID(),
      recipientEmail: args.to,
      messageType: args.messageType,
      status: args.status,
      subject: args.subject,
      smtpResponse: args.smtpResponse ?? null,
      errorMessage: args.errorMessage ?? null,
    });
  } catch (err) {
    // Logging the failure is enough — we don't want a delivery-log outage to
    // block the primary email flow.
    logger.error({ to: args.to, status: args.status, err }, 'failed to record delivery');
  }
}

/**
 * Classify a nodemailer error as transient (deferred, will retry) or
 * permanent (bounced, mark recipient as bad).
 *
 * SMTP response codes:
 *   - 4xx → temporary failure (mailbox full, greylisting)
 *   - 5xx → permanent failure (no such user, blocked)
 *
 * Nodemailer surfaces the `responseCode` on the error when SMTP responded
 * with a numeric reply. Network errors have no responseCode — we treat
 * those as transient since the send may succeed on retry.
 */
function classifyError(err: unknown): {
  status: 'bounced' | 'deferred';
  smtpResponse: string | null;
  errorMessage: string;
} {
  const e = err as { responseCode?: number; response?: string; message?: string };
  const responseCode = typeof e?.responseCode === 'number' ? e.responseCode : null;
  const smtpResponse = e?.response ?? (responseCode ? String(responseCode) : null);
  const errorMessage = e?.message ?? String(err);
  if (responseCode && responseCode >= 500 && responseCode < 600) {
    return { status: 'bounced', smtpResponse, errorMessage };
  }
  return { status: 'deferred', smtpResponse, errorMessage };
}

/**
 * Send a transactional email.
 *
 * Behaviour:
 *   1. Refuse if SMTP isn't configured (selfhost without env vars).
 *   2. Refuse if EMAIL_FROM isn't set.
 *   3. Refuse if recipient has ≥3 `bounced` rows in last 30 days.
 *   4. Otherwise transmit; record outcome in `email_delivery`.
 *
 * Returns a discriminated result so callers can surface a precise UI message
 * ("your email bounced — fix it and try again") instead of a generic toast.
 *
 * `sendEmailLegacy` (boolean return) wraps this for backwards compatibility
 * with Better Auth callbacks that don't care about the rich result.
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const transporter = getTransporter();
  if (!transporter) return { ok: false, reason: 'no_smtp' };

  const from = process.env.EMAIL_FROM?.trim();
  if (!from) {
    logger.warn('EMAIL_FROM not set — refusing to send without a From address');
    return { ok: false, reason: 'no_from' };
  }

  const messageType: EmailMessageType = params.messageType ?? 'other';

  if (await isBounced(params.to)) {
    logger.warn({ to: params.to, message_type: messageType }, 'recipient marked as bounced; aborting send');
    return { ok: false, reason: 'bounced_recently' };
  }

  try {
    const info = await transporter.sendMail({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text ?? stripHtml(params.html),
      replyTo: params.replyTo,
    });
    await recordDelivery({
      to: params.to,
      subject: params.subject,
      messageType,
      status: 'sent',
      smtpResponse: info.response ?? null,
    });
    return { ok: true };
  } catch (err) {
    const classified = classifyError(err);
    logger.error(
      { to: params.to, subject: params.subject, smtp_status: classified.status, err },
      'sendMail failed',
    );
    await recordDelivery({
      to: params.to,
      subject: params.subject,
      messageType,
      status: classified.status,
      smtpResponse: classified.smtpResponse,
      errorMessage: classified.errorMessage,
    });
    return { ok: false, reason: 'send_failed' };
  }
}

/**
 * Boolean-returning wrapper for Better Auth callbacks — they expect a
 * Promise<void> or fire-and-forget; we use this to keep the original API
 * contract from Sprint A while the new code paths consume the rich result.
 */
export async function sendEmailLegacy(params: SendEmailParams): Promise<boolean> {
  const r = await sendEmail(params);
  return r.ok;
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

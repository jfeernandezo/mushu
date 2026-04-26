import { auditLog, db } from '@mushu/db';
import { headers as nextHeaders } from 'next/headers';

/**
 * Action codes used across audit log entries. Centralised so we can grep for
 * a code and find every site that records it.
 */
export const AUDIT_ACTIONS = {
  // Account lifecycle
  USER_SIGNUP: 'user.signup',
  USER_DELETE: 'user.delete',
  USER_PROFILE_UPDATE: 'user.profile_update',
  USER_PASSWORD_CHANGE: 'user.password_change',
  USER_DATA_EXPORT: 'user.data_export',

  // Sessions
  SESSION_REVOKE: 'session.revoke',
  SESSION_REVOKE_ALL: 'session.revoke_all',

  // Consent (LGPD art. 8 §2)
  USER_CONSENT_SIGNUP: 'user.consent_signup',

  // Instagram integration
  IG_CONNECT: 'ig.connect',
  IG_DISCONNECT: 'ig.disconnect',

  // Member management
  MEMBER_ROLE_CHANGE: 'member.role_change',
  MEMBER_REMOVE: 'member.remove',
  MEMBER_INVITE: 'member.invite',

  // Billing (used in Phase 6+)
  BILLING_CHECKOUT_STARTED: 'billing.checkout_started',
  BILLING_PLAN_CHANGED: 'billing.plan_changed',
  BILLING_SUBSCRIPTION_CANCELED: 'billing.subscription_canceled',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

interface RecordAuditParams {
  orgId: string | null;
  actorUserId: string | null;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Insert an audit_log row. Never throws — audit failures should not block the
 * user-facing action they're recording. We log errors instead so ops can
 * notice silent dropouts without breaking flows like "delete account".
 */
export async function recordAudit(params: RecordAuditParams): Promise<void> {
  try {
    await db.insert(auditLog).values({
      id: crypto.randomUUID(),
      organizationId: params.orgId,
      actorUserId: params.actorUserId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      metadata: (params.metadata ?? {}) as Record<string, unknown>,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
    });
  } catch (e) {
    console.error('[audit] failed to record entry', {
      action: params.action,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

/**
 * Pulls IP + User Agent from the incoming request, behind a reverse proxy.
 * Mushu is deployed behind nginx/Caddy in production — `x-forwarded-for` is
 * the canonical header (we take the first IP, the original client).
 */
export async function requestMeta(): Promise<{
  ipAddress: string | null;
  userAgent: string | null;
}> {
  const h = await nextHeaders();
  const fwd = h.get('x-forwarded-for');
  const ipAddress = fwd ? (fwd.split(',')[0]?.trim() ?? null) : h.get('x-real-ip');
  const userAgent = h.get('user-agent');
  return { ipAddress, userAgent };
}

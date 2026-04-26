'use server';

import { headers as nextHeaders } from 'next/headers';
import { AUDIT_ACTIONS, recordAudit, requestMeta } from '@/lib/audit';
import { auth } from '@/lib/auth';
import { PRIVACY_VERSION, TERMS_VERSION } from '@/lib/legal';

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Record that the user accepted Terms of Use and Privacy Policy at signup.
 * Called from the signup form right after a successful Better Auth sign-up,
 * which means the session cookie is set and we can resolve the user.
 *
 * LGPD art. 8 §2 requires the controller to be able to prove consent. The
 * audit_log row carries the document versions accepted, IP, and user agent.
 */
export async function recordSignupConsent(): Promise<ActionResult> {
  try {
    const session = await auth.api.getSession({ headers: await nextHeaders() });
    if (!session) return { ok: false, error: 'unauthenticated' };
    const meta = await requestMeta();
    await recordAudit({
      orgId: session.session.activeOrganizationId ?? null,
      actorUserId: session.user.id,
      action: AUDIT_ACTIONS.USER_CONSENT_SIGNUP,
      targetType: 'user',
      targetId: session.user.id,
      metadata: {
        termsVersion: TERMS_VERSION,
        privacyVersion: PRIVACY_VERSION,
        acceptedAdult: true,
      },
      ...meta,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown_error' };
  }
}

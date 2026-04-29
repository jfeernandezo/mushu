'use server';

import { instagramAccount, withOrgTx } from '@mushu/db';
import { createLogger } from '@mushu/shared/logger';
import { and, eq } from 'drizzle-orm';
import { headers as nextHeaders } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { AUDIT_ACTIONS, recordAudit, requestMeta } from '@/lib/audit';
import { auth } from '@/lib/auth';
import { decryptToken } from '@/lib/crypto';
import {
  unsubscribeInstagramWebhook,
  unsubscribeThreadsWebhook,
} from '@/lib/meta-subscriptions';

const logger = createLogger('web.connected-accounts');

const disconnectSchema = z.object({
  accountId: z.string().min(1),
});

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Disconnect a Meta-connected account (Instagram or Threads).
 *
 * Steps:
 *   1. Verify the account belongs to the active org.
 *   2. Best-effort: unsubscribe webhook on Meta's side so they stop sending
 *      events for an account we no longer have a token for.
 *   3. Delete the account row. Cascading FKs take care of:
 *      - conversations and messages (history is lost — by design, the
 *        account is gone)
 *      - flows tied exclusively to this account (their FK is set to cascade)
 *      - triggers, flow_executions
 *
 * Audit log captures who disconnected and which account, so any compliance
 * question afterwards has a paper trail.
 */
export async function disconnectAccount(
  input: z.input<typeof disconnectSchema>,
): Promise<ActionResult> {
  const parsed = disconnectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  const session = await auth.api.getSession({ headers: await nextHeaders() });
  if (!session) return { ok: false, error: 'unauthenticated' };
  const orgId = session.session.activeOrganizationId;
  if (!orgId) return { ok: false, error: 'no_active_org' };

  try {
    const result = await withOrgTx(orgId, async (tx) => {
      const [acc] = await tx
        .select()
        .from(instagramAccount)
        .where(
          and(
            eq(instagramAccount.id, parsed.data.accountId),
            eq(instagramAccount.organizationId, orgId),
          ),
        )
        .limit(1);
      if (!acc) return { found: false as const };

      let token: string | null = null;
      try {
        token = decryptToken({
          ciphertext: acc.accessTokenEncrypted,
          iv: acc.accessTokenIv,
          authTag: acc.accessTokenAuthTag,
        });
      } catch (err) {
        // Token undecryptable (e.g., key rotated). Skip Meta unsubscribe and
        // proceed with local delete.
        logger.warn({ account_id: acc.id, err }, 'cannot decrypt token, skipping unsubscribe');
      }

      await tx.delete(instagramAccount).where(eq(instagramAccount.id, acc.id));

      return {
        found: true as const,
        token,
        externalUserId: acc.igUserId,
        username: acc.igUsername,
        channel: acc.channel,
      };
    });

    if (!result.found) return { ok: false, error: 'not_found' };

    // Fire-and-forget the Meta-side unsubscribe outside the transaction so a
    // slow Meta call doesn't hold a Postgres connection. We don't await
    // success — the local row is already gone, which is what matters from
    // the user's perspective.
    if (result.token) {
      const args = { externalUserId: result.externalUserId, accessToken: result.token };
      void (result.channel === 'threads'
        ? unsubscribeThreadsWebhook(args)
        : unsubscribeInstagramWebhook(args));
    }

    const meta = await requestMeta();
    await recordAudit({
      orgId,
      actorUserId: session.user.id,
      action:
        result.channel === 'threads'
          ? AUDIT_ACTIONS.THREADS_DISCONNECT
          : AUDIT_ACTIONS.IG_DISCONNECT,
      targetType: result.channel === 'threads' ? 'threads_account' : 'instagram_account',
      targetId: result.externalUserId,
      metadata: { username: result.username, channel: result.channel },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    revalidatePath('/settings/workspace');
    return { ok: true };
  } catch (err) {
    logger.error({ err }, 'disconnect failed');
    return { ok: false, error: err instanceof Error ? err.message : 'unknown_error' };
  }
}

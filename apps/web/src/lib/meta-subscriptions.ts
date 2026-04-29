import { createLogger } from '@mushu/shared/logger';

const logger = createLogger('web.meta-subscriptions');

/**
 * Subscribe a connected Meta account to webhook events. Called from the
 * OAuth callback the moment we have a valid token + the account row.
 *
 * Returns true if Meta accepted the subscription. The caller flips
 * `instagram_account.webhook_subscribed` based on this. We don't throw on
 * failure — a failed subscription should NOT roll back the OAuth flow,
 * because the user can manually retry from the workspace settings page.
 */

const IG_FIELDS = [
  'comments',
  'messages',
  'messaging_postbacks',
  'messaging_seen',
  'messaging_reactions',
  'messaging_referral',
  'message_reactions',
];

const THREADS_FIELDS = ['replies', 'mentions'];

interface SubscribeArgs {
  /** External user id stored in instagram_account.ig_user_id. */
  externalUserId: string;
  /** Decrypted long-lived access token. */
  accessToken: string;
}

/**
 * IG subscription endpoint:
 *   POST https://graph.instagram.com/v23.0/{ig-user-id}/subscribed_apps
 *     ?subscribed_fields=<csv>
 *
 * Token must carry instagram_business_manage_messages and
 * instagram_business_manage_comments scopes. The App must also have a
 * webhook callback URL configured at the dashboard level — otherwise this
 * call returns success but no events are delivered.
 */
export async function subscribeInstagramWebhook(args: SubscribeArgs): Promise<boolean> {
  const url = new URL(`https://graph.instagram.com/v23.0/${args.externalUserId}/subscribed_apps`);
  url.searchParams.set('subscribed_fields', IG_FIELDS.join(','));
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${args.accessToken}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.error({ http_status: res.status, body }, 'IG subscribe failed');
      return false;
    }
    const json = (await res.json()) as { success?: boolean };
    return json.success !== false;
  } catch (err) {
    logger.error({ err }, 'IG subscribe threw');
    return false;
  }
}

/**
 * Threads subscription endpoint:
 *   POST https://graph.threads.net/v1.0/{user-id}/subscribed_apps
 *     ?subscribed_fields=replies,mentions
 *
 * Same shape as IG, different host. The App must have the Threads webhook
 * callback URL configured at the dashboard.
 */
export async function subscribeThreadsWebhook(args: SubscribeArgs): Promise<boolean> {
  const url = new URL(`https://graph.threads.net/v1.0/${args.externalUserId}/subscribed_apps`);
  url.searchParams.set('subscribed_fields', THREADS_FIELDS.join(','));
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${args.accessToken}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.error({ http_status: res.status, body }, 'Threads subscribe failed');
      return false;
    }
    const json = (await res.json()) as { success?: boolean };
    return json.success !== false;
  } catch (err) {
    logger.error({ err }, 'Threads subscribe threw');
    return false;
  }
}

/**
 * Reverse of `subscribe*Webhook`. Used by the disconnect flow before we
 * delete the account row, to stop Meta from sending events for an account
 * we no longer have a token for. Best-effort — if the token is already
 * invalid, the call fails and we proceed with the local cleanup anyway.
 */
export async function unsubscribeInstagramWebhook(args: SubscribeArgs): Promise<void> {
  const url = new URL(`https://graph.instagram.com/v23.0/${args.externalUserId}/subscribed_apps`);
  try {
    await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${args.accessToken}` },
    });
  } catch (err) {
    logger.warn({ err }, 'IG unsubscribe failed (continuing)');
  }
}

export async function unsubscribeThreadsWebhook(args: SubscribeArgs): Promise<void> {
  const url = new URL(`https://graph.threads.net/v1.0/${args.externalUserId}/subscribed_apps`);
  try {
    await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${args.accessToken}` },
    });
  } catch (err) {
    logger.warn({ err }, 'Threads unsubscribe failed (continuing)');
  }
}

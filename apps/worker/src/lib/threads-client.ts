import { decryptToken } from '@mushu/shared/crypto';
import type { InferSelectModel } from 'drizzle-orm';
import type { instagramAccount } from '@mushu/db';
import { IgError } from './instagram-client.ts';

export type ThreadsAccount = InferSelectModel<typeof instagramAccount>;

const GRAPH_BASE = 'https://graph.threads.net/v1.0';

export interface ThreadsClient {
  /**
   * Reply to a Threads post (or to another reply). Internally uses the
   * two-step "create container, then publish" flow that the Threads API
   * requires for posting.
   *
   * `commentId` here is the Threads media id of the post or reply we're
   * responding to (the value Meta sends as `value.id` in the `replies` /
   * `mentions` webhook).
   */
  replyComment(args: { commentId: string; message: string }): Promise<{ id: string }>;
}

/**
 * Threads channel client. Mirrors the surface of `IgClient.replyComment` so
 * worker code can dispatch through `ChannelClient` without caring about
 * provider specifics.
 *
 * Notes vs. Instagram:
 *   - Threads posting is two-step: POST /{user-id}/threads creates a media
 *     container and returns a creation_id; POST /{user-id}/threads_publish
 *     publishes it. This client hides that and exposes a single `replyComment`.
 *   - Threads has NO DM API today (Apr 2026). Webhook subscriptions only cover
 *     `replies`, `mentions`, `delete`, `publish`. DM methods are intentionally
 *     absent on this client — callers must branch by `account.channel`.
 *   - Errors reuse the IgError taxonomy (rate_limit / token_invalid /
 *     transient / permanent / window_expired) so error handling in the worker
 *     stays uniform across channels. `window_expired` is unreachable on
 *     Threads but kept in the union for type compatibility.
 */
export function createThreadsClient(account: ThreadsAccount): ThreadsClient {
  const token = decryptToken({
    ciphertext: account.accessTokenEncrypted,
    iv: account.accessTokenIv,
    authTag: account.accessTokenAuthTag,
  });

  async function call(
    path: string,
    init: { method?: string; body?: Record<string, unknown> } = {},
  ): Promise<Record<string, unknown>> {
    const method = init.method ?? 'POST';
    const url = `${GRAPH_BASE}${path}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: init.body ? JSON.stringify(init.body) : undefined,
      });
    } catch (err) {
      throw new IgError('transient', 'network error', undefined, undefined, err);
    }

    if (res.ok) {
      return (await res.json()) as Record<string, unknown>;
    }

    let body: { error?: { message?: string; code?: number; subcode?: number } } = {};
    try {
      body = (await res.json()) as typeof body;
    } catch {
      // ignore
    }
    const metaCode = body.error?.code;
    const message = body.error?.message ?? `HTTP ${res.status}`;

    // Threads inherits the Meta error-code namespace — the well-known values
    // we already classify for IG apply here too.
    if (res.status === 429 || metaCode === 4 || metaCode === 17 || metaCode === 32) {
      throw new IgError('rate_limit', message, res.status, metaCode);
    }
    if (metaCode === 190 || res.status === 401) {
      throw new IgError('token_invalid', message, res.status, metaCode);
    }
    if (res.status >= 500) {
      throw new IgError('transient', message, res.status, metaCode);
    }
    throw new IgError('permanent', message, res.status, metaCode);
  }

  return {
    async replyComment({ commentId, message }) {
      // Step 1: create a TEXT-type reply container.
      const create = await call(`/${account.igUserId}/threads`, {
        body: {
          media_type: 'TEXT',
          text: message,
          reply_to_id: commentId,
        },
      });
      const creationId = String(create.id ?? '');
      if (!creationId) {
        throw new IgError('permanent', 'threads create returned no id', undefined, undefined);
      }

      // Step 2: publish the container.
      const publish = await call(`/${account.igUserId}/threads_publish`, {
        body: { creation_id: creationId },
      });
      const publishedId = String(publish.id ?? creationId);
      return { id: publishedId };
    },
  };
}

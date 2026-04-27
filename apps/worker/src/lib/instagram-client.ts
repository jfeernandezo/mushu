import { decryptToken } from '@mushu/shared/crypto';
import type { InferSelectModel } from 'drizzle-orm';
import type { instagramAccount } from '@mushu/db';

export type InstagramAccount = InferSelectModel<typeof instagramAccount>;

const GRAPH_BASE = 'https://graph.instagram.com/v23.0';

/**
 * Errors classified by recoverability.
 *
 * - rate_limit: temporary — retry with backoff
 * - window_expired: permanent for this message — Mark failed, don't retry
 * - token_invalid: permanent for the account — surface to user, ask reconnect
 * - transient: network / 5xx — retry with backoff
 * - permanent: 4xx that isn't rate_limit/window — fail and log
 */
export type IgErrorKind =
  | 'rate_limit'
  | 'window_expired'
  | 'token_invalid'
  | 'transient'
  | 'permanent';

export class IgError extends Error {
  override readonly cause?: unknown;
  constructor(
    public readonly kind: IgErrorKind,
    message: string,
    public readonly statusCode?: number,
    public readonly metaCode?: number,
    cause?: unknown,
  ) {
    super(message);
    this.name = 'IgError';
    this.cause = cause;
  }
}

export interface QuickReply {
  /** Button label shown to the user. Meta caps at 20 chars. */
  title: string;
  /** Payload returned in the webhook when clicked. We set this = title so
   *  the next dm_keyword trigger can match against it as if the user typed it. */
  payload: string;
}

export interface IgClient {
  replyComment(args: { commentId: string; message: string }): Promise<{ id: string }>;
  sendDmByIgsid(args: {
    igsid: string;
    text: string;
    quickReplies?: QuickReply[];
  }): Promise<{ messageId: string }>;
  sendDmByCommentId(args: {
    commentId: string;
    text: string;
    quickReplies?: QuickReply[];
  }): Promise<{ messageId: string }>;
}

export function createIgClient(account: InstagramAccount): IgClient {
  const token = decryptToken({
    ciphertext: account.accessTokenEncrypted,
    iv: account.accessTokenIv,
    authTag: account.accessTokenAuthTag,
  });

  async function call(
    path: string,
    init: { method?: string; body?: Record<string, unknown> } = {},
  ) {
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

    // Meta error code reference: https://developers.facebook.com/docs/instagram-platform/reference/error-codes
    if (res.status === 429 || metaCode === 4 || metaCode === 17 || metaCode === 32) {
      throw new IgError('rate_limit', message, res.status, metaCode);
    }
    if (metaCode === 10 || metaCode === 200 || metaCode === 551) {
      // 10 = permission denied, 200 = permission error, 551 = user unavailable / can't message
      throw new IgError('window_expired', message, res.status, metaCode);
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
      const r = await call(`/${commentId}/replies`, { body: { message } });
      return { id: String(r.id ?? '') };
    },

    async sendDmByIgsid({ igsid, text, quickReplies }) {
      const r = await call('/me/messages', {
        body: {
          recipient: { id: igsid },
          message: buildMessageBody(text, quickReplies),
        },
      });
      return { messageId: String(r.message_id ?? '') };
    },

    async sendDmByCommentId({ commentId, text, quickReplies }) {
      // Sending DM in response to a comment uses recipient.comment_id —
      // this is the only way to start a DM in-thread without violating the
      // 24h messaging window.
      const r = await call('/me/messages', {
        body: {
          recipient: { comment_id: commentId },
          message: buildMessageBody(text, quickReplies),
        },
      });
      return { messageId: String(r.message_id ?? '') };
    },
  };
}

/**
 * Build the `message` field for Graph API. When quickReplies are provided we
 * attach them as `content_type: 'text'` chips. Meta caps each title at 20
 * chars and the array at 13 entries — the inspector enforces these too, but
 * we re-clamp here as defense in depth.
 */
function buildMessageBody(text: string, quickReplies?: QuickReply[]): Record<string, unknown> {
  const body: Record<string, unknown> = { text };
  if (quickReplies && quickReplies.length > 0) {
    body.quick_replies = quickReplies.slice(0, 13).map((qr) => ({
      content_type: 'text',
      title: qr.title.slice(0, 20),
      payload: (qr.payload || qr.title).slice(0, 1000),
    }));
  }
  return body;
}

import type { InferSelectModel } from 'drizzle-orm';
import type { instagramAccount } from '@mushu/db';
import { type IgClient, createIgClient } from './instagram-client.ts';
import { createThreadsClient } from './threads-client.ts';

export type Account = InferSelectModel<typeof instagramAccount>;

/**
 * Subset of provider operations that all channels support. Today this is just
 * `replyComment` (the only thing the Threads API exposes that maps cleanly to
 * Instagram comment replies). DM-related operations live on the Instagram-only
 * surface and callers branch on `account.channel`.
 */
export interface ChannelClient {
  replyComment(args: { commentId: string; message: string }): Promise<{ id: string }>;
}

export interface ChannelClients {
  channel: 'instagram' | 'threads';
  /** Common surface — works for any channel. */
  common: ChannelClient;
  /** Populated only when account.channel === 'instagram'. */
  instagram: IgClient | null;
}

/**
 * Factory that returns a channel-appropriate client. Callers that need DM
 * methods must inspect `clients.instagram` and handle the null case (i.e.
 * Threads accounts simply cannot send DMs — the API doesn't exist).
 */
export function createChannelClient(account: Account): ChannelClients {
  if (account.channel === 'threads') {
    const threads = createThreadsClient(account);
    return {
      channel: 'threads',
      common: threads,
      instagram: null,
    };
  }
  // Default + 'instagram'
  const ig = createIgClient(account);
  return {
    channel: 'instagram',
    common: ig,
    instagram: ig,
  };
}

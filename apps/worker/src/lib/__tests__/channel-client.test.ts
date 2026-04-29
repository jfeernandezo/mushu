import { beforeAll, describe, expect, it } from 'vitest';
import { encryptToken } from '@mushu/shared/crypto';
import { type Account, createChannelClient } from '../channel-client.ts';

/**
 * `createChannelClient` is the dispatch point that decides which provider
 * surface a worker job talks to. We don't make real HTTP calls in this test;
 * we only assert the SHAPE of the returned clients, which is the part the
 * send-message processor branches on:
 *
 *   - For Instagram accounts, `clients.instagram` is a populated IgClient
 *     (with sendDmByIgsid / sendDmByCommentId).
 *   - For Threads accounts, `clients.instagram` is null — the send-message
 *     processor uses this to refuse DM jobs with `dm_unsupported_for_channel`.
 *   - In both cases, `clients.common.replyComment` is callable (replyComment
 *     is the operation Threads can do; IG inherits it).
 */
function fakeAccount(channel: 'instagram' | 'threads'): Account {
  const enc = encryptToken('fake-token-' + channel);
  return {
    id: 'acc-' + channel,
    organizationId: 'org-1',
    channel,
    igUserId: '12345',
    igUsername: 'tester',
    pageId: null,
    accessTokenEncrypted: enc.ciphertext,
    accessTokenIv: enc.iv,
    accessTokenAuthTag: enc.authTag,
    expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    webhookSubscribed: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('createChannelClient', () => {
  beforeAll(() => {
    process.env.TOKEN_ENCRYPTION_KEY = 'a'.repeat(64);
  });

  it('returns instagram dispatch for an instagram account', () => {
    const clients = createChannelClient(fakeAccount('instagram'));
    expect(clients.channel).toBe('instagram');
    expect(clients.instagram).not.toBeNull();
    expect(typeof clients.common.replyComment).toBe('function');
    // IG-only methods present on the dedicated handle.
    expect(typeof clients.instagram?.sendDmByIgsid).toBe('function');
    expect(typeof clients.instagram?.sendDmByCommentId).toBe('function');
  });

  it('returns null instagram handle for a threads account', () => {
    const clients = createChannelClient(fakeAccount('threads'));
    expect(clients.channel).toBe('threads');
    expect(clients.instagram).toBeNull();
    expect(typeof clients.common.replyComment).toBe('function');
  });
});

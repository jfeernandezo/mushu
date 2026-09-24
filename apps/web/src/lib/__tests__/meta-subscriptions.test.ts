import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const logger = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn() }));
vi.mock('@mushu/shared/logger', () => ({ createLogger: () => logger }));

import { subscribeInstagramWebhook } from '../meta-subscriptions';

const fetchMock = vi.fn();
const args = { externalUserId: '123', accessToken: 'secret-test-token' };
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('Instagram webhook subscription', () => {
  it('subscribes only supported fields and keeps the token out of the URL', async () => {
    fetchMock.mockResolvedValue(Response.json({ success: true }));
    expect(await subscribeInstagramWebhook(args)).toBe(true);
    const call = fetchMock.mock.calls[0];
    if (!call) throw new Error('Expected a subscription request');
    const [url, init] = call;
    expect(url.origin).toBe('https://graph.instagram.com');
    expect(url.searchParams.get('subscribed_fields')?.split(',')).toEqual([
      'comments',
      'messages',
      'messaging_postbacks',
      'messaging_seen',
      'messaging_referral',
      'message_reactions',
    ]);
    expect(url.toString()).not.toContain(args.accessToken);
    expect(init.headers.Authorization).toBe(`Bearer ${args.accessToken}`);
  });

  it.each([
    {},
    { success: false },
    { success: 'true' },
    { error: { code: 190 } },
  ])('does not report success for an ambiguous HTTP 200: %j', async (body) => {
    fetchMock.mockResolvedValue(Response.json(body));
    expect(await subscribeInstagramWebhook(args)).toBe(false);
  });

  it('does not log response bodies or fetch errors that may contain credentials', async () => {
    fetchMock.mockResolvedValue(new Response(args.accessToken, { status: 400 }));
    expect(await subscribeInstagramWebhook(args)).toBe(false);
    fetchMock.mockRejectedValue(new Error(`request failed: ${args.accessToken}`));
    expect(await subscribeInstagramWebhook(args)).toBe(false);
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(args.accessToken);
  });

  it('handles malformed JSON without reporting a successful subscription', async () => {
    fetchMock.mockResolvedValue(new Response('not JSON'));
    expect(await subscribeInstagramWebhook(args)).toBe(false);
  });
});

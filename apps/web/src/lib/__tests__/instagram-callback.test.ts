import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  permission: vi.fn(),
  existing: [] as { id: string; organizationId: string }[],
  insert: vi.fn(),
  update: vi.fn(),
  subscribe: vi.fn(),
  encrypt: vi.fn(),
  session: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock('@mushu/db', () => ({
  instagramAccount: {
    id: 'id',
    organizationId: 'organizationId',
    igUserId: 'igUserId',
    channel: 'channel',
  },
  notification: {},
  session: {},
  dbAdmin: {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => mocks.existing }) }) }),
    insert: () => ({ values: mocks.insert }),
    update: () => ({ set: (values: unknown) => ({ where: () => mocks.update(values) }) }),
  },
}));
vi.mock('@mushu/shared/logger', () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn() }),
}));
vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: mocks.session } },
  ensureUserOrg: vi.fn(),
}));
vi.mock('@/lib/workspace-permission', () => ({ requireWorkspacePermission: mocks.permission }));
vi.mock('@/lib/crypto', () => ({ encryptToken: mocks.encrypt }));
vi.mock('@/lib/meta-subscriptions', () => ({ subscribeInstagramWebhook: mocks.subscribe }));
vi.mock('@/lib/audit', () => ({
  AUDIT_ACTIONS: { IG_CONNECT: 'ig.connect' },
  recordAudit: vi.fn(),
}));

import { GET } from '../../app/api/oauth/instagram/callback/route';

function request(query = 'code=test-code&state=test-state', cookie = 'test-state') {
  return new NextRequest(`https://mushu.example/api/oauth/instagram/callback?${query}`, {
    headers: { cookie: `mushu_ig_oauth_state=${cookie}` },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.existing = [];
  vi.stubGlobal('fetch', mocks.fetch);
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://mushu.example');
  vi.stubEnv('INSTAGRAM_APP_ID', '123');
  vi.stubEnv('INSTAGRAM_APP_SECRET', 'app-secret');
  vi.stubEnv('INSTAGRAM_OAUTH_REDIRECT_URI', 'https://mushu.example/api/oauth/instagram/callback');
  mocks.session.mockResolvedValue({
    user: { id: 'user' },
    session: { activeOrganizationId: 'org', id: 'session' },
  });
  mocks.encrypt.mockReturnValue({ ciphertext: 'encrypted', iv: 'iv', authTag: 'tag' });
  mocks.subscribe.mockResolvedValue(true);
  mocks.fetch
    .mockResolvedValueOnce(
      Response.json({ data: [{ access_token: 'short-token', user_id: '123' }] }),
    )
    .mockResolvedValueOnce(Response.json({ access_token: 'long-token', expires_in: 3600 }))
    .mockResolvedValueOnce(Response.json({ username: 'tester', account_type: 'BUSINESS' }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('Instagram OAuth callback', () => {
  it('rejects an unauthorized member before exchanging or persisting tokens', async () => {
    mocks.permission.mockRejectedValue(new Error('permission_denied'));
    const response = await GET(request());
    expect(response.headers.get('location')).toContain('ig_error=permission_denied');
    expect(mocks.permission).toHaveBeenCalledWith('user', 'org', 'instagram.connect');
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.subscribe).not.toHaveBeenCalled();
  });
  it('persists only encrypted credentials and returns to accounts with a consumed state cookie', async () => {
    const response = await GET(request());
    expect(response.headers.get('location')).toBe(
      'https://mushu.example/settings/workspace?ig_connected=1',
    );
    expect(response.cookies.get('mushu_ig_oauth_state')?.value).toBe('');
    expect(mocks.encrypt).toHaveBeenCalledWith('long-token');
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org',
        igUserId: '123',
        accessTokenEncrypted: 'encrypted',
        webhookSubscribed: true,
      }),
    );
    expect(JSON.stringify(mocks.insert.mock.calls)).not.toContain('long-token');
  });

  it('preserves the connected account and exposes a pending event subscription', async () => {
    mocks.subscribe.mockResolvedValue(false);
    const response = await GET(request());
    expect(response.headers.get('location')).toContain('ig_connected=webhook_pending');
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ webhookSubscribed: false }),
    );
  });

  it('rejects a mismatched state before calling Meta or saving data', async () => {
    const response = await GET(request(undefined, 'different-state'));
    expect(response.headers.get('location')).toContain('ig_error=state_mismatch');
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('does not transfer an existing account from another workspace or subscribe it', async () => {
    mocks.existing = [{ id: 'account', organizationId: 'other-org' }];
    const response = await GET(request());
    expect(response.headers.get('location')).toContain('ig_error=account_already_connected');
    expect(mocks.subscribe).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('refreshes an account in the same workspace without changing ownership', async () => {
    mocks.existing = [{ id: 'account', organizationId: 'org' }];
    await GET(request());
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ accessTokenEncrypted: 'encrypted' }),
    );
    expect(mocks.update.mock.calls[0]?.[0]).not.toHaveProperty('organizationId');
  });

  it('handles network failure with a recoverable redirect', async () => {
    mocks.fetch.mockReset().mockRejectedValue(new Error('fetch failed'));
    expect((await GET(request())).headers.get('location')).toContain(
      'ig_error=token_exchange_failed',
    );
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('rejects partial permissions before requesting a long-lived token', async () => {
    mocks.fetch.mockReset().mockResolvedValue(
      Response.json({
        access_token: 'short',
        user_id: '123',
        permissions: ['instagram_business_basic'],
      }),
    );
    expect((await GET(request())).headers.get('location')).toContain(
      'ig_error=missing_permissions',
    );
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('does not reflect arbitrary provider errors into the return URL', async () => {
    const response = await GET(request('error=denied%26ig_connected%3D1'));
    expect(response.headers.get('location')).toBe(
      'https://mushu.example/settings/workspace?ig_error=access_denied',
    );
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { refreshMetaToken } from '../refresh-meta-token.ts';

vi.mock('@mushu/shared/logger', () => ({ createLogger: () => ({ warn: vi.fn() }) }));
afterEach(() => vi.unstubAllGlobals());

function respond(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('refreshMetaToken', () => {
  it.each(['instagram', 'threads'])('validates refreshed %s credentials', async (channel) => {
    const request = respond({ access_token: 'new-token', expires_in: 5184000 });
    expect(await refreshMetaToken(channel, 'old-token')).toEqual({
      status: 'refreshed',
      accessToken: 'new-token',
      expiresIn: 5184000,
    });
    const call = request.mock.calls[0];
    if (!call) throw new Error('Expected refresh request');
    const [url, options] = call;
    expect(url.hostname).toBe(channel === 'threads' ? 'graph.threads.net' : 'graph.instagram.com');
    expect(url.searchParams.get('grant_type')).toBe(
      channel === 'threads' ? 'th_refresh_token' : 'ig_refresh_token',
    );
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(options.cache).toBe('no-store');
  });
  it.each([
    {},
    { access_token: '', expires_in: 60 },
    { access_token: 'new', expires_in: -1 },
    { access_token: 'new', expires_in: '60' },
    { access_token: 'new', expires_in: 1e20 },
  ])('does not overwrite credentials with malformed response %j', async (body) => {
    respond(body);
    expect(await refreshMetaToken('instagram', 'old')).toEqual({ status: 'retry' });
  });
  it.each([429, 500, 503])('preserves subscription on HTTP %s', async (status) => {
    respond({ error: { code: 190 } }, status);
    expect(await refreshMetaToken('instagram', 'old')).toEqual({ status: 'retry' });
  });
  it('recognizes an explicitly invalid token', async () => {
    respond({ error: { code: 190 } }, 400);
    expect(await refreshMetaToken('instagram', 'old')).toEqual({ status: 'invalid' });
  });
  it('retries network failures without exposing the error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('request URL contains secret')));
    expect(await refreshMetaToken('instagram', 'old')).toEqual({ status: 'retry' });
  });
  it('retries a non-JSON provider response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('unavailable', { status: 502 })));
    expect(await refreshMetaToken('instagram', 'old')).toEqual({ status: 'retry' });
  });
  it('does not send tokens from unknown channels', async () => {
    const request = respond({});
    expect(await refreshMetaToken('unknown', 'old')).toEqual({ status: 'retry' });
    expect(request).not.toHaveBeenCalled();
  });
});

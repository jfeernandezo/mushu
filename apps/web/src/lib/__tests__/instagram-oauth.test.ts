import { describe, expect, it } from 'vitest';
import {
  hasInstagramPermissions,
  INSTAGRAM_SCOPES,
  instagramLongTokenSchema,
  parseInstagramToken,
} from '../instagram-oauth';

describe('Instagram token responses', () => {
  it('accepts the documented envelope and the direct token response', () => {
    const token = { access_token: 'test-token', user_id: '12345678901234567890' };
    expect(parseInstagramToken({ data: [token] })).toEqual(token);
    expect(parseInstagramToken(token)).toEqual(token);
    expect(parseInstagramToken({ ...token, user_id: 123 }).user_id).toBe('123');
  });

  it.each([
    {},
    { data: [] },
    { access_token: '', user_id: '123' },
    { access_token: 'token', user_id: Number.MAX_SAFE_INTEGER + 1 },
    { access_token: 'token' },
    { error: { message: 'OAuth failed' } },
  ])('rejects malformed responses instead of persisting invalid credentials: %j', (value) => {
    expect(() => parseInstagramToken(value)).toThrow();
  });

  it('rejects partial authorization and accepts both permission formats', () => {
    expect(hasInstagramPermissions(['instagram_business_basic'])).toBe(false);
    expect(hasInstagramPermissions([])).toBe(false);
    expect(hasInstagramPermissions([...INSTAGRAM_SCOPES])).toBe(true);
    expect(hasInstagramPermissions(INSTAGRAM_SCOPES.join(', '))).toBe(true);
    expect(hasInstagramPermissions(undefined)).toBe(true);
  });

  it.each([0, -1, null, '3600'])('rejects invalid token lifetimes: %s', (expires_in) => {
    expect(instagramLongTokenSchema.safeParse({ access_token: 'token', expires_in }).success).toBe(
      false,
    );
  });
});

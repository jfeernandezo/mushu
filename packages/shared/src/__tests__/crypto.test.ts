import { beforeAll, describe, expect, it } from 'vitest';
import { decryptToken, encryptToken, verifyMetaSignature } from '../crypto.ts';

/**
 * Crypto is the firewall protecting Instagram tokens at rest. Failures here
 * leak access tokens to anyone with a DB dump. We assert two invariants:
 *   1. Round-trip plaintext → ciphertext → plaintext is lossless.
 *   2. Tampering with the ciphertext (or the auth tag, or the IV) makes
 *      decryption throw — we never return garbled plaintext silently.
 */
describe('encryptToken / decryptToken', () => {
  beforeAll(() => {
    // Stable test key — 64 hex chars = 32 bytes for AES-256.
    process.env.TOKEN_ENCRYPTION_KEY = 'a'.repeat(64);
  });

  it('round-trips a typical IG token', () => {
    const plaintext = 'EAABwzLixnjYBO_long_token_with_~_special-chars.123';
    const enc = encryptToken(plaintext);
    expect(decryptToken(enc)).toBe(plaintext);
  });

  it('round-trips empty string', () => {
    const enc = encryptToken('');
    expect(decryptToken(enc)).toBe('');
  });

  it('produces different ciphertexts for the same plaintext (random IV)', () => {
    const a = encryptToken('hello');
    const b = encryptToken('hello');
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.iv).not.toBe(b.iv);
  });

  it('throws on ciphertext tampering', () => {
    const enc = encryptToken('original');
    // Flip a byte in the base64 ciphertext by replacing the first char.
    const tampered = {
      ...enc,
      ciphertext: enc.ciphertext[0] === 'A' ? `B${enc.ciphertext.slice(1)}` : `A${enc.ciphertext.slice(1)}`,
    };
    expect(() => decryptToken(tampered)).toThrow();
  });

  it('throws on auth tag tampering', () => {
    const enc = encryptToken('original');
    const tampered = {
      ...enc,
      authTag: enc.authTag[0] === 'A' ? `B${enc.authTag.slice(1)}` : `A${enc.authTag.slice(1)}`,
    };
    expect(() => decryptToken(tampered)).toThrow();
  });

  it('throws when the IV is changed (different IV → different keystream)', () => {
    const enc = encryptToken('original');
    const tampered = {
      ...enc,
      iv: enc.iv[0] === 'A' ? `B${enc.iv.slice(1)}` : `A${enc.iv.slice(1)}`,
    };
    expect(() => decryptToken(tampered)).toThrow();
  });
});

describe('verifyMetaSignature', () => {
  const secret = 'app-secret-fixture';
  const body = '{"hello":"world"}';

  it('accepts a correctly signed payload', () => {
    // Real signature for body+secret above (computed manually below).
    // sha256 hmac, hex-encoded
    const validHeader = `sha256=${signFixture(body, secret)}`;
    expect(verifyMetaSignature(body, validHeader, secret)).toBe(true);
  });

  it('rejects when header is missing', () => {
    expect(verifyMetaSignature(body, null, secret)).toBe(false);
  });

  it('rejects on wrong scheme', () => {
    expect(verifyMetaSignature(body, `md5=${signFixture(body, secret)}`, secret)).toBe(false);
  });

  it('rejects on tampered body', () => {
    const validHeader = `sha256=${signFixture(body, secret)}`;
    expect(verifyMetaSignature('{"hello":"WORLD"}', validHeader, secret)).toBe(false);
  });

  it('rejects on wrong secret', () => {
    const validHeader = `sha256=${signFixture(body, secret)}`;
    expect(verifyMetaSignature(body, validHeader, 'other-secret')).toBe(false);
  });

  it('rejects malformed hex', () => {
    expect(verifyMetaSignature(body, 'sha256=ZZZZ', secret)).toBe(false);
  });
});

// Stand-alone fixture signer so the test asserts behavior of the production
// function rather than its own implementation.
function signFixture(body: string, secret: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHmac } = require('node:crypto') as typeof import('node:crypto');
  return createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

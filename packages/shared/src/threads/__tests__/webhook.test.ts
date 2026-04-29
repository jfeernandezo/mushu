import { describe, expect, it } from 'vitest';
import { threadsWebhookPayloadSchema } from '../webhook.ts';

/**
 * The webhook receiver in apps/web/src/app/api/webhooks/threads/route.ts
 * Zod-parses the raw body before persisting. A regression here drops every
 * Threads event silently (status 200, ignored: 'invalid_shape'), so we cover
 * the shapes Meta actually sends in production: a top-level `replies` event
 * and a top-level `mentions` event.
 */
describe('threadsWebhookPayloadSchema', () => {
  it('accepts a replies payload with media + text', () => {
    const payload = {
      object: 'threads',
      entry: [
        {
          id: '17841463355176558',
          time: 1753979120,
          changes: [
            {
              value: {
                from: { id: '808180894821223', username: 'jfeernandez' },
                media: { id: '18069466016328562' },
                id: '18051686009565870',
                text: 'fluxo',
              },
              field: 'replies',
            },
          ],
        },
      ],
    };
    const r = threadsWebhookPayloadSchema.safeParse(payload);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.entry[0]?.changes?.[0]?.field).toBe('replies');
      expect(r.data.entry[0]?.changes?.[0]?.value.text).toBe('fluxo');
    }
  });

  it('accepts a mentions payload without media (top-level mention)', () => {
    const payload = {
      object: 'threads',
      entry: [
        {
          id: '17841463355176558',
          changes: [
            {
              value: {
                from: { id: '808180894821223' },
                id: '18051686009565871',
                text: 'opa @mushu',
              },
              field: 'mentions',
            },
          ],
        },
      ],
    };
    const r = threadsWebhookPayloadSchema.safeParse(payload);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.entry[0]?.changes?.[0]?.field).toBe('mentions');
      // Media may be absent on standalone mentions — must not be a hard failure.
      expect(r.data.entry[0]?.changes?.[0]?.value.media).toBeUndefined();
    }
  });

  it('rejects payloads with the wrong object discriminator', () => {
    const payload = {
      object: 'instagram', // wrong — IG webhook hits a different route
      entry: [{ id: 'x' }],
    };
    const r = threadsWebhookPayloadSchema.safeParse(payload);
    expect(r.success).toBe(false);
  });

  it('rejects unknown change.field values', () => {
    const payload = {
      object: 'threads',
      entry: [
        {
          id: 'x',
          changes: [
            {
              value: { from: { id: '1' }, id: '2' },
              field: 'unsupported_event_type',
            },
          ],
        },
      ],
    };
    const r = threadsWebhookPayloadSchema.safeParse(payload);
    expect(r.success).toBe(false);
  });
});

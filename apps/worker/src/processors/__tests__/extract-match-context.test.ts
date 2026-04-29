import { describe, expect, it } from 'vitest';
import { extractMatchContext } from '../process-event.ts';

/**
 * extractMatchContext is the bridge between webhook payloads and the trigger
 * matcher: every event Meta sends gets normalised here. A regression silently
 * stops flows from firing.
 *
 * We cover:
 *   - IG comment with full media context
 *   - Threads reply (similar shape to IG comment, but parsed from a different
 *     event type discriminator)
 *   - Threads mention without media (top-level mention) — must NOT return null
 *   - IG DM
 *   - IG story_reply / story_mention
 *   - malformed payloads return null
 */
describe('extractMatchContext', () => {
  it('extracts IG comment context', () => {
    const ctx = extractMatchContext('comment', {
      change: {
        value: {
          from: { id: '808', username: 'alice' },
          media: { id: '180' },
          id: '1805',
          text: 'oi',
        },
      },
    });
    expect(ctx).toEqual({
      kind: 'comment',
      text: 'oi',
      actorIgsid: '808',
      actorUsername: 'alice',
      postId: '180',
      sourceId: '1805',
    });
  });

  it('extracts Threads reply as a comment-kind context', () => {
    const ctx = extractMatchContext('threads_reply', {
      change: {
        value: {
          from: { id: '808', username: 'alice' },
          media: { id: '180' },
          id: '1805',
          text: 'fluxo',
        },
      },
    });
    // Threads replies are deliberately mapped to kind='comment' so that
    // existing comment_keyword triggers fire for them without a new trigger
    // type — the channel is determined by the account FK.
    expect(ctx?.kind).toBe('comment');
    expect(ctx?.text).toBe('fluxo');
    expect(ctx?.postId).toBe('180');
  });

  it('accepts a Threads mention without media (top-level mention)', () => {
    const ctx = extractMatchContext('threads_mention', {
      change: {
        value: {
          from: { id: '808' },
          // no media field
          id: '1805',
          text: '@mushu olha isso',
        },
      },
    });
    expect(ctx).not.toBeNull();
    expect(ctx?.kind).toBe('comment');
    expect(ctx?.postId).toBeNull();
  });

  it('extracts IG DM context', () => {
    const ctx = extractMatchContext('message', {
      messaging: {
        sender: { id: '808' },
        message: { mid: 'mid-1', text: 'oi' },
      },
    });
    expect(ctx).toEqual({
      kind: 'dm',
      text: 'oi',
      actorIgsid: '808',
      actorUsername: null,
      postId: null,
      sourceId: 'mid-1',
    });
  });

  it('returns null for an IG DM with no text body (echo-shape)', () => {
    const ctx = extractMatchContext('message', {
      messaging: {
        sender: { id: '808' },
        message: { mid: 'mid-2' },
      },
    });
    expect(ctx).toBeNull();
  });

  it('extracts story_reply with kind=story_reply', () => {
    const ctx = extractMatchContext('story_reply', {
      messaging: {
        sender: { id: '808' },
        message: { mid: 'mid-3', text: 'amei' },
      },
    });
    expect(ctx?.kind).toBe('story_reply');
  });

  it('returns null for unknown event types', () => {
    expect(extractMatchContext('message_reaction', { messaging: {} })).toBeNull();
    expect(extractMatchContext('garbage', {})).toBeNull();
  });

  it('returns null for an IG comment missing required fields', () => {
    const ctx = extractMatchContext('comment', {
      change: {
        value: {
          // missing `from`
          media: { id: '180' },
          id: '1805',
        },
      },
    });
    expect(ctx).toBeNull();
  });
});

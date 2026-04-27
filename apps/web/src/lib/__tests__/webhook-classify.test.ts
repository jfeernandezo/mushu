import { describe, expect, it } from 'vitest';
import { classifyMessagingType } from '../webhook-classify.ts';

/**
 * classifyMessagingType is the dispatcher that routes Meta webhook messaging
 * events to the right downstream trigger lookup. Mistyping a story reply as a
 * regular DM means the wrong trigger fires (or none at all). We cover every
 * branch.
 */
describe('classifyMessagingType', () => {
  it('returns message_echo for echo messages (regardless of other flags)', () => {
    expect(
      classifyMessagingType(
        { message: { is_echo: true, reply_to: { story: { id: 'x' } } } },
        true,
      ),
    ).toBe('message_echo');
  });

  it('returns message_reaction when reaction is present', () => {
    expect(classifyMessagingType({ reaction: { action: 'react' } }, false)).toBe(
      'message_reaction',
    );
  });

  it('returns message_seen when read receipt is present', () => {
    expect(classifyMessagingType({ read: { mid: 'm1' } }, false)).toBe('message_seen');
  });

  it('returns story_reply when message.reply_to.story is set', () => {
    expect(
      classifyMessagingType({ message: { reply_to: { story: { id: 's1' } } } }, false),
    ).toBe('story_reply');
  });

  it('returns story_mention when an attachment of type story_mention is present', () => {
    expect(
      classifyMessagingType(
        { message: { attachments: [{ type: 'story_mention' }] } },
        false,
      ),
    ).toBe('story_mention');
  });

  it('returns message for plain DMs', () => {
    expect(classifyMessagingType({ message: { attachments: [] } }, false)).toBe('message');
    expect(classifyMessagingType({}, false)).toBe('message');
  });

  it('story_reply takes precedence over story_mention if both are present', () => {
    expect(
      classifyMessagingType(
        {
          message: {
            reply_to: { story: { id: 's' } },
            attachments: [{ type: 'story_mention' }],
          },
        },
        false,
      ),
    ).toBe('story_reply');
  });

  it('reaction takes precedence over story_reply', () => {
    expect(
      classifyMessagingType(
        {
          reaction: { action: 'react' },
          message: { reply_to: { story: { id: 's' } } },
        },
        false,
      ),
    ).toBe('message_reaction');
  });

  it('ignores attachments of types other than story_mention', () => {
    expect(
      classifyMessagingType({ message: { attachments: [{ type: 'image' }] } }, false),
    ).toBe('message');
  });
});

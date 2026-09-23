import { describe, expect, it } from 'vitest';
import { buildMessageBody } from '../instagram-client.ts';

describe('buildMessageBody', () => {
  it('sends plain text when there are no buttons', () => {
    expect(buildMessageBody('oi')).toEqual({ text: 'oi' });
  });

  it('wraps text + link buttons in a button template', () => {
    const body = buildMessageBody('Aqui 👇', undefined, [
      { title: 'Acessar', url: 'https://exemplo.com' },
    ]) as Record<string, any>;
    expect(body.text).toBeUndefined();
    expect(body.attachment).toEqual({
      type: 'template',
      payload: {
        template_type: 'button',
        text: 'Aqui 👇',
        buttons: [{ type: 'web_url', url: 'https://exemplo.com', title: 'Acessar' }],
      },
    });
  });

  it('caps at 3 buttons and 640 chars of text', () => {
    const buttons = Array.from({ length: 5 }, (_, i) => ({
      title: `B${i}`,
      url: `https://exemplo.com/${i}`,
    }));
    const body = buildMessageBody('x'.repeat(900), undefined, buttons) as Record<string, any>;
    expect(body.attachment.payload.buttons).toHaveLength(3);
    expect(body.attachment.payload.text).toHaveLength(640);
  });

  it('keeps quick replies alongside buttons', () => {
    const body = buildMessageBody('oi', [{ title: 'Sim', payload: 'Sim' }], [
      { title: 'Link', url: 'https://exemplo.com' },
    ]) as Record<string, any>;
    expect(body.quick_replies).toEqual([
      { content_type: 'text', title: 'Sim', payload: 'Sim' },
    ]);
  });
});

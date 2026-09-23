import { describe, expect, it } from 'vitest';
import { flowNodeSchema } from '../nodes.ts';

const pos = { x: 0, y: 0 };

describe('flowNodeSchema — follow gate', () => {
  it('accepts logic.check_follow', () => {
    const r = flowNodeSchema.safeParse({ id: 'n1', type: 'logic.check_follow', position: pos, data: {} });
    expect(r.success).toBe(true);
  });

  it('accepts send_dm with up to 3 link buttons', () => {
    const r = flowNodeSchema.safeParse({
      id: 'n2',
      type: 'action.send_dm',
      position: pos,
      data: { text: 'oi', buttons: [{ title: 'Acessar', url: 'https://exemplo.com' }] },
    });
    expect(r.success).toBe(true);
  });

  it('rejects a 4th button, a long title and a non-http url', () => {
    const b = { title: 'Ok', url: 'https://exemplo.com' };
    const base = { id: 'n3', type: 'action.send_dm', position: pos };
    expect(flowNodeSchema.safeParse({ ...base, data: { text: 'oi', buttons: [b, b, b, b] } }).success).toBe(false);
    expect(flowNodeSchema.safeParse({ ...base, data: { text: 'oi', buttons: [{ ...b, title: 'x'.repeat(21) }] } }).success).toBe(false);
    expect(flowNodeSchema.safeParse({ ...base, data: { text: 'oi', buttons: [{ ...b, url: 'javascript:alert(1)' }] } }).success).toBe(false);
  });

  it('accepts quick replies on ask_question', () => {
    const r = flowNodeSchema.safeParse({
      id: 'n4',
      type: 'action.ask_question',
      position: pos,
      data: { questionText: 'Quer?', variableName: 'pediu_link', quickReplies: ['Quero o link'] },
    });
    expect(r.success).toBe(true);
  });
});

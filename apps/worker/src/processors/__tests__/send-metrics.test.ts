import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rows: [] as unknown[][],
  msg: {} as Record<string, unknown>,
  outcome: vi.fn(),
  update: vi.fn(),
  reply: vi.fn(),
}));
vi.mock('@mushu/db', async (original) => {
  const actual = await original<typeof import('@mushu/db')>();
  return {
    ...actual,
    dbAdmin: {
      select: () => ({
        from: () => ({ where: () => ({ limit: async () => mocks.rows.shift() ?? [] }) }),
      }),
      update: (table: unknown) => ({
        set: (values: unknown) => {
          mocks.update(table, values);
          return { where: () => ({ returning: async () => [mocks.msg] }) };
        },
      }),
    },
  };
});
vi.mock('../../queues.ts', () => ({ executionQueue: { add: vi.fn() }, connection: {} }));
vi.mock('../../lib/rate-limiter.ts', () => ({
  RateLimiter: class {
    async consume() {
      return true;
    }
  },
}));
vi.mock('../../lib/inbox-broadcast.ts', () => ({ publishInboxEvent: vi.fn() }));
vi.mock('../../lib/flow-metrics.ts', () => ({ setStepOutcome: mocks.outcome }));
vi.mock('../../lib/channel-client.ts', () => ({
  createChannelClient: () => ({ common: { replyComment: mocks.reply } }),
}));

import { flowExecution } from '@mushu/db';
import { IgError } from '../../lib/instagram-client.ts';
import { failExhaustedMessage, sendMessage } from '../send-message.ts';

const args = { outgoingMessageId: 'msg', flowExecutionId: 'run' };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.msg = {
    id: 'msg',
    status: 'queued',
    instagramAccountId: 'account',
    conversationId: 'conversation',
    messageType: 'activity',
    content: 'Hello',
    createdByAutomationId: 'run',
    contentAttributes: { nodeId: 'send', holdCursor: true },
  };
  mocks.rows = [
    [mocks.msg],
    [{ id: 'run', status: 'active', state: { triggerCommentId: 'comment' } }],
    [{ id: 'account', organizationId: 'org' }],
    [{ id: 'conversation' }],
  ];
  mocks.reply.mockResolvedValue({ id: 'meta-id' });
});
describe('asynchronous step outcomes', () => {
  it('marks the existing step successful after delivery', async () => {
    await sendMessage(args);
    expect(mocks.outcome).toHaveBeenCalledExactlyOnceWith('run', 'send', 'ok');
  });
  it('marks permanent API errors as failed on the step and execution', async () => {
    mocks.reply.mockRejectedValue(new IgError('permanent', 'rejected'));
    await sendMessage(args);
    expect(mocks.outcome).toHaveBeenCalledExactlyOnceWith('run', 'send', 'failed');
    expect(mocks.update).toHaveBeenCalledWith(
      flowExecution,
      expect.objectContaining({ status: 'failed' }),
    );
  });
  it('leaves transient API failures queued until retries are exhausted', async () => {
    mocks.reply.mockRejectedValue(new IgError('transient', 'unavailable'));
    await expect(sendMessage(args)).rejects.toThrow('unavailable');
    expect(mocks.outcome).not.toHaveBeenCalled();
    mocks.rows = [[mocks.msg]];
    await failExhaustedMessage(args, new Error('unavailable'));
    expect(mocks.outcome).toHaveBeenCalledExactlyOnceWith('run', 'send', 'failed');
  });
  it('does not mark a delivered message failed when a later operation exhausts retries', async () => {
    mocks.rows = [[{ ...mocks.msg, status: 'sent' }]];
    await failExhaustedMessage(args, new Error('broadcast unavailable'));
    expect(mocks.outcome).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  execution: {} as Record<string, unknown>,
  inserts: [] as { table: unknown; values: Record<string, unknown> }[],
  selectRows: [] as unknown[],
  update: vi.fn(),
  outcome: vi.fn(),
  enqueue: vi.fn(),
  profile: vi.fn(),
  failInsert: false,
}));
vi.mock('@mushu/db', async (original) => {
  const actual = await original<typeof import('@mushu/db')>();
  return {
    ...actual,
    dbAdmin: {
      update: (table: unknown) => ({
        set: (values: Record<string, unknown>) => {
          mocks.update(table, values);
          return { where: () => ({ returning: async () => [mocks.execution] }) };
        },
      }),
      insert: (table: unknown) => ({
        values: (values: Record<string, unknown>) => {
          if (mocks.failInsert && table === actual.contactTag)
            throw new Error('database unavailable');
          mocks.inserts.push({ table, values });
          return { onConflictDoNothing: async () => {} };
        },
      }),
      select: () => ({
        from: () => {
          const query = {
            innerJoin: () => query,
            where: () => query,
            limit: async () => mocks.selectRows,
          };
          return query;
        },
      }),
    },
  };
});
vi.mock('../../queues.ts', () => ({
  executionQueue: { add: mocks.enqueue },
  messageQueue: { add: mocks.enqueue },
}));
vi.mock('../../lib/flow-metrics.ts', () => ({ setStepOutcome: mocks.outcome }));
vi.mock('../../lib/channel-client.ts', () => ({
  createChannelClient: () => ({ instagram: { getUserProfile: mocks.profile } }),
}));

import { flowExecution, flowStepEvent, message, trackedLink } from '@mushu/db';
import { executeFlow } from '../execute-flow.ts';

const node = (id: string, type: string, data = {}) => ({
  id,
  type,
  data,
  position: { x: 0, y: 0 },
});
function setup(
  nodes: ReturnType<typeof node>[],
  edges: { source: string; target: string; sourceHandle?: string }[] = [],
) {
  mocks.execution = {
    id: 'run',
    flowId: 'flow',
    organizationId: 'org',
    contactId: 'contact',
    instagramAccountId: 'account',
    conversationId: 'conversation',
    status: 'active',
    currentNodeId: nodes[0]?.id,
    visitedNodes: [],
    state: {},
    graphSnapshot: { nodes, edges: edges.map((edge, i) => ({ id: `edge-${i}`, ...edge })) },
  };
}
function events() {
  return mocks.inserts.filter((row) => row.table === flowStepEvent).map((row) => row.values);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.inserts = [];
  mocks.selectRows = [];
  mocks.failInsert = false;
  vi.stubEnv('APP_URL', 'https://mushu.example');
});

describe('flow step instrumentation', () => {
  it('records trigger, synchronous action and terminal once, with tenant and execution IDs', async () => {
    setup(
      [
        node('start', 'trigger.first_dm'),
        node('tag', 'action.set_tag', { tag: 'lead', operation: 'add' }),
        node('end', 'control.end'),
      ],
      [
        { source: 'start', target: 'tag' },
        { source: 'tag', target: 'end' },
      ],
    );
    await executeFlow({ flowExecutionId: 'run' });
    expect(events().map((event) => event.nodeId)).toEqual(['start', 'tag', 'end']);
    expect(events()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ organizationId: 'org', flowId: 'flow', executionId: 'run' }),
      ]),
    );
    expect(mocks.outcome.mock.calls).toEqual([
      ['run', 'start', 'ok'],
      ['run', 'tag', 'ok'],
      ['run', 'end', 'ok'],
    ]);
  });

  it.each([
    true,
    false,
  ])('records the check-follow handle and only the selected branch (%s)', async (follows) => {
    setup(
      [node('check', 'logic.check_follow'), node('yes', 'control.end'), node('no', 'control.end')],
      [
        { source: 'check', target: 'yes', sourceHandle: 'follows' },
        { source: 'check', target: 'no', sourceHandle: 'not_follows' },
      ],
    );
    mocks.selectRows = [{ igsid: '123', account: {} }];
    mocks.profile.mockResolvedValue({ isFollower: follows, username: 'person' });
    await executeFlow({ flowExecutionId: 'run' });
    expect(mocks.outcome).toHaveBeenCalledWith('run', 'check', follows ? 'follows' : 'not_follows');
    expect(events().map((event) => event.nodeId)).toEqual(['check', follows ? 'yes' : 'no']);
  });

  it('persists tracked destinations and queues URLs only after the step and cursor are saved', async () => {
    setup([
      node('send', 'action.send_dm', {
        text: 'Hello',
        buttons: [{ title: 'Visit', url: 'https://example.com/path?q=1' }],
      }),
    ]);
    mocks.enqueue.mockImplementationOnce(async () => {
      expect(events()[0]?.outcome).toBe('queued');
      expect(mocks.update).toHaveBeenCalledWith(
        flowExecution,
        expect.objectContaining({ currentNodeId: 'send', isReplying: false }),
      );
      // Simulate send worker finishing before execute-flow returns.
      await mocks.outcome('run', 'send', 'ok');
    });
    await executeFlow({ flowExecutionId: 'run' });
    const link = mocks.inserts.find((r) => r.table === trackedLink)?.values;
    const msg = mocks.inserts.find((r) => r.table === message)?.values;
    expect(link).toMatchObject({
      organizationId: 'org',
      executionId: 'run',
      nodeId: 'send',
      url: 'https://example.com/path?q=1',
    });
    expect(msg?.contentAttributes).toMatchObject({
      buttons: [{ title: 'Visit', url: `https://mushu.example/r/${link?.id}` }],
    });
    expect(mocks.outcome.mock.calls).toEqual([['run', 'send', 'ok']]);
  });

  it('records failures and releases the lock so transient failures can retry', async () => {
    setup([node('tag', 'action.set_tag', { tag: 'lead', operation: 'add' })]);
    mocks.failInsert = true;
    await expect(executeFlow({ flowExecutionId: 'run' })).rejects.toThrow('database unavailable');
    expect(mocks.outcome).toHaveBeenCalledWith('run', 'tag', 'failed');
    expect(mocks.update).toHaveBeenCalledWith(
      flowExecution,
      expect.objectContaining({ isReplying: false }),
    );
  });

  it('records a delay once and schedules its successor', async () => {
    setup(
      [node('wait', 'logic.delay', { durationSeconds: 60 }), node('end', 'control.end')],
      [{ source: 'wait', target: 'end' }],
    );
    await executeFlow({ flowExecutionId: 'run' });
    expect(events().map((event) => event.nodeId)).toEqual(['wait']);
    expect(mocks.outcome).toHaveBeenCalledWith('run', 'wait', 'ok');
    expect(mocks.enqueue).toHaveBeenCalledWith(
      'execute',
      { flowExecutionId: 'run' },
      expect.objectContaining({ delay: 60000 }),
    );
  });
});

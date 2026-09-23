import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rows: [] as unknown[], insert: vi.fn(), select: vi.fn() }));
vi.mock('@mushu/db', async (original) => {
  const actual = await original<typeof import('@mushu/db')>();
  return {
    ...actual,
    dbAdmin: {
      select: () => {
        mocks.select();
        return {
          from: () => ({ innerJoin: () => ({ where: () => ({ limit: async () => mocks.rows }) }) }),
        };
      },
      insert: () => ({ values: mocks.insert }),
    },
  };
});

import { GET, HEAD } from '../route';

const id = '7b39d3e0-2637-45c2-91c6-ef49183fbd39';
const request = new Request(`https://mushu.example/r/${id}?url=https://attacker.example`);
const context = { params: Promise.resolve({ id }) };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.rows = [
    {
      flowId: 'flow',
      link: {
        organizationId: 'org',
        executionId: 'run',
        nodeId: 'send',
        url: 'https://example.com/path?q=1',
      },
    },
  ];
});
describe('tracked redirects', () => {
  it('records a scoped click, redirects to the stored destination and disables caching', async () => {
    const response = await GET(request, context);
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://example.com/path?q=1');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org',
        flowId: 'flow',
        executionId: 'run',
        nodeId: 'send',
        outcome: 'click',
      }),
    );
  });
  it('rejects unknown tokens without recording clicks', async () => {
    mocks.rows = [];
    expect((await GET(request, context)).status).toBe(404);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it('rejects malformed tokens before accessing the database', async () => {
    expect((await GET(request, { params: Promise.resolve({ id: 'bad' }) })).status).toBe(404);
    expect(mocks.select).not.toHaveBeenCalled();
  });
  it('rejects non-HTTP destinations', async () => {
    mocks.rows = [{ flowId: 'flow', link: { url: 'javascript:alert(1)' } }];
    expect((await GET(request, context)).status).toBe(410);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it('does not count HEAD previews', async () => {
    expect((await HEAD()).status).toBe(405);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});

import { PgDialect } from 'drizzle-orm/pg-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock('@mushu/db', async (original) => ({
  ...(await original<typeof import('@mushu/db')>()),
  dbAdmin: { execute: mocks.execute },
}));

import { sweepIncomingEvents } from '../sweep-events.ts';

beforeEach(() => {
  mocks.execute.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-24T03:00:00.000Z'));
});
afterEach(() => vi.useRealTimers());

describe('incoming event retention', () => {
  it('encodes the 90-day cutoff as a PostgreSQL parameter instead of a raw Date', async () => {
    mocks.execute.mockResolvedValue([]);
    await sweepIncomingEvents();
    const firstCall = mocks.execute.mock.calls[0];
    if (!firstCall) throw new Error('Expected a retention query');
    const query = new PgDialect().sqlToQuery(firstCall[0]);
    expect(query.params).toEqual(['2026-06-26T03:00:00.000Z', 5000]);
    expect(query.sql).toContain('"incoming_event"."created_at" < $1');
    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });

  it('continues after a full batch and stops after a partial batch', async () => {
    mocks.execute.mockResolvedValueOnce(Array.from({ length: 5000 }, () => ({ id: 'old' })));
    mocks.execute.mockResolvedValueOnce([{ id: 'last' }]);
    await sweepIncomingEvents();
    expect(mocks.execute).toHaveBeenCalledTimes(2);
  });

  it('caps a run at 50 batches', async () => {
    mocks.execute.mockResolvedValue(Array.from({ length: 5000 }, () => ({ id: 'old' })));
    await sweepIncomingEvents();
    expect(mocks.execute).toHaveBeenCalledTimes(50);
  });

  it('propagates database failures so the queue can report them', async () => {
    mocks.execute.mockRejectedValue(new Error('database unavailable'));
    await expect(sweepIncomingEvents()).rejects.toThrow('database unavailable');
    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });
});

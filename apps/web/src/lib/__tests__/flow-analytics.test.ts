import { describe, expect, it } from 'vitest';
import { buildFlowAnalytics } from '../flow-analytics';

const graph = {
  nodes: [
    { id: 'end', type: 'control.end', position: { x: 0, y: 0 }, data: {} },
    { id: 'start', type: 'trigger.first_dm', position: { x: 0, y: 0 }, data: {} },
  ],
  edges: [{ id: 'edge', source: 'start', target: 'end' }],
};

describe('analytics aggregation', () => {
  it('does not count clicks as reached steps and keeps historical nodes after edits', () => {
    const [result] = buildFlowAnalytics(
      [{ id: 'a', name: 'A', graph }],
      [{ flowId: 'a', started: 4, completed: 1, failed: 1 }],
      [
        { flowId: 'a', nodeId: 'old', nodeType: 'action.send_dm', outcome: 'ok', count: 2 },
        { flowId: 'a', nodeId: 'old', nodeType: 'action.send_dm', outcome: 'failed', count: 1 },
        { flowId: 'a', nodeId: 'old', nodeType: 'action.send_dm', outcome: 'click', count: 9 },
        { flowId: 'b', nodeId: 'start', nodeType: 'trigger.first_dm', outcome: 'ok', count: 100 },
      ],
    );
    expect(result).toMatchObject({
      started: 4,
      completed: 1,
      failed: 1,
      completionRate: 25,
      clicks: 9,
    });
    expect(result?.steps.map((s) => s.nodeId)).toEqual(['start', 'end', 'old']);
    expect(result?.steps[2]).toMatchObject({ reached: 3, outcomes: { ok: 2, failed: 1 } });
    expect(result?.steps[0]?.reached).toBe(0);
  });
  it('returns zero metrics for flows without runs and accepts unpublished graphs', () => {
    const [result] = buildFlowAnalytics([{ id: 'a', name: 'A', graph: null }], [], []);
    expect(result).toMatchObject({
      started: 0,
      completed: 0,
      failed: 0,
      completionRate: 0,
      clicks: 0,
      steps: [],
    });
  });
});

import { flowGraphSchema } from '@mushu/shared/flow';

export interface StepCount {
  flowId: string;
  nodeId: string;
  nodeType: string;
  outcome: string;
  count: number;
}

export function buildFlowAnalytics(
  flows: { id: string; name: string; graph: unknown }[],
  executions: { flowId: string; started: number; completed: number; failed: number }[],
  events: StepCount[],
) {
  return flows.map((flow) => {
    const counts = executions.find((row) => row.flowId === flow.id) ?? {
      started: 0,
      completed: 0,
      failed: 0,
    };
    const rows = events.filter((row) => row.flowId === flow.id);
    const steps = new Map<
      string,
      { nodeId: string; nodeType: string; reached: number; outcomes: Record<string, number> }
    >();
    const graph = flowGraphSchema.safeParse(flow.graph);
    // Traverse the published graph from its entry points, then append historical
    // nodes absent from the current version. Unvisited published nodes show zero.
    if (graph.success) {
      const visited = new Set<string>();
      const visit = (id: string) => {
        if (visited.has(id)) return;
        visited.add(id);
        const node = graph.data.nodes.find((n) => n.id === id);
        if (!node) return;
        steps.set(`${node.id}:${node.type}`, {
          nodeId: node.id,
          nodeType: node.type,
          reached: 0,
          outcomes: {},
        });
        for (const edge of graph.data.edges.filter((e) => e.source === id)) visit(edge.target);
      };
      for (const node of graph.data.nodes.filter((n) => n.type.startsWith('trigger.')))
        visit(node.id);
      for (const node of graph.data.nodes) visit(node.id);
    }
    for (const row of rows) {
      if (row.outcome === 'click') continue;
      const key = `${row.nodeId}:${row.nodeType}`;
      const step = steps.get(key) ?? {
        nodeId: row.nodeId,
        nodeType: row.nodeType,
        reached: 0,
        outcomes: {},
      };
      step.reached += row.count;
      step.outcomes[row.outcome] = (step.outcomes[row.outcome] ?? 0) + row.count;
      steps.set(key, step);
    }
    return {
      id: flow.id,
      name: flow.name,
      started: counts.started,
      completed: counts.completed,
      failed: counts.failed,
      completionRate: counts.started ? (counts.completed / counts.started) * 100 : 0,
      clicks: rows.filter((r) => r.outcome === 'click').reduce((sum, r) => sum + r.count, 0),
      steps: [...steps.values()],
    };
  });
}

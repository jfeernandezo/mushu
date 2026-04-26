import type { FlowGraph, FlowNode } from '@mushu/shared/flow';
import { isTriggerNode } from '@mushu/shared/flow';

const ACTION_TYPES_WITH_TEXT: Array<FlowNode['type']> = ['action.send_dm', 'action.reply_comment'];

export type FlowValidationError =
  | { kind: 'noTrigger' }
  | { kind: 'noAction' }
  | { kind: 'triggerWithoutKeywords' }
  | { kind: 'actionWithoutText' }
  | { kind: 'triggerHasNoPath' };

export function validateFlowForPublish(graph: FlowGraph): FlowValidationError | null {
  const triggers = graph.nodes.filter(isTriggerNode);
  if (triggers.length === 0) return { kind: 'noTrigger' };

  const actionNodes = graph.nodes.filter((n) =>
    (ACTION_TYPES_WITH_TEXT as string[]).includes(n.type),
  );
  if (actionNodes.length === 0) return { kind: 'noAction' };

  for (const t of triggers) {
    if (t.type === 'trigger.comment_keyword' || t.type === 'trigger.dm_keyword') {
      const kws = (t.data as { keywords?: string[] }).keywords ?? [];
      if (kws.length === 0 || kws.every((k) => !k.trim())) {
        return { kind: 'triggerWithoutKeywords' };
      }
    }
  }

  for (const n of actionNodes) {
    const text = (n.data as { text?: string }).text ?? '';
    if (!text.trim()) return { kind: 'actionWithoutText' };
  }

  // BFS from each trigger, ensure it reaches at least one action.
  const adjacency = new Map<string, string[]>();
  for (const e of graph.edges) {
    const list = adjacency.get(e.source) ?? [];
    list.push(e.target);
    adjacency.set(e.source, list);
  }
  const actionIds = new Set(actionNodes.map((n) => n.id));

  for (const trig of triggers) {
    const visited = new Set<string>();
    const queue: string[] = [trig.id];
    let reached = false;
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      if (actionIds.has(id) && id !== trig.id) {
        reached = true;
        break;
      }
      for (const next of adjacency.get(id) ?? []) {
        if (!visited.has(next)) queue.push(next);
      }
    }
    if (!reached) return { kind: 'triggerHasNoPath' };
  }

  return null;
}

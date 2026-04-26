import type { FlowGraph, FlowNode } from '@mushu/shared/flow';
import { isTriggerNode } from '@mushu/shared/flow';

const ACTION_TYPES_WITH_TEXT: Array<FlowNode['type']> = ['action.send_dm', 'action.reply_comment'];
const ANY_ACTION_TYPES: Array<FlowNode['type']> = [
  'action.send_dm',
  'action.reply_comment',
  'action.ask_question',
  'action.set_tag',
  'action.set_custom_field',
];

export type FlowValidationError =
  | { kind: 'noTrigger' }
  | { kind: 'noAction' }
  | { kind: 'triggerWithoutKeywords' }
  | { kind: 'actionWithoutText' }
  | { kind: 'askQuestionIncomplete' }
  | { kind: 'triggerHasNoPath' };

export function validateFlowForPublish(graph: FlowGraph): FlowValidationError | null {
  const triggers = graph.nodes.filter(isTriggerNode);
  if (triggers.length === 0) return { kind: 'noTrigger' };

  const allActionNodes = graph.nodes.filter((n) =>
    (ANY_ACTION_TYPES as string[]).includes(n.type),
  );
  if (allActionNodes.length === 0) return { kind: 'noAction' };

  const actionNodesWithText = graph.nodes.filter((n) =>
    (ACTION_TYPES_WITH_TEXT as string[]).includes(n.type),
  );

  for (const t of triggers) {
    if (t.type === 'trigger.comment_keyword' || t.type === 'trigger.dm_keyword') {
      const kws = (t.data as { keywords?: string[] }).keywords ?? [];
      if (kws.length === 0 || kws.every((k) => !k.trim())) {
        return { kind: 'triggerWithoutKeywords' };
      }
    }
  }

  for (const n of actionNodesWithText) {
    const text = (n.data as { text?: string }).text ?? '';
    if (!text.trim()) return { kind: 'actionWithoutText' };
  }

  for (const n of graph.nodes) {
    if (n.type === 'action.ask_question') {
      const d = n.data as { questionText?: string; variableName?: string };
      if (!d.questionText?.trim() || !d.variableName?.trim()) {
        return { kind: 'askQuestionIncomplete' };
      }
    }
  }

  // BFS from each trigger, ensure it reaches at least one action.
  const adjacency = new Map<string, string[]>();
  for (const e of graph.edges) {
    const list = adjacency.get(e.source) ?? [];
    list.push(e.target);
    adjacency.set(e.source, list);
  }
  const actionIds = new Set(allActionNodes.map((n) => n.id));

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

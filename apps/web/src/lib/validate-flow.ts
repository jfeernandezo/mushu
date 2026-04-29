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

export type FlowValidationIssueKind =
  | 'noTrigger'
  | 'noAction'
  | 'triggerWithoutKeywords'
  | 'actionWithoutText'
  | 'askQuestionIncomplete'
  | 'triggerHasNoPath';

export interface FlowValidationIssue {
  kind: FlowValidationIssueKind;
  /** Node this issue applies to. null when the issue is graph-level (e.g. noTrigger). */
  nodeId: string | null;
}

/**
 * Backwards-compatible alias used by callers that only need to know "can this
 * publish, yes or no" — equivalent to the first issue from `validateFlow`.
 */
export type FlowValidationError = { kind: FlowValidationIssueKind };

/**
 * Returns every blocking issue in the flow graph. Header indicator uses this
 * to show "3 issues" and a clickable list; publish gating only proceeds when
 * the array is empty. Order is stable: graph-level issues first, then per-node
 * issues in node-array order.
 */
export function validateFlow(graph: FlowGraph): FlowValidationIssue[] {
  const issues: FlowValidationIssue[] = [];

  const triggers = graph.nodes.filter(isTriggerNode);
  if (triggers.length === 0) {
    issues.push({ kind: 'noTrigger', nodeId: null });
  }

  const allActionNodes = graph.nodes.filter((n) =>
    (ANY_ACTION_TYPES as string[]).includes(n.type),
  );
  if (allActionNodes.length === 0) {
    issues.push({ kind: 'noAction', nodeId: null });
  }

  // Per-node issues. We collect each one separately so the inspector can
  // highlight the offending node when the user clicks the issue badge.
  for (const t of triggers) {
    if (t.type === 'trigger.comment_keyword' || t.type === 'trigger.dm_keyword') {
      const kws = (t.data as { keywords?: string[] }).keywords ?? [];
      if (kws.length === 0 || kws.every((k) => !k.trim())) {
        issues.push({ kind: 'triggerWithoutKeywords', nodeId: t.id });
      }
    }
  }

  for (const n of graph.nodes) {
    if ((ACTION_TYPES_WITH_TEXT as string[]).includes(n.type)) {
      const text = (n.data as { text?: string }).text ?? '';
      if (!text.trim()) {
        issues.push({ kind: 'actionWithoutText', nodeId: n.id });
      }
    }
    if (n.type === 'action.ask_question') {
      const d = n.data as { questionText?: string; variableName?: string };
      if (!d.questionText?.trim() || !d.variableName?.trim()) {
        issues.push({ kind: 'askQuestionIncomplete', nodeId: n.id });
      }
    }
  }

  // BFS: a trigger that can't reach any action will silently never run. We
  // only include this check if the flow has both triggers AND actions —
  // otherwise the noTrigger/noAction issues already cover it.
  if (triggers.length > 0 && allActionNodes.length > 0) {
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
      if (!reached) {
        issues.push({ kind: 'triggerHasNoPath', nodeId: trig.id });
      }
    }
  }

  return issues;
}

/**
 * Original single-error API — kept so existing callers (the publish gate)
 * don't have to change. Returns null when no blocking issue, otherwise the
 * first issue.
 */
export function validateFlowForPublish(graph: FlowGraph): FlowValidationError | null {
  const all = validateFlow(graph);
  if (all.length === 0) return null;
  return { kind: all[0]!.kind };
}

import type { FlowGraph, FlowNode } from '@mushu/shared/flow';

/**
 * Match an inbound IG event against trigger nodes in a flow graph.
 *
 * Returns the trigger node that matched, or null if none. Caller is
 * responsible for finding the outgoing edge from the trigger to the next
 * step.
 */

export type MatchInput =
  | {
      kind: 'comment';
      instagramPostId: string;
      text: string;
    }
  | {
      kind: 'dm';
      text: string;
    };

export function findTriggerNodeInGraph(
  graph: FlowGraph,
  input: MatchInput,
): FlowNode | null {
  for (const node of graph.nodes) {
    if (input.kind === 'comment' && node.type === 'trigger.comment_keyword') {
      // null = wildcard (any post on the connected account).
      if (node.data.instagramPostId !== null && node.data.instagramPostId !== input.instagramPostId) continue;
      if (matchKeywords(input.text, node.data.keywords, node.data.matchMode, node.data.caseSensitive)) {
        return node;
      }
    }
    if (input.kind === 'dm' && node.type === 'trigger.dm_keyword') {
      if (matchKeywords(input.text, node.data.keywords, node.data.matchMode, node.data.caseSensitive)) {
        return node;
      }
    }
  }
  return null;
}

export function matchKeywords(
  text: string,
  keywords: string[],
  mode: 'exact' | 'contains' | 'starts_with' | 'any',
  caseSensitive: boolean,
): boolean {
  if (mode === 'any') return true;
  const normText = normalizeForMatch(text.trim(), caseSensitive);
  for (const kw of keywords) {
    const normKw = normalizeForMatch(kw, caseSensitive);
    if (mode === 'exact' && normText === normKw) return true;
    if (mode === 'contains' && normText.includes(normKw)) return true;
    if (mode === 'starts_with' && normText.startsWith(normKw)) return true;
  }
  return false;
}

/**
 * Normalizes a string for keyword matching. When `caseSensitive` is false
 * (the default), folds case AND strips accents — so "informação" matches
 * "informacao", "Informação", "INFORMACAO" all the same. NFD + stripping
 * combining marks (\p{M}) is the canonical Unicode trick for this.
 */
function normalizeForMatch(s: string, caseSensitive: boolean): string {
  if (caseSensitive) return s;
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/**
 * Given a graph and a starting node id, return the id of the next node
 * to execute (following the first outgoing edge), or null if there is no
 * outgoing edge (terminal).
 *
 * For nodes with multiple outgoing edges (Condition, Randomizer), the
 * caller decides which edge to follow by passing `sourceHandle`.
 */
export function findNextNodeId(
  graph: FlowGraph,
  fromNodeId: string,
  sourceHandle?: string | null,
): string | null {
  for (const edge of graph.edges) {
    if (edge.source !== fromNodeId) continue;
    if (sourceHandle !== undefined && edge.sourceHandle !== sourceHandle) continue;
    return edge.target;
  }
  return null;
}

export function getNodeById(graph: FlowGraph, id: string): FlowNode | undefined {
  return graph.nodes.find((n) => n.id === id);
}

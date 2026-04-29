'use client';

import type { Edge, Node } from '@xyflow/react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Snapshot {
  nodes: Node[];
  edges: Edge[];
}

interface UseFlowHistoryArgs {
  nodes: Node[];
  edges: Edge[];
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  /** Debounce window before snapshotting a change. Defaults to 600ms — long
   *  enough that a drag or fast typing collapses into one history entry,
   *  short enough that the user feels the snapshot was committed. */
  debounceMs?: number;
  /** Hard cap on history depth. We trim the oldest past snapshots once we
   *  cross this. 50 covers ~30 minutes of active editing without ballooning
   *  memory on big graphs. */
  maxDepth?: number;
}

interface UseFlowHistoryReturn {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}

/**
 * Local-only undo/redo for the flow builder.
 *
 * Strategy:
 *   - The CURRENT snapshot lives implicitly in `nodes` / `edges` props.
 *   - `pastRef` is a stack of previous snapshots (oldest at index 0).
 *   - `futureRef` is a stack of redo-able snapshots (oldest at index 0).
 *   - When `nodes`/`edges` change, after a debounce window we push the
 *     PREVIOUS snapshot to past and clear future. Skips the push if the
 *     change was triggered by undo/redo itself (`applyingRef`).
 *
 * Trade-offs:
 *   - We dedupe by reference (object identity), not deep equality. A drag
 *     that ends at the same position still creates a snapshot — acceptable
 *     because debounce collapses drags into one entry anyway.
 *   - Snapshots store full {nodes, edges} arrays, not deltas. ~1KB per node
 *     even on edit-heavy flows; the 50-depth cap keeps total well under 1MB.
 *   - Snapshot lifecycle is in-memory only; reload = empty history. That's
 *     the standard for editor undo and matches the user's intuition (the
 *     remote save is the persistent state).
 */
export function useFlowHistory({
  nodes,
  edges,
  setNodes,
  setEdges,
  debounceMs = 600,
  maxDepth = 50,
}: UseFlowHistoryArgs): UseFlowHistoryReturn {
  const pastRef = useRef<Snapshot[]>([]);
  const futureRef = useRef<Snapshot[]>([]);
  const lastSnapshotRef = useRef<Snapshot>({ nodes, edges });
  const applyingRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tracking state through React state lets the toolbar buttons re-render
  // when undo/redo availability changes. Refs alone wouldn't trigger a
  // re-render of the consumer.
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  function refreshFlags() {
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(futureRef.current.length > 0);
  }

  // Watch nodes/edges. After the debounce window, commit the previous
  // snapshot to past — unless we're in the middle of applying a history op.
  useEffect(() => {
    if (applyingRef.current) {
      // The change came from undo/redo. Update lastSnapshot but don't push.
      lastSnapshotRef.current = { nodes, edges };
      applyingRef.current = false;
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    const prev = lastSnapshotRef.current;
    debounceRef.current = setTimeout(() => {
      // No-op if nothing actually changed by reference.
      if (prev.nodes === nodes && prev.edges === edges) return;
      pastRef.current.push(prev);
      if (pastRef.current.length > maxDepth) {
        pastRef.current.shift();
      }
      // A new user-driven edit invalidates redo history — matches every
      // other editor's convention. Backspacing in Notion does the same.
      futureRef.current = [];
      lastSnapshotRef.current = { nodes, edges };
      refreshFlags();
    }, debounceMs);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [nodes, edges, debounceMs, maxDepth]);

  const undo = useCallback(() => {
    const prev = pastRef.current.pop();
    if (!prev) return;
    futureRef.current.push(lastSnapshotRef.current);
    applyingRef.current = true;
    setNodes(prev.nodes);
    setEdges(prev.edges);
    refreshFlags();
  }, [setNodes, setEdges]);

  const redo = useCallback(() => {
    const next = futureRef.current.pop();
    if (!next) return;
    pastRef.current.push(lastSnapshotRef.current);
    applyingRef.current = true;
    setNodes(next.nodes);
    setEdges(next.edges);
    refreshFlags();
  }, [setNodes, setEdges]);

  return { canUndo, canRedo, undo, redo };
}

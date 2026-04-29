'use client';

import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react';
import { ArrowLeft, Check, Loader2, Redo2, Undo2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { FlowGraph, FlowNodeType } from '@mushu/shared/flow';
import { publishFlow, saveFlowDraft } from '@/actions/flows';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { validateFlow, validateFlowForPublish } from '@/lib/validate-flow';
import { FlowCanvasShell } from './flow-canvas';
import { FlowIssuesPopover } from './flow-issues-popover';
import { NodeInspector } from './node-inspector';
import { NodePalette } from './node-palette';
import { TemplateBanner } from './template-banner';
import { useFlowHistory } from './use-flow-history';

interface FlowBuilderProps {
  flowId: string;
  flowName: string;
  initialGraph: FlowGraph;
  isEnabled: boolean;
  fromTemplate: string | null;
}

export function FlowBuilder({
  flowId,
  flowName,
  initialGraph,
  isEnabled,
  fromTemplate,
}: FlowBuilderProps) {
  const t = useTranslations('flowBuilder');
  const tErrors = useTranslations('flowBuilder.publishErrors');

  // Single source of truth for the canvas. The React Flow canvas is rendered
  // in *controlled* mode (see flow-canvas.tsx) so external mutations from the
  // inspector — `onUpdateNodeData`, `onDeleteNode` — flow back into the canvas
  // immediately. Previously the canvas had its own `useNodesState`, which
  // ignored external changes and made the UI feel frozen.
  const [nodes, setNodes] = useState<Node[]>(() => graphToNodes(initialGraph));
  const [edges, setEdges] = useState<Edge[]>(() => graphToEdges(initialGraph));
  const [selected, setSelected] = useState<Node | null>(null);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedVersion, setPublishedVersion] = useState<number | null>(null);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({ ...params, id: crypto.randomUUID() }, eds));
  }, []);

  const onAddNode = useCallback((node: Node) => {
    setNodes((ns) => ns.concat(node));
  }, []);

  const onUpdateNodeData = useCallback((id: string, data: Record<string, unknown>) => {
    setNodes((ns) =>
      ns.map((n) => (n.id === id ? { ...n, data: data as never } : n)),
    );
    setSelected((s) => (s && s.id === id ? { ...s, data } : s));
  }, []);

  const onDeleteNode = useCallback((id: string) => {
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
    setSelected(null);
  }, []);

  /**
   * Clone the given node next to itself. Used by Ctrl+D and the future
   * "duplicate" menu item. The new node gets a fresh id (so it doesn't share
   * state with the original), an offset position so it doesn't perfectly
   * overlap, and the same data shape — including any user-edited keywords,
   * text, etc.
   */
  const onDuplicateNode = useCallback((id: string) => {
    setNodes((ns) => {
      const source = ns.find((n) => n.id === id);
      if (!source) return ns;
      const clone: Node = {
        ...source,
        id: crypto.randomUUID(),
        position: {
          x: source.position.x + 32,
          y: source.position.y + 32,
        },
        selected: false,
        // Drizzle/React Flow stores data as a plain object; shallow clone is
        // enough — we don't have nested mutable state in node data today.
        data: { ...(source.data as Record<string, unknown>) } as never,
      };
      return ns.concat(clone);
    });
  }, []);

  // Local-only undo/redo. The hook watches nodes/edges and snapshots after
  // a 600ms debounce. Snapshots are NOT persisted — reload starts a fresh
  // history (the remote save is the source of truth for persistence).
  const { canUndo, canRedo, undo, redo } = useFlowHistory({
    nodes,
    edges,
    setNodes,
    setEdges,
  });

  // Global keyboard shortcuts: delete node, duplicate node (Ctrl/Cmd+D),
  // undo (Ctrl/Cmd+Z), redo (Ctrl/Cmd+Shift+Z OR Ctrl+Y on Windows).
  // All shortcuts skip when focus is inside an editable element so typing
  // in the inspector doesn't trigger them.
  useEffect(() => {
    function isEditableTarget(t: EventTarget | null): boolean {
      const el = t as HTMLElement | null;
      if (!el) return false;
      if (el.isContentEditable) return true;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    }
    function onKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;
      const meta = e.metaKey || e.ctrlKey;

      // Undo/redo first — they don't depend on having a selection.
      if (meta && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        undo();
        return;
      }
      if (
        (meta && e.shiftKey && (e.key === 'z' || e.key === 'Z')) ||
        (meta && (e.key === 'y' || e.key === 'Y'))
      ) {
        e.preventDefault();
        redo();
        return;
      }

      if (selected && (e.key === 'Backspace' || e.key === 'Delete')) {
        e.preventDefault();
        onDeleteNode(selected.id);
        return;
      }
      if (selected && meta && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        onDuplicateNode(selected.id);
        return;
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected, onDeleteNode, onDuplicateNode, undo, redo]);

  // Persist to backend whenever nodes/edges change. Debounced 400ms so a fast
  // drag of a node doesn't hammer the server.
  //
  // We skip the very first effect run — that fires on mount with the
  // unchanged initial graph and would just write back what we just loaded.
  const isFirstSave = useRef(true);
  useEffect(() => {
    if (isFirstSave.current) {
      isFirstSave.current = false;
      return;
    }
    const handle = setTimeout(async () => {
      const next = nodesEdgesToGraph(nodes, edges);
      setSaveStatus('saving');
      try {
        await saveFlowDraft(flowId, next);
        setSaveStatus('saved');
      } catch (err) {
        console.error(err);
        setSaveStatus('error');
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [nodes, edges, flowId]);

  // Derived for validation + (future) preview features.
  const graph = useMemo<FlowGraph>(() => nodesEdgesToGraph(nodes, edges), [nodes, edges]);

  // Live validation feeds the header pill. We re-run on every graph mutation;
  // it's O(nodes + edges) so cheap even on big flows.
  const issues = useMemo(() => validateFlow(graph), [graph]);

  const issueNodeIds = useMemo(() => {
    const set = new Set<string>();
    for (const issue of issues) if (issue.nodeId) set.add(issue.nodeId);
    return set;
  }, [issues]);

  const onJumpToNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (node) setSelected(node);
    },
    [nodes],
  );

  async function onPublish() {
    if (isPublishing) return;
    const validationError = validateFlowForPublish(graph);
    if (validationError) {
      toast.error(tErrors(validationError.kind));
      return;
    }
    setIsPublishing(true);
    try {
      const r = await publishFlow(flowId);
      setPublishedVersion(r.version);
      toast.success(t('publishedToast', { version: r.version }));
    } catch (err) {
      console.error(err);
      toast.error(t('publishFailed', { error: (err as Error).message }));
    } finally {
      // Always release the spinner — `useTransition` was leaving us stuck on
      // pending forever when revalidatePath ran on the same route.
      setIsPublishing(false);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-[var(--color-mushu-bg)]">
      <header className="flex h-14 items-center gap-4 border-b border-[var(--color-mushu-border)] px-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/flows">
            <ArrowLeft className="h-4 w-4" />
            {t('back')}
          </Link>
        </Button>
        <div className="flex flex-col">
          <span className="text-sm font-medium">{flowName}</span>
          <span className="text-[11px] text-[var(--color-mushu-faint)]">
            <SaveStatus status={saveStatus} />
          </span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Tooltip content={t('undoTooltip')} side="bottom">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                disabled={!canUndo}
                onClick={undo}
                aria-label={t('undo')}
              >
                <Undo2 className="h-4 w-4" />
              </Button>
            </Tooltip>
            <Tooltip content={t('redoTooltip')} side="bottom">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                disabled={!canRedo}
                onClick={redo}
                aria-label={t('redo')}
              >
                <Redo2 className="h-4 w-4" />
              </Button>
            </Tooltip>
          </div>
          <FlowIssuesPopover issues={issues} onJumpToNode={onJumpToNode} />
          {publishedVersion !== null ? (
            <Badge variant="success">{t('publishedVersion', { version: publishedVersion })}</Badge>
          ) : isEnabled ? (
            <Badge variant="success">{t('live')}</Badge>
          ) : (
            <Badge variant="outline">{t('draft')}</Badge>
          )}
          <Button onClick={onPublish} disabled={isPublishing || issues.length > 0}>
            {isPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {isPublishing ? t('publishing') : t('publish')}
          </Button>
        </div>
      </header>

      {fromTemplate ? <TemplateBanner flowId={flowId} templateId={fromTemplate} /> : null}

      <div className="flex flex-1 overflow-hidden">
        <NodePalette />
        <FlowCanvasShell
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onAddNode={onAddNode}
          onSelect={setSelected}
          selectedId={selected?.id ?? null}
          issueNodeIds={issueNodeIds}
        />
        <NodeInspector
          node={selected}
          onChange={onUpdateNodeData}
          onClose={() => setSelected(null)}
          onDelete={onDeleteNode}
        />
      </div>
    </div>
  );
}

function SaveStatus({ status }: { status: 'idle' | 'saving' | 'saved' | 'error' }) {
  const t = useTranslations('flowBuilder.save');
  if (status === 'saving') return <span>{t('saving')}</span>;
  if (status === 'saved') return <span>{t('saved')}</span>;
  if (status === 'error') return <span className="text-[var(--color-mushu-danger)]">{t('error')}</span>;
  return <span>{t('draft')}</span>;
}

function graphToNodes(g: FlowGraph): Node[] {
  return g.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: n.data as Record<string, unknown>,
  }));
}

function graphToEdges(g: FlowGraph): Edge[] {
  return g.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? null,
    targetHandle: e.targetHandle ?? null,
  }));
}

function nodesEdgesToGraph(nodes: Node[], edges: Edge[]): FlowGraph {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: (n.type ?? 'control.end') as FlowNodeType,
      position: n.position,
      data: (n.data ?? {}) as never,
    })) as never,
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      targetHandle: e.targetHandle ?? null,
    })),
  };
}

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
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { FlowGraph, FlowNodeType } from '@mushu/shared/flow';
import { publishFlow, saveFlowDraft } from '@/actions/flows';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { validateFlowForPublish } from '@/lib/validate-flow';
import { FlowCanvasShell } from './flow-canvas';
import { NodeInspector } from './node-inspector';
import { NodePalette } from './node-palette';
import { TemplateBanner } from './template-banner';

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
          {publishedVersion !== null ? (
            <Badge variant="success">{t('publishedVersion', { version: publishedVersion })}</Badge>
          ) : isEnabled ? (
            <Badge variant="success">{t('live')}</Badge>
          ) : (
            <Badge variant="outline">{t('draft')}</Badge>
          )}
          <Button onClick={onPublish} disabled={isPublishing}>
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

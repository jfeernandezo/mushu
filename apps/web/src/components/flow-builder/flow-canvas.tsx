'use client';

import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  type Node,
  type NodeTypes,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type DragEvent, useCallback, useEffect, useRef, useState } from 'react';
import type { FlowGraph, FlowNodeType } from '@mushu/shared/flow';
import { useTheme } from '@/components/theme-provider';
import { THEME_COLORS } from '@/lib/theme-colors';
import {
  ConditionNode,
  DelayNode,
  EndNode,
  ReplyCommentNode,
  SendDmNode,
  TriggerCommentNode,
  TriggerDmNode,
} from './nodes';

const nodeTypes: NodeTypes = {
  'trigger.comment_keyword': TriggerCommentNode,
  'trigger.dm_keyword': TriggerDmNode,
  'action.send_dm': SendDmNode,
  'action.reply_comment': ReplyCommentNode,
  'logic.delay': DelayNode,
  'logic.condition': ConditionNode,
  'control.end': EndNode,
};

interface FlowCanvasProps {
  initialGraph: FlowGraph;
  onChange: (graph: FlowGraph) => void;
  onSelect: (node: Node | null) => void;
  selectedId: string | null;
}

export function FlowCanvasShell(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvas {...props} />
    </ReactFlowProvider>
  );
}

function FlowCanvas({ initialGraph, onChange, onSelect, selectedId }: FlowCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(graphToNodes(initialGraph));
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(graphToEdges(initialGraph));
  const [hasInitialized, setHasInitialized] = useState(false);
  const reactFlow = useReactFlow();
  const { resolved } = useTheme();
  const palette = THEME_COLORS[resolved];

  // Push canvas changes upward (debounced).
  useEffect(() => {
    if (!hasInitialized) {
      setHasInitialized(true);
      return;
    }
    const t = setTimeout(() => {
      onChange({
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
      });
    }, 400);
    return () => clearTimeout(t);
  }, [nodes, edges, onChange, hasInitialized]);

  const onConnect = useCallback(
    (params: Parameters<typeof addEdge<Edge>>[0]) =>
      setEdges((eds) => addEdge({ ...params, id: cryptoRandomId() }, eds)),
    [setEdges],
  );

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('application/mushu-node-type') as FlowNodeType | '';
      if (!type) return;
      const position = reactFlow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const node: Node = {
        id: cryptoRandomId(),
        type,
        position,
        data: defaultDataForType(type) as never,
      };
      setNodes((ns) => ns.concat(node));
    },
    [reactFlow, setNodes],
  );

  return (
    <div
      className="relative h-full flex-1"
      ref={wrapperRef}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <ReactFlow
        nodes={nodes.map((n) => ({ ...n, selected: n.id === selectedId }))}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={() => onSelect(null)}
        onNodeClick={(_, n) => onSelect(n)}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        colorMode={resolved}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color={palette.border} />
        <Controls className="!bg-[var(--color-mushu-surface)] !text-[var(--color-mushu-ink)]" />
      </ReactFlow>
      {nodes.length === 0 ? <EmptyCanvasOverlay /> : null}
    </div>
  );
}

function EmptyCanvasOverlay() {
  const t = useTranslations('flowBuilder.emptyCanvas');
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="flex max-w-sm flex-col items-center gap-2 rounded-lg border border-dashed border-[var(--color-mushu-border)] bg-[var(--color-mushu-bg)]/80 px-6 py-5 text-center backdrop-blur-sm">
        <ArrowLeft className="h-5 w-5 text-[var(--color-mushu-amber)]" />
        <p className="text-sm font-medium text-[var(--color-mushu-ink)]">{t('title')}</p>
        <p className="text-xs text-[var(--color-mushu-mute)]">{t('body')}</p>
      </div>
    </div>
  );
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

function cryptoRandomId(): string {
  return crypto.randomUUID();
}

function defaultDataForType(type: FlowNodeType): Record<string, unknown> {
  switch (type) {
    case 'trigger.comment_keyword':
      return { instagramPostId: '', keywords: [], matchMode: 'contains', caseSensitive: false };
    case 'trigger.dm_keyword':
      return { keywords: [], matchMode: 'contains', caseSensitive: false };
    case 'action.send_dm':
      return { text: '' };
    case 'action.reply_comment':
      return { text: '' };
    case 'action.set_tag':
      return { tag: '', operation: 'add' };
    case 'action.set_custom_field':
      return { field: '', value: '' };
    case 'logic.delay':
      return { durationSeconds: 30 };
    case 'logic.condition':
      return { branches: [{ name: 'default', conditions: [], logical: 'and' }] };
    case 'control.end':
      return {};
    default:
      return {};
  }
}

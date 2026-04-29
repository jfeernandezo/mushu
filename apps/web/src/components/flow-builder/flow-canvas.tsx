'use client';

import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeTypes,
  type OnConnect,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type DragEvent, useCallback } from 'react';
import type { FlowNodeType } from '@mushu/shared/flow';
import { useTheme } from '@/components/theme-provider';
import { THEME_COLORS } from '@/lib/theme-colors';
import {
  AskQuestionNode,
  ConditionNode,
  DelayNode,
  EndNode,
  ReplyCommentNode,
  SendDmNode,
  SetTagNode,
  TriggerCommentNode,
  TriggerDmNode,
  TriggerFirstDmNode,
  TriggerStoryMentionNode,
  TriggerStoryReplyNode,
} from './nodes';

const nodeTypes: NodeTypes = {
  'trigger.comment_keyword': TriggerCommentNode,
  'trigger.dm_keyword': TriggerDmNode,
  'trigger.first_dm': TriggerFirstDmNode,
  'trigger.story_reply': TriggerStoryReplyNode,
  'trigger.story_mention': TriggerStoryMentionNode,
  'action.send_dm': SendDmNode,
  'action.reply_comment': ReplyCommentNode,
  'action.ask_question': AskQuestionNode,
  'action.set_tag': SetTagNode,
  'logic.delay': DelayNode,
  'logic.condition': ConditionNode,
  'control.end': EndNode,
};

interface FlowCanvasProps {
  /** Controlled — owned by FlowBuilder. */
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: OnConnect;
  /** Called when the user drops a new block from the palette. */
  onAddNode: (node: Node) => void;
  onSelect: (node: Node | null) => void;
  selectedId: string | null;
  /** Set of node ids that have a publish-blocking issue. The matching nodes
   *  get an amber pulse (`.mushu-node-issue` in globals.css) so the user can
   *  spot them on the canvas without scrolling the issues popover. */
  issueNodeIds?: Set<string>;
}

export function FlowCanvasShell(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvas {...props} />
    </ReactFlowProvider>
  );
}

function FlowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onAddNode,
  onSelect,
  selectedId,
  issueNodeIds,
}: FlowCanvasProps) {
  const reactFlow = useReactFlow();
  const { resolved } = useTheme();
  const palette = THEME_COLORS[resolved];

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
      onAddNode(node);
    },
    [reactFlow, onAddNode],
  );

  return (
    <div
      className="relative h-full flex-1"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <ReactFlow
        nodes={nodes.map((n) => ({
          ...n,
          selected: n.id === selectedId,
          className: issueNodeIds?.has(n.id) ? 'mushu-node-issue' : undefined,
        }))}
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

function cryptoRandomId(): string {
  return crypto.randomUUID();
}

function defaultDataForType(type: FlowNodeType): Record<string, unknown> {
  switch (type) {
    case 'trigger.comment_keyword':
      return { instagramPostId: null, keywords: [], matchMode: 'contains', caseSensitive: false };
    case 'trigger.dm_keyword':
      return { keywords: [], matchMode: 'contains', caseSensitive: false };
    case 'trigger.first_dm':
      return {};
    case 'trigger.story_reply':
      return {};
    case 'trigger.story_mention':
      return {};
    case 'action.send_dm':
      return { text: '', quickReplies: [] };
    case 'action.reply_comment':
      return { text: '' };
    case 'action.ask_question':
      return {
        questionText: '',
        variableName: 'resposta',
        inputType: 'text',
        maxAttempts: 3,
      };
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

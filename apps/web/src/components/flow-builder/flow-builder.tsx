'use client';

import type { Node } from '@xyflow/react';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useState, useTransition } from 'react';
import type { FlowGraph } from '@mushu/shared/flow';
import { publishFlow, saveFlowDraft } from '@/actions/flows';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FlowCanvasShell } from './flow-canvas';
import { NodeInspector } from './node-inspector';
import { NodePalette } from './node-palette';

interface FlowBuilderProps {
  flowId: string;
  flowName: string;
  initialGraph: FlowGraph;
  isEnabled: boolean;
}

export function FlowBuilder({ flowId, flowName, initialGraph, isEnabled }: FlowBuilderProps) {
  const [graph, setGraph] = useState<FlowGraph>(initialGraph);
  const [selected, setSelected] = useState<Node | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isPublishing, startPublish] = useTransition();
  const [publishedVersion, setPublishedVersion] = useState<number | null>(null);

  const onChange = useCallback(
    async (next: FlowGraph) => {
      setGraph(next);
      setSaveStatus('saving');
      try {
        await saveFlowDraft(flowId, next);
        setSaveStatus('saved');
      } catch (err) {
        console.error(err);
        setSaveStatus('error');
      }
    },
    [flowId],
  );

  const onUpdateNodeData = useCallback(
    (id: string, data: Record<string, unknown>) => {
      const next: FlowGraph = {
        ...graph,
        nodes: graph.nodes.map((n) => (n.id === id ? { ...n, data: data as never } : n)) as never,
      };
      void onChange(next);
      setSelected((s) => (s && s.id === id ? { ...s, data } : s));
    },
    [graph, onChange],
  );

  const onDeleteNode = useCallback(
    (id: string) => {
      const next: FlowGraph = {
        ...graph,
        nodes: graph.nodes.filter((n) => n.id !== id),
        edges: graph.edges.filter((e) => e.source !== id && e.target !== id),
      };
      void onChange(next);
      setSelected(null);
    },
    [graph, onChange],
  );

  function onPublish() {
    startPublish(async () => {
      try {
        const r = await publishFlow(flowId);
        setPublishedVersion(r.version);
      } catch (err) {
        console.error(err);
        alert(`Publish failed: ${(err as Error).message}`);
      }
    });
  }

  return (
    <div className="flex h-screen flex-col bg-[var(--color-mushu-bg)]">
      <header className="flex h-14 items-center gap-4 border-b border-[var(--color-mushu-border)] px-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/flows">
            <ArrowLeft className="h-4 w-4" />
            Flows
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
            <Badge variant="success">Published v{publishedVersion}</Badge>
          ) : isEnabled ? (
            <Badge variant="success">Live</Badge>
          ) : (
            <Badge variant="outline">Draft</Badge>
          )}
          <Button onClick={onPublish} disabled={isPublishing}>
            {isPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {isPublishing ? 'Publishing…' : 'Publish'}
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <NodePalette />
        <FlowCanvasShell
          initialGraph={graph}
          onChange={onChange}
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
  if (status === 'saving') return <span>Saving…</span>;
  if (status === 'saved') return <span>All changes saved</span>;
  if (status === 'error') return <span className="text-[var(--color-mushu-danger)]">Save failed</span>;
  return <span>Draft</span>;
}

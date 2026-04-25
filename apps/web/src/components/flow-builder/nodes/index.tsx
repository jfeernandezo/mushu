'use client';

import type { NodeProps } from '@xyflow/react';
import { Clock, GitBranch, MessageCircle, MessageSquare, Send, Square, Zap } from 'lucide-react';
import { BaseNode } from './base-node';

export function TriggerCommentNode({ data, selected }: NodeProps) {
  const d = (data ?? {}) as {
    instagramPostId?: string;
    keywords?: string[];
  };
  return (
    <BaseNode
      icon={MessageCircle}
      iconColor="var(--color-mushu-amber)"
      title="Comment trigger"
      category="trigger"
      selected={selected}
      hasInput={false}
    >
      {d.keywords?.length ? (
        <span>Matches: <span className="text-[var(--color-mushu-ink)]">{d.keywords.join(', ')}</span></span>
      ) : (
        <span className="italic">Configure keywords…</span>
      )}
    </BaseNode>
  );
}

export function TriggerDmNode({ data, selected }: NodeProps) {
  const d = (data ?? {}) as { keywords?: string[] };
  return (
    <BaseNode
      icon={MessageSquare}
      iconColor="var(--color-mushu-amber)"
      title="DM keyword trigger"
      category="trigger"
      selected={selected}
      hasInput={false}
    >
      {d.keywords?.length ? (
        <span>Matches: <span className="text-[var(--color-mushu-ink)]">{d.keywords.join(', ')}</span></span>
      ) : (
        <span className="italic">Configure keywords…</span>
      )}
    </BaseNode>
  );
}

export function SendDmNode({ data, selected }: NodeProps) {
  const d = (data ?? {}) as { text?: string };
  return (
    <BaseNode
      icon={Send}
      iconColor="var(--color-mushu-scarlet-soft)"
      title="Send DM"
      category="action"
      selected={selected}
    >
      {d.text ? (
        <p className="line-clamp-2">{d.text}</p>
      ) : (
        <span className="italic">Empty message…</span>
      )}
    </BaseNode>
  );
}

export function ReplyCommentNode({ data, selected }: NodeProps) {
  const d = (data ?? {}) as { text?: string };
  return (
    <BaseNode
      icon={MessageCircle}
      iconColor="var(--color-mushu-scarlet-soft)"
      title="Reply to comment"
      category="action"
      selected={selected}
    >
      {d.text ? (
        <p className="line-clamp-2">{d.text}</p>
      ) : (
        <span className="italic">Empty reply…</span>
      )}
    </BaseNode>
  );
}

export function DelayNode({ data, selected }: NodeProps) {
  const d = (data ?? {}) as { durationSeconds?: number };
  const seconds = d.durationSeconds ?? 0;
  return (
    <BaseNode icon={Clock} title="Delay" category="logic" selected={selected}>
      Wait <span className="text-[var(--color-mushu-ink)]">{formatDuration(seconds)}</span>
    </BaseNode>
  );
}

export function ConditionNode({ selected }: NodeProps) {
  return (
    <BaseNode icon={GitBranch} title="Condition" category="logic" selected={selected}>
      <span className="italic">Branches will land in v0.2</span>
    </BaseNode>
  );
}

export function EndNode({ selected }: NodeProps) {
  return (
    <BaseNode
      icon={Square}
      title="End"
      category="control"
      selected={selected}
      hasOutput={false}
    >
      Stop the execution.
    </BaseNode>
  );
}

function formatDuration(s: number): string {
  if (!s) return '0s';
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

void Zap;

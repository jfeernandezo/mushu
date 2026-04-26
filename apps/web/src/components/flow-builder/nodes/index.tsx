'use client';

import type { NodeProps } from '@xyflow/react';
import { Clock, GitBranch, MessageCircle, MessageSquare, Send, Square, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { BaseNode } from './base-node';

export function TriggerCommentNode({ data, selected }: NodeProps) {
  const t = useTranslations('flowBuilder.nodes');
  const d = (data ?? {}) as {
    instagramPostId?: string;
    keywords?: string[];
  };
  return (
    <BaseNode
      icon={MessageCircle}
      iconColor="var(--color-mushu-amber)"
      title={t('trigger.comment_keyword')}
      category="trigger"
      selected={selected}
      hasInput={false}
    >
      {d.keywords?.length ? (
        <span>
          {t('matches')}{' '}
          <span className="text-[var(--color-mushu-ink)]">{d.keywords.join(', ')}</span>
        </span>
      ) : (
        <span className="italic">{t('configureKeywords')}</span>
      )}
    </BaseNode>
  );
}

export function TriggerDmNode({ data, selected }: NodeProps) {
  const t = useTranslations('flowBuilder.nodes');
  const d = (data ?? {}) as { keywords?: string[] };
  return (
    <BaseNode
      icon={MessageSquare}
      iconColor="var(--color-mushu-amber)"
      title={t('trigger.dm_keyword')}
      category="trigger"
      selected={selected}
      hasInput={false}
    >
      {d.keywords?.length ? (
        <span>
          {t('matches')}{' '}
          <span className="text-[var(--color-mushu-ink)]">{d.keywords.join(', ')}</span>
        </span>
      ) : (
        <span className="italic">{t('configureKeywords')}</span>
      )}
    </BaseNode>
  );
}

export function SendDmNode({ data, selected }: NodeProps) {
  const t = useTranslations('flowBuilder.nodes');
  const d = (data ?? {}) as { text?: string };
  return (
    <BaseNode
      icon={Send}
      iconColor="var(--color-mushu-scarlet-soft)"
      title={t('action.send_dm')}
      category="action"
      selected={selected}
    >
      {d.text ? (
        <p className="line-clamp-2">{d.text}</p>
      ) : (
        <span className="italic">{t('emptyMessage')}</span>
      )}
    </BaseNode>
  );
}

export function ReplyCommentNode({ data, selected }: NodeProps) {
  const t = useTranslations('flowBuilder.nodes');
  const d = (data ?? {}) as { text?: string };
  return (
    <BaseNode
      icon={MessageCircle}
      iconColor="var(--color-mushu-scarlet-soft)"
      title={t('action.reply_comment')}
      category="action"
      selected={selected}
    >
      {d.text ? (
        <p className="line-clamp-2">{d.text}</p>
      ) : (
        <span className="italic">{t('emptyReply')}</span>
      )}
    </BaseNode>
  );
}

export function DelayNode({ data, selected }: NodeProps) {
  const t = useTranslations('flowBuilder.nodes');
  const d = (data ?? {}) as { durationSeconds?: number };
  const seconds = d.durationSeconds ?? 0;
  return (
    <BaseNode icon={Clock} title={t('logic.delay')} category="logic" selected={selected}>
      {t('wait')}{' '}
      <span className="text-[var(--color-mushu-ink)]">{formatDuration(seconds)}</span>
    </BaseNode>
  );
}

export function ConditionNode({ selected }: NodeProps) {
  const t = useTranslations('flowBuilder.nodes');
  return (
    <BaseNode icon={GitBranch} title={t('logic.condition')} category="logic" selected={selected}>
      <span className="italic">{t('branchesV2')}</span>
    </BaseNode>
  );
}

export function EndNode({ selected }: NodeProps) {
  const t = useTranslations('flowBuilder.nodes');
  return (
    <BaseNode
      icon={Square}
      title={t('control.end')}
      category="control"
      selected={selected}
      hasOutput={false}
    >
      {t('stopExecution')}
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

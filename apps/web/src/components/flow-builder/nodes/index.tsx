'use client';

import type { NodeProps } from '@xyflow/react';
import {
  AtSign,
  Clock,
  GitBranch,
  HelpCircle,
  Image,
  MessageCircle,
  MessageSquare,
  Send,
  Sparkles,
  Square,
  Tag,
  Zap,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { BaseNode } from './base-node';

export function TriggerCommentNode({ data, selected }: NodeProps) {
  const t = useTranslations('flowBuilder.nodes');
  const tPost = useTranslations('flowBuilder.postSelector');
  const d = (data ?? {}) as {
    instagramPostId?: string | null;
    keywords?: string[];
  };
  const postLabel = d.instagramPostId ? tPost('specificPostHint') : tPost('anyPostHint');
  return (
    <BaseNode
      icon={MessageCircle}
      iconColor="var(--color-mushu-amber)"
      title={t('trigger.comment_keyword.title')}
      category="trigger"
      selected={selected}
      hasInput={false}
    >
      <span className="block text-[10px] text-[var(--color-mushu-faint)]">{postLabel}</span>
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
      title={t('trigger.dm_keyword.title')}
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

export function TriggerFirstDmNode({ selected }: NodeProps) {
  const t = useTranslations('flowBuilder.nodes');
  return (
    <BaseNode
      icon={Sparkles}
      iconColor="var(--color-mushu-amber)"
      title={t('trigger.first_dm.title')}
      category="trigger"
      selected={selected}
      hasInput={false}
    >
      <span className="block text-[10px] text-[var(--color-mushu-faint)]">
        {t('trigger.first_dm.hint')}
      </span>
    </BaseNode>
  );
}

export function TriggerStoryReplyNode({ selected }: NodeProps) {
  const t = useTranslations('flowBuilder.nodes');
  return (
    <BaseNode
      icon={Image}
      iconColor="var(--color-mushu-amber)"
      title={t('trigger.story_reply.title')}
      category="trigger"
      selected={selected}
      hasInput={false}
    >
      <span className="block text-[10px] text-[var(--color-mushu-faint)]">
        {t('trigger.story_reply.hint')}
      </span>
    </BaseNode>
  );
}

export function TriggerStoryMentionNode({ selected }: NodeProps) {
  const t = useTranslations('flowBuilder.nodes');
  return (
    <BaseNode
      icon={AtSign}
      iconColor="var(--color-mushu-amber)"
      title={t('trigger.story_mention.title')}
      category="trigger"
      selected={selected}
      hasInput={false}
    >
      <span className="block text-[10px] text-[var(--color-mushu-faint)]">
        {t('trigger.story_mention.hint')}
      </span>
    </BaseNode>
  );
}

export function SendDmNode({ data, selected }: NodeProps) {
  const t = useTranslations('flowBuilder.nodes');
  const d = (data ?? {}) as { text?: string; quickReplies?: string[] };
  const quickCount = (d.quickReplies ?? []).filter(Boolean).length;
  return (
    <BaseNode
      icon={Send}
      iconColor="var(--color-mushu-scarlet-soft)"
      title={t('action.send_dm.title')}
      category="action"
      selected={selected}
    >
      {d.text ? (
        <p className="line-clamp-2">{d.text}</p>
      ) : (
        <span className="italic">{t('emptyMessage')}</span>
      )}
      {quickCount > 0 ? (
        <p className="mt-1 text-[10px] text-[var(--color-mushu-amber)]">
          {t('action.send_dm.quickReplyCount', { count: quickCount })}
        </p>
      ) : null}
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
      title={t('action.reply_comment.title')}
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

export function AskQuestionNode({ data, selected }: NodeProps) {
  const t = useTranslations('flowBuilder.nodes');
  const d = (data ?? {}) as {
    questionText?: string;
    variableName?: string;
    inputType?: 'text' | 'email' | 'number' | 'phone';
  };
  return (
    <BaseNode
      icon={HelpCircle}
      iconColor="var(--color-mushu-amber)"
      title={t('action.ask_question.title')}
      category="action"
      selected={selected}
    >
      {d.questionText ? (
        <p className="line-clamp-2">{d.questionText}</p>
      ) : (
        <span className="italic">{t('action.ask_question.empty')}</span>
      )}
      {d.variableName ? (
        <p className="mt-1 text-[10px] text-[var(--color-mushu-faint)]">
          {t('action.ask_question.savesAs')}{' '}
          <span className="font-mono text-[var(--color-mushu-amber)]">
            {`{{${d.variableName}}}`}
          </span>
        </p>
      ) : null}
    </BaseNode>
  );
}

export function SetTagNode({ data, selected }: NodeProps) {
  const t = useTranslations('flowBuilder.nodes');
  const d = (data ?? {}) as { tag?: string; operation?: 'add' | 'remove' };
  const tag = d.tag?.trim();
  return (
    <BaseNode
      icon={Tag}
      iconColor="var(--color-mushu-amber)"
      title={t('action.set_tag.title')}
      category="action"
      selected={selected}
    >
      {tag ? (
        <span>
          {d.operation === 'remove' ? t('action.set_tag.removeVerb') : t('action.set_tag.addVerb')}{' '}
          <span className="font-mono text-[var(--color-mushu-ink)]">{tag}</span>
        </span>
      ) : (
        <span className="italic">{t('action.set_tag.empty')}</span>
      )}
    </BaseNode>
  );
}

export function DelayNode({ data, selected }: NodeProps) {
  const t = useTranslations('flowBuilder.nodes');
  const d = (data ?? {}) as { durationSeconds?: number };
  const seconds = d.durationSeconds ?? 0;
  return (
    <BaseNode icon={Clock} title={t('logic.delay.title')} category="logic" selected={selected}>
      {t('wait')}{' '}
      <span className="text-[var(--color-mushu-ink)]">{formatDuration(seconds)}</span>
    </BaseNode>
  );
}

export function ConditionNode({ selected }: NodeProps) {
  const t = useTranslations('flowBuilder.nodes');
  return (
    <BaseNode icon={GitBranch} title={t('logic.condition.title')} category="logic" selected={selected}>
      <span className="italic">{t('branchesV2')}</span>
    </BaseNode>
  );
}

export function EndNode({ selected }: NodeProps) {
  const t = useTranslations('flowBuilder.nodes');
  return (
    <BaseNode
      icon={Square}
      title={t('control.end.title')}
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

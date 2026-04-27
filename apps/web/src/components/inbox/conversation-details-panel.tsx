'use client';

import { Tag, UserPlus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import {
  type InboxConversationRow,
  type InboxThreadDetails,
  setConversationTag,
  updateConversation,
} from '@/actions/inbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ConversationDetailsPanelProps {
  thread: InboxThreadDetails | null;
  summary: InboxConversationRow | null;
  capabilities: {
    canReply: boolean;
    canEditContact: boolean;
    myUserId: string | null;
    myName: string | null;
  };
  onChanged: () => void;
}

export function ConversationDetailsPanel({
  thread,
  summary,
  capabilities,
  onChanged,
}: ConversationDetailsPanelProps) {
  const t = useTranslations('inbox.details');
  const [tagDraft, setTagDraft] = useState('');
  const [busy, setBusy] = useState(false);

  if (!thread) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-center text-xs text-[var(--color-mushu-faint)]">
        {summary ? t('loading') : t('selectConversation')}
      </div>
    );
  }

  async function update(args: {
    status?: 'open' | 'pending' | 'resolved' | 'snoozed';
    snoozeHours?: 1 | 24 | 72;
    assigneeUserId?: string | null;
  }) {
    if (!thread) return;
    setBusy(true);
    const r = await updateConversation({
      conversationId: thread.conversation.id,
      ...args,
    });
    setBusy(false);
    if (r.ok) onChanged();
    else toast.error(t('updateFailed', { error: r.error }));
  }

  async function onAddTag(e: FormEvent) {
    e.preventDefault();
    if (!thread) return;
    const tag = tagDraft.trim();
    if (!tag) return;
    setBusy(true);
    const r = await setConversationTag({
      conversationId: thread.conversation.id,
      tag,
      operation: 'add',
    });
    setBusy(false);
    if (r.ok) {
      setTagDraft('');
      onChanged();
    } else {
      toast.error(t('tagFailed', { error: r.error }));
    }
  }

  async function onRemoveTag(tag: string) {
    if (!thread) return;
    setBusy(true);
    const r = await setConversationTag({
      conversationId: thread.conversation.id,
      tag,
      operation: 'remove',
    });
    setBusy(false);
    if (r.ok) onChanged();
    else toast.error(t('tagFailed', { error: r.error }));
  }

  const customFieldEntries = Object.entries(thread.contact.customFields).filter(
    ([, v]) => v !== null && v !== undefined && v !== '',
  );

  const isAssignedToMe = thread.conversation.assigneeUserId === capabilities.myUserId;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-4">
      <section className="flex flex-col items-center gap-3 pb-4">
        <Avatar className="h-16 w-16">
          {thread.contact.profilePicUrl ? (
            <AvatarImage src={thread.contact.profilePicUrl} alt={thread.contact.name ?? ''} />
          ) : null}
          <AvatarFallback className="text-base">
            {initials(thread.contact.name ?? thread.contact.username)}
          </AvatarFallback>
        </Avatar>
        <div className="text-center">
          <p className="text-sm font-medium text-[var(--color-mushu-ink)]">
            {thread.contact.name || thread.contact.username || t('unknownContact')}
          </p>
          {thread.contact.username ? (
            <p className="text-[11px] text-[var(--color-mushu-faint)]">
              @{thread.contact.username}
            </p>
          ) : null}
        </div>
      </section>

      <section className="flex flex-col gap-2 border-t border-[var(--color-mushu-border)] py-4">
        <SectionTitle>{t('actions')}</SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {capabilities.canReply ? (
            isAssignedToMe ? (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => update({ assigneeUserId: null })}
              >
                {t('unassignMe')}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => update({ assigneeUserId: capabilities.myUserId })}
              >
                <UserPlus className="h-3.5 w-3.5" />
                {t('assignToMe')}
              </Button>
            )
          ) : null}
        </div>
        {capabilities.canReply ? (
          <div className="flex flex-wrap gap-1.5">
            {thread.conversation.status !== 'open' ? (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => update({ status: 'open' })}
              >
                {t('reopen')}
              </Button>
            ) : null}
            {thread.conversation.status !== 'resolved' ? (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => update({ status: 'resolved' })}
              >
                {t('resolve')}
              </Button>
            ) : null}
          </div>
        ) : null}
        {capabilities.canReply ? (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-mushu-faint)]">
              {t('snooze')}
            </span>
            <div className="flex flex-wrap gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => update({ snoozeHours: 1 })}
              >
                1h
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => update({ snoozeHours: 24 })}
              >
                1d
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => update({ snoozeHours: 72 })}
              >
                3d
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-2 border-t border-[var(--color-mushu-border)] py-4">
        <SectionTitle>
          <span className="flex items-center gap-1.5">
            <Tag className="h-3 w-3" />
            {t('tags')}
          </span>
        </SectionTitle>
        <div className="flex flex-wrap gap-1">
          {thread.contact.tags.length === 0 ? (
            <span className="text-xs text-[var(--color-mushu-faint)]">{t('noTags')}</span>
          ) : (
            thread.contact.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--color-mushu-amber)]/15 px-2 py-0.5 text-[11px] text-[var(--color-mushu-ink)]"
              >
                {tag}
                {capabilities.canEditContact ? (
                  <button
                    type="button"
                    onClick={() => onRemoveTag(tag)}
                    disabled={busy}
                    aria-label={t('removeTag', { tag })}
                    className="text-[var(--color-mushu-mute)] hover:text-[var(--color-mushu-ink)]"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                ) : null}
              </span>
            ))
          )}
        </div>
        {capabilities.canEditContact ? (
          <form onSubmit={onAddTag} className="flex gap-1.5">
            <Input
              value={tagDraft}
              onChange={(e) =>
                setTagDraft(
                  e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60).toLowerCase(),
                )
              }
              placeholder={t('addTagPlaceholder')}
              className="h-7 text-xs"
              disabled={busy}
            />
            <Button type="submit" size="sm" variant="outline" disabled={busy || !tagDraft.trim()}>
              {t('addTag')}
            </Button>
          </form>
        ) : null}
      </section>

      {customFieldEntries.length > 0 ? (
        <section className="flex flex-col gap-2 border-t border-[var(--color-mushu-border)] py-4">
          <SectionTitle>{t('customFields')}</SectionTitle>
          <dl className="flex flex-col gap-1.5">
            {customFieldEntries.map(([key, value]) => (
              <div key={key} className="flex flex-col">
                <dt className="text-[10px] uppercase tracking-wider text-[var(--color-mushu-faint)]">
                  {key}
                </dt>
                <dd className="text-xs text-[var(--color-mushu-ink)]">{String(value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-mushu-faint)]">
      {children}
    </h3>
  );
}

function initials(name: string | null): string {
  if (!name) return '?';
  const trimmed = name.trim().replace(/^@/, '');
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

'use client';

import { Inbox, SearchX } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { InboxConversationRow } from '@/actions/inbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

interface ConversationListProps {
  conversations: InboxConversationRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** True when at least one filter (status/account/assignee) narrows the
   *  result. Drives the empty-state copy: filtered = "no match, clear filters",
   *  unfiltered = "no conversations yet, here's what triggers them". */
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  hasActiveFilters,
  onClearFilters,
}: ConversationListProps) {
  const t = useTranslations('inbox.list');
  const formatter = useFormatter();

  if (conversations.length === 0) {
    if (hasActiveFilters) {
      return (
        <EmptyState
          size="compact"
          icon={SearchX}
          title={t('emptyFilteredTitle')}
          description={t('emptyFilteredBody')}
          action={
            onClearFilters
              ? { label: t('clearFilters'), onClick: onClearFilters, variant: 'outline' }
              : undefined
          }
        />
      );
    }
    return (
      <EmptyState
        size="compact"
        icon={Inbox}
        title={t('emptyTitle')}
        description={t('emptyBody')}
      />
    );
  }

  return (
    <ul className="flex-1 overflow-y-auto">
      {conversations.map((conv) => (
        <li key={conv.id}>
          <button
            type="button"
            onClick={() => onSelect(conv.id)}
            className={cn(
              'flex w-full items-start gap-3 border-b border-[var(--color-mushu-border)] px-3 py-3 text-left transition-colors',
              conv.id === selectedId
                ? 'bg-[var(--color-mushu-surface)]'
                : 'hover:bg-[var(--color-mushu-surface)]/60',
            )}
          >
            <Avatar className="h-9 w-9 shrink-0">
              {conv.contactProfilePicUrl ? (
                <AvatarImage src={conv.contactProfilePicUrl} alt={conv.contactName ?? ''} />
              ) : null}
              <AvatarFallback>{initials(conv.contactName ?? conv.contactUsername)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-[var(--color-mushu-ink)]">
                  {conv.contactName || conv.contactUsername || t('unknownContact')}
                </span>
                <span className="shrink-0 text-[10px] text-[var(--color-mushu-faint)]">
                  {formatter.relativeTime(conv.lastActivityAt, Date.now())}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--color-mushu-faint)]">
                <ChannelBadge channel={conv.channel} />
                <span className="truncate">@{conv.igAccountUsername}</span>
                <span>·</span>
                <span>#{conv.displayId}</span>
              </div>
              {conv.lastMessagePreview ? (
                <p
                  className={cn(
                    'mt-1 truncate text-xs',
                    conv.lastMessageDirection === 'outgoing'
                      ? 'text-[var(--color-mushu-mute)] italic'
                      : 'text-[var(--color-mushu-mute)]',
                  )}
                >
                  {conv.lastMessageDirection === 'outgoing' ? `↗ ${conv.lastMessagePreview}` : conv.lastMessagePreview}
                </p>
              ) : null}
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                <StatusBadge status={conv.status} />
                {conv.automationPaused ? (
                  <Badge variant="outline" className="h-4 px-1 text-[9px]">
                    {t('humanTookOver')}
                  </Badge>
                ) : null}
                {conv.assigneeName ? (
                  <Badge variant="outline" className="h-4 px-1 text-[9px]">
                    {conv.assigneeName.split(' ')[0]}
                  </Badge>
                ) : null}
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function ChannelBadge({ channel }: { channel: InboxConversationRow['channel'] }) {
  return (
    <span
      className={cn(
        'rounded-sm px-1 py-px text-[8px] font-semibold uppercase tracking-wider',
        channel === 'threads'
          ? 'bg-[var(--color-mushu-ink)]/10 text-[var(--color-mushu-ink)]'
          : 'bg-[var(--color-mushu-scarlet)]/10 text-[var(--color-mushu-scarlet)]',
      )}
    >
      {channel === 'threads' ? 'TH' : 'IG'}
    </span>
  );
}

function StatusBadge({ status }: { status: InboxConversationRow['status'] }) {
  const t = useTranslations('inbox.filters.statuses');
  const variant: Record<InboxConversationRow['status'], 'default' | 'success' | 'outline'> = {
    open: 'default',
    pending: 'outline',
    resolved: 'success',
    snoozed: 'outline',
  };
  return (
    <Badge variant={variant[status]} className="h-4 px-1 text-[9px]">
      {t(status)}
    </Badge>
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

'use client';

import { useFormatter, useTranslations } from 'next-intl';
import type { InboxConversationRow } from '@/actions/inbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ConversationListProps {
  conversations: InboxConversationRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
}: ConversationListProps) {
  const t = useTranslations('inbox.list');
  const formatter = useFormatter();

  if (conversations.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-8 text-center text-xs text-[var(--color-mushu-faint)]">
        {t('empty')}
      </div>
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

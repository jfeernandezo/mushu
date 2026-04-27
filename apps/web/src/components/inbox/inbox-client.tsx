'use client';

import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type InboxConversationRow,
  type InboxThreadDetails,
  getInboxThread,
  listInboxConversations,
} from '@/actions/inbox';
import { ConversationList } from './conversation-list';
import { ConversationDetailsPanel } from './conversation-details-panel';
import { InboxFilters, type InboxFiltersValue } from './inbox-filters';
import { ThreadView } from './thread-view';

interface InboxCapabilities {
  canView: boolean;
  canReply: boolean;
  canEditContact: boolean;
  myUserId: string | null;
  myName: string | null;
}

interface InboxClientProps {
  initialConversations: InboxConversationRow[];
  igAccounts: Array<{ id: string; username: string }>;
  capabilities: InboxCapabilities;
  initialFilters: InboxFiltersValue;
  initialConversationId: string | null;
}

const POLL_INTERVAL_MS = 10_000;

/**
 * Top-level inbox UI. Owns the list, the selected conversation, and the
 * polling loop. Children are pure renderers.
 *
 * Polling rather than SSE for v0.3: simpler infra, no extra long-lived
 * connections to manage, and 10s latency is acceptable for a CSM-style inbox.
 * Promote to SSE if/when we get user complaints (D.5 in the roadmap is
 * intentionally gated on validating polling first).
 */
export function InboxClient({
  initialConversations,
  igAccounts,
  capabilities,
  initialFilters,
  initialConversationId,
}: InboxClientProps) {
  const t = useTranslations('inbox');
  const router = useRouter();
  const searchParams = useSearchParams();

  const [conversations, setConversations] =
    useState<InboxConversationRow[]>(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialConversationId ?? initialConversations[0]?.id ?? null,
  );
  const [thread, setThread] = useState<InboxThreadDetails | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [filters, setFilters] = useState<InboxFiltersValue>(initialFilters);

  // Sync filters → URL so the page is shareable / refresh-stable.
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (filters.status && filters.status !== 'all') params.set('status', filters.status);
    else params.delete('status');
    if (filters.igAccountId) params.set('account', filters.igAccountId);
    else params.delete('account');
    if (filters.assignee && filters.assignee !== 'any') params.set('assignee', filters.assignee);
    else params.delete('assignee');
    if (selectedId) params.set('c', selectedId);
    else params.delete('c');
    const qs = params.toString();
    router.replace(qs ? `/inbox?${qs}` : '/inbox', { scroll: false });
  }, [filters, selectedId, router, searchParams]);

  const refreshList = useCallback(async () => {
    const r = await listInboxConversations({
      status: filters.status === 'all' ? undefined : filters.status,
      igAccountId: filters.igAccountId,
      assignee: filters.assignee === 'any' ? undefined : filters.assignee,
    });
    if (r.ok) setConversations(r.data);
  }, [filters]);

  const refreshThread = useCallback(async () => {
    if (!selectedId) {
      setThread(null);
      return;
    }
    setThreadLoading(true);
    const r = await getInboxThread({ conversationId: selectedId });
    setThreadLoading(false);
    if (r.ok) setThread(r.data);
  }, [selectedId]);

  // Re-fetch list when filters change.
  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  // Re-fetch thread when selection changes.
  useEffect(() => {
    void refreshThread();
  }, [refreshThread]);

  // Polling loop. Pauses while the tab is hidden — saves battery on mobile
  // and keeps Postgres quiet when nobody's actively watching.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    function start() {
      if (timer) return;
      timer = setInterval(() => {
        if (cancelled) return;
        if (document.visibilityState !== 'visible') return;
        void refreshList();
        if (selectedId) void refreshThread();
      }, POLL_INTERVAL_MS);
    }

    function stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    function onVisibility() {
      if (document.visibilityState === 'visible') {
        // Catch up immediately after tab returns to foreground.
        void refreshList();
        if (selectedId) void refreshThread();
        start();
      } else {
        stop();
      }
    }

    document.addEventListener('visibilitychange', onVisibility);
    start();
    return () => {
      cancelled = true;
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refreshList, refreshThread, selectedId]);

  const selectedSummary = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  return (
    <div className="grid h-full min-h-0 grid-cols-[320px_1fr_280px] overflow-hidden rounded-lg border border-[var(--color-mushu-border)] bg-[var(--color-mushu-bg)]">
      <aside className="flex h-full min-h-0 flex-col border-r border-[var(--color-mushu-border)]">
        <InboxFilters
          value={filters}
          onChange={setFilters}
          igAccounts={igAccounts}
        />
        <ConversationList
          conversations={conversations}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId(id)}
        />
      </aside>

      <section className="flex h-full min-h-0 flex-col">
        {selectedId ? (
          <ThreadView
            thread={thread}
            loading={threadLoading}
            myUserId={capabilities.myUserId}
            onSent={() => {
              void refreshThread();
              void refreshList();
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-mushu-mute)]">
            {t('selectConversation')}
          </div>
        )}
      </section>

      <aside className="flex h-full min-h-0 flex-col border-l border-[var(--color-mushu-border)]">
        <ConversationDetailsPanel
          thread={thread}
          summary={selectedSummary}
          capabilities={capabilities}
          onChanged={() => {
            void refreshThread();
            void refreshList();
          }}
        />
      </aside>
    </div>
  );
}

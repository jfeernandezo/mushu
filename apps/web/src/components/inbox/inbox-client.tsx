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

  // Realtime: SSE first, polling as fallback. Both pause while the tab is
  // hidden so we don't waste resources when nobody's watching.
  //
  // SSE strategy:
  //   - Open EventSource('/api/inbox/stream') on mount. On message, refresh.
  //   - If 3 reconnects fail within 30s, give up and fall back to polling.
  //     Common cause: Redis down, or proxy mishandling text/event-stream.
  //   - Polling is the safety net even when SSE works (tabs that briefly
  //     missed an event due to flaky network catch up on next tick).
  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let eventSource: EventSource | null = null;
    let sseFailWindow: number[] = [];
    const SSE_FAIL_WINDOW_MS = 30_000;
    const SSE_FAIL_THRESHOLD = 3;
    let sseGivenUp = false;

    // Debounce refreshes — bursty publishes (insert msg + update conv in
    // quick succession) collapse into one round-trip.
    let refreshPending: ReturnType<typeof setTimeout> | null = null;
    function scheduleRefresh() {
      if (refreshPending) return;
      refreshPending = setTimeout(() => {
        refreshPending = null;
        if (cancelled) return;
        if (document.visibilityState !== 'visible') return;
        void refreshList();
        if (selectedId) void refreshThread();
      }, 500);
    }

    function startPolling() {
      if (pollTimer) return;
      pollTimer = setInterval(() => {
        if (cancelled) return;
        if (document.visibilityState !== 'visible') return;
        void refreshList();
        if (selectedId) void refreshThread();
      }, POLL_INTERVAL_MS);
    }

    function stopPolling() {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }

    function startSse() {
      if (sseGivenUp) return;
      if (eventSource) return;
      if (typeof EventSource === 'undefined') return;
      try {
        const es = new EventSource('/api/inbox/stream');
        es.onmessage = () => {
          scheduleRefresh();
        };
        es.onerror = () => {
          // Track failures within the rolling window; if we cross threshold,
          // give up and let polling carry the rest of the session.
          const now = Date.now();
          sseFailWindow = [...sseFailWindow.filter((t) => now - t < SSE_FAIL_WINDOW_MS), now];
          if (sseFailWindow.length >= SSE_FAIL_THRESHOLD) {
            sseGivenUp = true;
            try {
              es.close();
            } catch {
              // ignore
            }
            eventSource = null;
          }
        };
        eventSource = es;
      } catch {
        sseGivenUp = true;
      }
    }

    function stopSse() {
      if (eventSource) {
        try {
          eventSource.close();
        } catch {
          // ignore
        }
        eventSource = null;
      }
    }

    function onVisibility() {
      if (document.visibilityState === 'visible') {
        // Catch up immediately on return.
        void refreshList();
        if (selectedId) void refreshThread();
        startPolling();
        startSse();
      } else {
        stopPolling();
        stopSse();
      }
    }

    document.addEventListener('visibilitychange', onVisibility);
    startPolling();
    startSse();

    return () => {
      cancelled = true;
      stopPolling();
      stopSse();
      if (refreshPending) clearTimeout(refreshPending);
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

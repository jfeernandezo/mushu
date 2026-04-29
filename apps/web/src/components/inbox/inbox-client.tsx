'use client';

import { ChevronLeft, MessageSquare, MessagesSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type InboxConversationRow,
  type InboxThreadDetails,
  getInboxThread,
  listInboxConversations,
} from '@/actions/inbox';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { ConversationDetailsPanel } from './conversation-details-panel';
import { ConversationList } from './conversation-list';
import { ConversationListSkeleton } from './conversation-list-skeleton';
import { InboxFilters, type InboxFiltersValue } from './inbox-filters';
import { ThreadView } from './thread-view';
import { ThreadViewSkeleton } from './thread-view-skeleton';

interface InboxCapabilities {
  canView: boolean;
  canReply: boolean;
  canEditContact: boolean;
  myUserId: string | null;
  myName: string | null;
}

interface InboxClientProps {
  initialConversations: InboxConversationRow[];
  igAccounts: Array<{ id: string; username: string; channel: 'instagram' | 'threads' }>;
  capabilities: InboxCapabilities;
  initialFilters: InboxFiltersValue;
  initialConversationId: string | null;
}

const POLL_INTERVAL_MS = 10_000;

const DEFAULT_FILTERS: InboxFiltersValue = {
  status: 'all',
  igAccountId: null,
  assignee: 'any',
};

/**
 * Top-level inbox UI. Owns the list, the selected conversation, and the
 * polling loop. Children are pure renderers.
 *
 * Responsive layout:
 *   - lg+    : 3 columns (filters/list 320px, thread 1fr, details 280px)
 *   - md     : 2 columns (filters/list 320px, thread 1fr). Details panel is
 *              accessible via a "Detalhes" button in the thread header that
 *              opens a right-side drawer (Dialog repositioned via cn).
 *   - <md    : 1 column. selectedId drives which pane is visible — list when
 *              null, thread when set. A "voltar" button in the thread header
 *              clears selectedId.
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
  const [listLoading, setListLoading] = useState(false);
  const [showDetailsDrawer, setShowDetailsDrawer] = useState(false);

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

  // Re-fetch list when filters change. Show skeleton during the in-flight
  // window IF we have nothing useful to show (avoid flicker when filtering
  // already-loaded data).
  useEffect(() => {
    let cancelled = false;
    setListLoading(true);
    refreshList().finally(() => {
      if (!cancelled) setListLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshList]);

  // Re-fetch thread when selection changes.
  useEffect(() => {
    void refreshThread();
  }, [refreshThread]);

  // Realtime: SSE first, polling as fallback. Both pause while the tab is
  // hidden so we don't waste resources when nobody's watching.
  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let eventSource: EventSource | null = null;
    let sseFailWindow: number[] = [];
    const SSE_FAIL_WINDOW_MS = 30_000;
    const SSE_FAIL_THRESHOLD = 3;
    let sseGivenUp = false;

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
          const now = Date.now();
          sseFailWindow = [...sseFailWindow.filter((tt) => now - tt < SSE_FAIL_WINDOW_MS), now];
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

  const hasActiveFilters =
    filters.status !== 'all' || filters.igAccountId !== null || filters.assignee !== 'any';
  const onClearFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  // Show the list skeleton ONLY when we have no rows AND we're loading. If
  // we already have rows from a previous query, keep them visible while the
  // new query is in flight — feels snappier and avoids skeleton flicker.
  const showListSkeleton = listLoading && conversations.length === 0;

  // Show thread skeleton when we don't have thread data yet for the selected
  // id. After the first fetch we keep showing the previous thread to avoid
  // flicker on repolls.
  const showThreadSkeleton = threadLoading && (!thread || thread.conversation.id !== selectedId);

  return (
    <div className="flex h-full min-h-0 overflow-hidden rounded-lg border border-[var(--color-mushu-border)] bg-[var(--color-mushu-bg)]">
      {/* List + filters pane */}
      <aside
        className={cn(
          'h-full min-h-0 flex-col border-r border-[var(--color-mushu-border)]',
          // Mobile: full width when no selection, hidden when selected.
          // md+: fixed width, always visible.
          'w-full md:w-80 md:shrink-0',
          selectedId ? 'hidden md:flex' : 'flex',
        )}
      >
        <InboxFilters value={filters} onChange={setFilters} igAccounts={igAccounts} />
        {showListSkeleton ? (
          <ConversationListSkeleton />
        ) : (
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId(id)}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={onClearFilters}
          />
        )}
      </aside>

      {/* Thread pane */}
      <section
        className={cn(
          'h-full min-h-0 flex-1 flex-col',
          // Mobile: hidden when no selection; flex when selected.
          // md+: always flex.
          selectedId ? 'flex' : 'hidden md:flex',
        )}
      >
        {selectedId ? (
          showThreadSkeleton ? (
            <ThreadViewSkeleton />
          ) : (
            <ThreadView
              thread={thread}
              loading={threadLoading}
              myUserId={capabilities.myUserId}
              onSent={() => {
                void refreshThread();
                void refreshList();
              }}
              onBack={() => setSelectedId(null)}
              onShowDetails={() => setShowDetailsDrawer(true)}
            />
          )
        ) : (
          <EmptyState
            icon={MessagesSquare}
            title={t('selectConversationTitle')}
            description={t('selectConversationBody')}
          />
        )}
      </section>

      {/* Details pane: inline only on lg+. md and below use the drawer below. */}
      <aside className="hidden h-full min-h-0 w-72 shrink-0 flex-col border-l border-[var(--color-mushu-border)] lg:flex">
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

      {/* Details drawer for md and below — Dialog repositioned to slide from
          the right with full height. Trigger is the "Detalhes" button in
          ThreadView's header (only rendered on <lg). */}
      <Dialog open={showDetailsDrawer} onOpenChange={setShowDetailsDrawer}>
        <DialogContent className="left-auto right-0 top-0 h-full w-80 max-w-[90vw] -translate-x-0 -translate-y-0 rounded-none rounded-l-lg p-0 lg:hidden">
          <div className="flex h-full flex-col">
            <header className="flex items-center justify-between border-b border-[var(--color-mushu-border)] px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-medium text-[var(--color-mushu-ink)]">
                <MessageSquare className="h-4 w-4" />
                {t('detailsTitle')}
              </h2>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowDetailsDrawer(false)}
                aria-label={t('closeDetails')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </header>
            <ConversationDetailsPanel
              thread={thread}
              summary={selectedSummary}
              capabilities={capabilities}
              onChanged={() => {
                void refreshThread();
                void refreshList();
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

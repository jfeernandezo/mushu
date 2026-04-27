'use client';

import { Lock, Send, StickyNote } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import {
  type FormEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';
import { type InboxThreadDetails, sendManualMessage } from '@/actions/inbox';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ThreadViewProps {
  thread: InboxThreadDetails | null;
  loading: boolean;
  myUserId: string | null;
  /** Called after a successful manual send so the parent can re-fetch. */
  onSent: () => void;
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export function ThreadView({ thread, loading, myUserId, onSent }: ThreadViewProps) {
  const t = useTranslations('inbox.thread');
  const formatter = useFormatter();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [text, setText] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [sending, setSending] = useState(false);

  // Auto-scroll to bottom whenever the message list grows. Using
  // useLayoutEffect avoids the brief flash where the new message renders
  // off-screen before scrolling.
  const messageCount = thread?.messages.length ?? 0;
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messageCount, thread?.conversation.id]);

  // Reset compose state when switching conversations.
  useEffect(() => {
    setText('');
    setIsPrivate(false);
  }, [thread?.conversation.id]);

  if (!thread) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--color-mushu-mute)]">
        {loading ? t('loading') : t('selectConversation')}
      </div>
    );
  }

  const remainingWindowMs = thread.conversation.lastIncomingAt
    ? TWENTY_FOUR_HOURS_MS - (Date.now() - thread.conversation.lastIncomingAt.getTime())
    : -1;
  const isWindowOpen = remainingWindowMs > 0;
  const canSendPublic = thread.canSendNow;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (sending || !text.trim()) return;
    if (!thread) return;
    setSending(true);
    const r = await sendManualMessage({
      conversationId: thread.conversation.id,
      text: text.trim(),
      isPrivate,
    });
    setSending(false);
    if (r.ok) {
      setText('');
      onSent();
    } else {
      toast.error(t('sendFailed', { error: r.error }));
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between border-b border-[var(--color-mushu-border)] px-4 py-3">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-[var(--color-mushu-ink)]">
            {thread.contact.name || thread.contact.username || t('unknownContact')}
          </span>
          <span className="text-[11px] text-[var(--color-mushu-faint)]">
            @{thread.igAccount.username} · #{thread.conversation.displayId}
          </span>
        </div>
        <WindowIndicator remainingMs={remainingWindowMs} />
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        <ul className="flex flex-col gap-2">
          {thread.messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              isMine={m.senderType === 'user' && m.senderId === myUserId}
              formattedTime={formatter.dateTime(m.createdAt, {
                hour: '2-digit',
                minute: '2-digit',
              })}
            />
          ))}
        </ul>
      </div>

      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-2 border-t border-[var(--color-mushu-border)] bg-[var(--color-mushu-surface)] p-3"
      >
        {!isWindowOpen && !isPrivate ? (
          <p className="rounded-md border border-[var(--color-mushu-amber)]/30 bg-[var(--color-mushu-amber)]/10 px-2 py-1 text-[11px] text-[var(--color-mushu-amber)]">
            {t('windowClosed')}
          </p>
        ) : null}
        {thread.sendBlockedReason === 'no_permission' ? (
          <p className="rounded-md border border-[var(--color-mushu-danger)]/30 bg-[var(--color-mushu-danger)]/10 px-2 py-1 text-[11px] text-[var(--color-mushu-danger)]">
            {t('noReplyPermission')}
          </p>
        ) : null}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          disabled={
            sending || thread.sendBlockedReason === 'no_permission' || (!isWindowOpen && !isPrivate)
          }
          placeholder={isPrivate ? t('privatePlaceholder') : t('publicPlaceholder')}
          className={cn(
            'w-full resize-none rounded-md border bg-[var(--color-mushu-bg)] px-3 py-2 text-sm text-[var(--color-mushu-ink)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-mushu-amber)]',
            isPrivate
              ? 'border-[var(--color-mushu-amber)]/40 bg-[var(--color-mushu-amber)]/5'
              : 'border-[var(--color-mushu-border)]',
          )}
        />
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setIsPrivate((p) => !p)}
            disabled={sending}
            className={cn(
              'flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition-colors',
              isPrivate
                ? 'border-[var(--color-mushu-amber)]/50 bg-[var(--color-mushu-amber)]/10 text-[var(--color-mushu-amber)]'
                : 'border-[var(--color-mushu-border)] text-[var(--color-mushu-mute)] hover:text-[var(--color-mushu-ink)]',
            )}
          >
            <StickyNote className="h-3 w-3" />
            {isPrivate ? t('privateNoteOn') : t('privateNoteOff')}
          </button>
          <Button
            type="submit"
            size="sm"
            disabled={
              sending ||
              !text.trim() ||
              thread.sendBlockedReason === 'no_permission' ||
              (!isWindowOpen && !isPrivate)
            }
          >
            <Send className="h-3.5 w-3.5" />
            {sending ? t('sending') : isPrivate ? t('addNote') : t('sendDm')}
          </Button>
        </div>
      </form>
    </div>
  );
}

function MessageBubble({
  message,
  isMine,
  formattedTime,
}: {
  message: InboxThreadDetails['messages'][number];
  isMine: boolean;
  formattedTime: string;
}) {
  const t = useTranslations('inbox.thread');

  if (message.isPrivate) {
    return (
      <li className="flex justify-center">
        <div className="max-w-[75%] rounded-md border border-[var(--color-mushu-amber)]/30 bg-[var(--color-mushu-amber)]/5 px-3 py-2 text-xs text-[var(--color-mushu-mute)]">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--color-mushu-amber)]">
            <Lock className="h-3 w-3" />
            <span>{t('internalNote')}</span>
            {message.senderName ? <span>· {message.senderName}</span> : null}
          </div>
          <p className="whitespace-pre-wrap">{message.content}</p>
          <p className="mt-1 text-right text-[9px] text-[var(--color-mushu-faint)]">{formattedTime}</p>
        </div>
      </li>
    );
  }

  const fromContact = message.senderType === 'contact';
  const fromAutomation = message.senderType === 'automation';
  const sideClass = fromContact ? 'justify-start' : 'justify-end';
  const bubbleClass = fromContact
    ? 'border-[var(--color-mushu-border)] bg-[var(--color-mushu-surface)] text-[var(--color-mushu-ink)]'
    : fromAutomation
      ? 'border-[var(--color-mushu-amber)]/30 bg-[var(--color-mushu-amber)]/10 text-[var(--color-mushu-ink)]'
      : 'border-[var(--color-mushu-scarlet-soft)]/40 bg-[var(--color-mushu-scarlet)]/10 text-[var(--color-mushu-ink)]';
  const senderLabel = fromContact
    ? null
    : fromAutomation
      ? t('automation')
      : isMine
        ? t('you')
        : message.senderName ?? t('teammate');

  const quickReplies = Array.isArray(message.contentAttributes.quickReplies)
    ? (message.contentAttributes.quickReplies as string[])
    : [];

  return (
    <li className={`flex ${sideClass}`}>
      <div className={`max-w-[75%] rounded-lg border px-3 py-2 ${bubbleClass}`}>
        {senderLabel ? (
          <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-mushu-faint)]">
            {senderLabel}
          </p>
        ) : null}
        <p className="whitespace-pre-wrap text-sm">{message.content}</p>
        {quickReplies.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {quickReplies.map((qr) => (
              <span
                key={qr}
                className="rounded-full border border-[var(--color-mushu-border)] bg-[var(--color-mushu-bg)] px-2 py-0.5 text-[10px] text-[var(--color-mushu-mute)]"
              >
                {qr}
              </span>
            ))}
          </div>
        ) : null}
        <p className="mt-1 flex items-center justify-end gap-1.5 text-[9px] text-[var(--color-mushu-faint)]">
          {message.status === 'failed' ? (
            <span className="text-[var(--color-mushu-danger)]">{t('failedStatus')}</span>
          ) : message.status === 'queued' ? (
            <span>{t('queuedStatus')}</span>
          ) : null}
          <span>{formattedTime}</span>
        </p>
      </div>
    </li>
  );
}

function WindowIndicator({ remainingMs }: { remainingMs: number }) {
  const t = useTranslations('inbox.thread');
  if (remainingMs <= 0) {
    return (
      <span className="rounded-full border border-[var(--color-mushu-danger)]/30 bg-[var(--color-mushu-danger)]/10 px-2 py-0.5 text-[10px] text-[var(--color-mushu-danger)]">
        {t('windowExpired')}
      </span>
    );
  }
  const hours = Math.floor(remainingMs / (60 * 60 * 1000));
  const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
  return (
    <span className="rounded-full border border-[var(--color-mushu-success)]/30 bg-[var(--color-mushu-success)]/10 px-2 py-0.5 text-[10px] text-[var(--color-mushu-success)]">
      {t('windowOpen', { hours, minutes })}
    </span>
  );
}

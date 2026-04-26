'use client';

import { Bell, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import {
  listNotifications,
  markAllAsRead,
  markAsRead,
  type NotificationRow,
  unreadCount,
} from '@/actions/notifications';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const POLL_MS = 30_000;

interface NotificationsBellProps {
  orgId: string | null;
}

export function NotificationsBell({ orgId }: NotificationsBellProps) {
  const t = useTranslations('notifications');
  const tTopnav = useTranslations('topnav');
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!orgId) return;
    let stopped = false;

    async function tick() {
      const [c, list] = await Promise.all([
        unreadCount(),
        listNotifications({ limit: 5 }),
      ]);
      if (stopped) return;
      setCount(c);
      if (list.ok) setItems(list.data);
    }

    void tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [orgId]);

  function onItemClick(id: string) {
    startTransition(async () => {
      await markAsRead(id);
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: n.readAt ?? new Date() } : n)),
      );
      setCount((c) => Math.max(0, c - 1));
    });
  }

  function onMarkAllRead() {
    startTransition(async () => {
      await markAllAsRead();
      setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date() })));
      setCount(0);
    });
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8"
          aria-label={tTopnav('notifications')}
        >
          <Bell className="h-4 w-4" />
          {count > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-mushu-scarlet)] px-1 text-[10px] font-medium text-white">
              {count > 99 ? '99+' : count}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <header className="flex items-center justify-between border-b border-[var(--color-mushu-border)] px-3 py-2">
          <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-mushu-mute)]">
            {t('title')}
          </span>
          {count > 0 ? (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="flex items-center gap-1 text-xs text-[var(--color-mushu-amber)] hover:underline"
            >
              <Check className="h-3 w-3" />
              {t('markAllRead')}
            </button>
          ) : null}
        </header>

        {items.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <p className="text-xs text-[var(--color-mushu-faint)]">{t('allCaughtUp')}</p>
          </div>
        ) : (
          <ul className="max-h-80 overflow-y-auto">
            {items.map((n) => (
              <li key={n.id}>
                <NotificationItem item={n} onSeen={() => onItemClick(n.id)} />
              </li>
            ))}
          </ul>
        )}

        <footer className="border-t border-[var(--color-mushu-border)] px-3 py-2">
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="text-xs text-[var(--color-mushu-amber)] hover:underline"
          >
            {t('viewAll')}
          </Link>
        </footer>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationItem({
  item,
  onSeen,
}: {
  item: NotificationRow;
  onSeen: () => void;
}) {
  const t = useTranslations('notifications.relative');
  const unread = item.readAt === null;
  const content = (
    <div
      className={cn(
        'flex flex-col gap-0.5 px-3 py-2.5 transition-colors hover:bg-[var(--color-mushu-surface-hover)]',
        unread && 'bg-[var(--color-mushu-surface-hover)]/40',
      )}
    >
      <div className="flex items-start gap-2">
        {unread ? (
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-mushu-amber)]" />
        ) : (
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0" />
        )}
        <div className="flex-1 leading-tight">
          <p className="text-sm text-[var(--color-mushu-ink)]">{item.title}</p>
          {item.body ? (
            <p className="mt-0.5 text-xs text-[var(--color-mushu-mute)]">{item.body}</p>
          ) : null}
          <p className="mt-1 text-[10px] uppercase tracking-wider text-[var(--color-mushu-faint)]">
            {formatRelative(item.createdAt, t)}
          </p>
        </div>
      </div>
    </div>
  );

  if (item.link) {
    return (
      <Link href={item.link} onClick={onSeen} className="block">
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onSeen} className="block w-full text-left">
      {content}
    </button>
  );
}

type RelT = (
  key: string,
  values?: Record<string, string | number | Date>,
) => string;

function formatRelative(date: Date | string, t: RelT): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return t('justNow');
  if (m < 60) return t('minutes', { m });
  const h = Math.floor(m / 60);
  if (h < 24) return t('hours', { h });
  const days = Math.floor(h / 24);
  return t('days', { d: days });
}

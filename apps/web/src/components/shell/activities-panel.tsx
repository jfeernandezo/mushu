'use client';

import { Activity, AlertCircle, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { type ReactNode, useEffect, useState } from 'react';
import { getRecentContacts, type RecentContact } from '@/actions/contacts';
import {
  listNotifications,
  type NotificationRow,
} from '@/actions/notifications';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { colorFromString, initialsFromName } from '@/lib/utils';

const POLL_MS = 30_000;

interface ActivitiesPanelProps {
  orgId: string;
}

export function ActivitiesPanel({ orgId }: ActivitiesPanelProps) {
  const tNotif = useTranslations('notifications');
  const tPanel = useTranslations('activitiesPanel');
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [contacts, setContacts] = useState<RecentContact[]>([]);

  useEffect(() => {
    if (!orgId) return;
    let stopped = false;

    async function tick() {
      const [list, recent] = await Promise.all([
        listNotifications({ limit: 5 }),
        getRecentContacts(orgId, 5),
      ]);
      if (stopped) return;
      if (list.ok) setNotifications(list.data);
      setContacts(recent);
    }

    void tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [orgId]);

  return (
    <aside className="flex h-screen w-80 flex-col gap-6 overflow-y-auto border-l border-[var(--color-mushu-border)] bg-[var(--color-mushu-bg)] px-5 py-6">
      <Section title={tNotif('title')} icon={<AlertCircle className="h-3.5 w-3.5" />}>
        {notifications.length === 0 ? (
          <EmptyHint>{tNotif('allCaughtUp')}</EmptyHint>
        ) : (
          <div className="flex flex-col gap-3">
            {notifications.map((n) => (
              <NotificationLine key={n.id} item={n} />
            ))}
          </div>
        )}
      </Section>

      <Separator />

      <Section title={tPanel('activities')} icon={<Activity className="h-3.5 w-3.5" />}>
        <EmptyHint>{tPanel('activitiesEmpty')}</EmptyHint>
      </Section>

      <Separator />

      <Section title={tPanel('recentContacts')} icon={<UserPlus className="h-3.5 w-3.5" />}>
        {contacts.length === 0 ? (
          <EmptyHint>{tPanel('recentContactsEmpty')}</EmptyHint>
        ) : (
          <div className="flex flex-col gap-3">
            {contacts.map((c) => (
              <div key={c.id} className="flex items-center gap-3">
                <Avatar className="h-7 w-7">
                  <AvatarFallback
                    style={{ backgroundColor: colorFromString(c.name ?? c.id) }}
                    className="text-[10px] text-white"
                  >
                    {initialsFromName(c.name ?? c.igUsername ?? '?')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 leading-tight">
                  <p className="text-sm text-[var(--color-mushu-ink)]">
                    {c.name ?? c.igUsername ?? tPanel('unnamed')}
                  </p>
                  {c.igUsername ? (
                    <p className="text-xs text-[var(--color-mushu-faint)]">
                      @{c.igUsername}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </aside>
  );
}

function NotificationLine({ item }: { item: NotificationRow }) {
  const body = (
    <div className="flex items-start gap-3">
      <AlertCircle
        className={`mt-0.5 h-4 w-4 shrink-0 ${
          item.readAt
            ? 'text-[var(--color-mushu-faint)]'
            : 'text-[var(--color-mushu-amber)]'
        }`}
      />
      <div className="flex-1 leading-tight">
        <p className="text-sm text-[var(--color-mushu-ink)]">{item.title}</p>
        {item.body ? (
          <p className="text-xs text-[var(--color-mushu-faint)]">{item.body}</p>
        ) : null}
      </div>
    </div>
  );
  return item.link ? <Link href={item.link}>{body}</Link> : body;
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-1.5 text-[var(--color-mushu-mute)]">
        {icon}
        <h2 className="text-xs font-medium uppercase tracking-wider">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function EmptyHint({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-relaxed text-[var(--color-mushu-faint)]">{children}</p>;
}

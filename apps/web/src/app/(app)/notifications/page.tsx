import { AlertCircle, CheckCheck } from 'lucide-react';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { listNotifications } from '@/actions/notifications';
import { MarkAllReadButton } from '@/components/notifications/mark-all-read-button';
import { AppShell } from '@/components/shell/app-shell';
import { Card, CardContent } from '@/components/ui/card';
import { auth } from '@/lib/auth';

export default async function NotificationsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  const result = await listNotifications({ limit: 100 });
  const items = result.ok ? result.data : [];
  const hasUnread = items.some((n) => n.readAt === null);

  return (
    <AppShell breadcrumb={[{ label: 'Notifications' }]} showActivitiesPanel={false}>
      <div className="flex max-w-3xl flex-col gap-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
            <p className="text-sm text-[var(--color-mushu-mute)]">
              Recent events from your workspace.
            </p>
          </div>
          {hasUnread ? <MarkAllReadButton /> : null}
        </div>

        <Card>
          <CardContent className="p-0">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                <CheckCheck className="h-6 w-6 text-[var(--color-mushu-faint)]" />
                <p className="text-sm text-[var(--color-mushu-mute)]">
                  Nothing here yet — connect an Instagram account in{' '}
                  <Link
                    href="/settings/workspace"
                    className="text-[var(--color-mushu-amber)] hover:underline"
                  >
                    Workspace
                  </Link>{' '}
                  to start receiving events.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[var(--color-mushu-border)]">
                {items.map((n) => {
                  const unread = n.readAt === null;
                  const inner = (
                    <div className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--color-mushu-surface-hover)]">
                      <AlertCircle
                        className={`mt-0.5 h-4 w-4 shrink-0 ${
                          unread
                            ? 'text-[var(--color-mushu-amber)]'
                            : 'text-[var(--color-mushu-faint)]'
                        }`}
                      />
                      <div className="flex-1 leading-tight">
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-[var(--color-mushu-ink)]">{n.title}</p>
                          {unread ? (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-mushu-amber)]" />
                          ) : null}
                        </div>
                        {n.body ? (
                          <p className="mt-0.5 text-xs text-[var(--color-mushu-mute)]">
                            {n.body}
                          </p>
                        ) : null}
                        <p className="mt-1 text-[10px] uppercase tracking-wider text-[var(--color-mushu-faint)]">
                          {n.createdAt.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                  return (
                    <li key={n.id}>
                      {n.link ? <Link href={n.link}>{inner}</Link> : inner}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

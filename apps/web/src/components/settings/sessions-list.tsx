'use client';

import { Laptop, LogOut, Smartphone } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { toast } from 'sonner';
import {
  revokeAllOtherSessions,
  revokeSessionById,
  type SessionRow,
} from '@/actions/user';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface SessionsListProps {
  sessions: SessionRow[];
}

export function SessionsList({ sessions }: SessionsListProps) {
  const t = useTranslations('settings.sessions');
  const tRel = useTranslations('notifications.relative');
  const formatter = useFormatter();
  const [pending, startTransition] = useTransition();

  function onRevoke(id: string) {
    startTransition(async () => {
      const r = await revokeSessionById(id);
      if (r.ok) toast.success(t('revoked'));
      else toast.error(t('couldNotRevoke', { error: r.error }));
    });
  }

  function onRevokeAllOthers() {
    if (!confirm(t('revokeAllOthersConfirm'))) return;
    startTransition(async () => {
      const r = await revokeAllOtherSessions();
      if (r.ok) toast.success(t('othersRevoked'));
      else toast.error(t('couldNotRevoke', { error: r.error }));
    });
  }

  const hasOthers = sessions.some((s) => !s.isCurrent);

  return (
    <div className="flex flex-col gap-4">
      {hasOthers ? (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={onRevokeAllOthers}
          >
            <LogOut className="h-3.5 w-3.5" />
            {t('revokeAllOthers')}
          </Button>
        </div>
      ) : null}

      <ul className="flex flex-col gap-2">
        {sessions.map((s) => (
          <li
            key={s.id}
            className="flex items-center gap-3 rounded-md border border-[var(--color-mushu-border)] bg-[var(--color-mushu-surface)] px-3 py-2.5"
          >
            <DeviceIcon ua={s.userAgent} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm text-[var(--color-mushu-ink)]">
                  {prettyUserAgent(s.userAgent, t)}
                </p>
                {s.isCurrent ? (
                  <Badge variant="success" className="shrink-0">
                    {t('thisSession')}
                  </Badge>
                ) : null}
              </div>
              <p className="text-xs text-[var(--color-mushu-faint)]">
                {s.ipAddress ?? t('unknownIp')} ·{' '}
                {t('lastActive', { when: formatRelative(s.updatedAt, tRel) })} ·{' '}
                {t('expires', {
                  date: formatter.dateTime(s.expiresAt, { dateStyle: 'short' }),
                })}
              </p>
            </div>
            {!s.isCurrent ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => onRevoke(s.id)}
              >
                {t('revoke')}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DeviceIcon({ ua }: { ua: string | null }) {
  const Icon = ua && /mobile|iphone|android/i.test(ua) ? Smartphone : Laptop;
  return <Icon className="h-4 w-4 shrink-0 text-[var(--color-mushu-mute)]" />;
}

type SessionT = (
  key: string,
  values?: Record<string, string | number | Date>,
) => string;

function prettyUserAgent(ua: string | null, t: SessionT): string {
  if (!ua) return t('unknownDevice');
  const browser =
    ua.match(/(Edg|Chrome|Firefox|Safari)\/[\d.]+/)?.[1] ?? t('browserGeneric');
  const os = ua.match(/Windows NT|Macintosh|Linux|iPhone|Android/)?.[0] ?? t('deviceGeneric');
  const osPretty = os === 'Windows NT' ? 'Windows' : os === 'Macintosh' ? 'macOS' : os;
  return t('browserOn', { browser, os: osPretty });
}

type RelT = (
  key: string,
  values?: Record<string, string | number | Date>,
) => string;

function formatRelative(date: Date, t: RelT): string {
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return t('justNow');
  if (m < 60) return t('minutes', { m });
  const h = Math.floor(m / 60);
  if (h < 24) return t('hours', { h });
  const d = Math.floor(h / 24);
  return t('days', { d });
}

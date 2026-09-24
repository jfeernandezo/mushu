'use client';

import { Moon, Sun } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { startTransition } from 'react';
import { updateUserPreferences } from '@/actions/preferences';
import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { MobileNavigation } from './mobile-navigation';
import { NotificationsBell } from './notifications-bell';
import { UserMenu } from './user-menu';

interface AppTopNavProps {
  breadcrumb: { label: string; href?: string }[];
  user?: { name: string | null | undefined; email: string };
  orgId?: string | null;
}

export function AppTopNav({ breadcrumb, user, orgId }: AppTopNavProps) {
  const { resolved, setTheme } = useTheme();
  const t = useTranslations('topnav');

  function toggleTheme() {
    const next = resolved === 'dark' ? 'light' : 'dark';
    setTheme(next);
    startTransition(() => {
      void updateUserPreferences({ theme: next });
    });
  }

  return (
    <header className="flex min-h-14 min-w-0 items-center gap-2 sm:gap-4 border-b border-[var(--color-mushu-border)] bg-[var(--color-mushu-bg)] px-3 sm:px-6">
      <MobileNavigation />
      <nav
        aria-label={t('breadcrumb')}
        className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-sm"
      >
        {breadcrumb.map((b, i) => (
          <span key={b.href ?? b.label} className="flex min-w-0 items-center gap-2">
            {i > 0 && <span className="text-[var(--color-mushu-faint)]">/</span>}
            {b.href ? (
              <Link
                className="truncate text-[var(--color-mushu-mute)] hover:text-[var(--color-mushu-ink)]"
                href={b.href}
              >
                {b.label}
              </Link>
            ) : (
              <span aria-current="page" className="truncate text-[var(--color-mushu-ink)]">
                {b.label}
              </span>
            )}
          </span>
        ))}
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={toggleTheme}
          aria-label={t('toggleTheme')}
        >
          {resolved === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </Button>

        <NotificationsBell orgId={orgId ?? null} />

        <Separator orientation="vertical" className="h-6" />

        <UserMenu user={user} />
      </div>
    </header>
  );
}

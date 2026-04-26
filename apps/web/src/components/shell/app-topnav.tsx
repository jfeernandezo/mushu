'use client';

import { Moon, Search, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { startTransition } from 'react';
import { updateUserPreferences } from '@/actions/preferences';
import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
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
    <header className="flex h-14 items-center gap-4 border-b border-[var(--color-mushu-border)] bg-[var(--color-mushu-bg)] px-6">
      <nav aria-label="breadcrumb" className="flex items-center gap-2 text-sm">
        {breadcrumb.map((b, i) => (
          <span key={`${b.label}-${i}`} className="flex items-center gap-2">
            {i > 0 && <span className="text-[var(--color-mushu-faint)]">/</span>}
            {b.href ? (
              <a
                className="text-[var(--color-mushu-mute)] hover:text-[var(--color-mushu-ink)]"
                href={b.href}
              >
                {b.label}
              </a>
            ) : (
              <span className="text-[var(--color-mushu-ink)]">{b.label}</span>
            )}
          </span>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-mushu-faint)]" />
          <Input
            placeholder={t('search')}
            className="h-8 pl-8 text-xs"
            disabled
          />
        </div>

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

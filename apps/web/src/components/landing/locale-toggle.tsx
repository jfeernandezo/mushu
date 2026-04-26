'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { updateUserPreferences } from '@/actions/preferences';
import type { Locale } from '@/i18n/config';
import { cn } from '@/lib/utils';

export function LocaleToggle({ currentLocale }: { currentLocale: Locale }) {
  const router = useRouter();
  const t = useTranslations('landing.nav');
  const [isPending, startTransition] = useTransition();

  function switchLocale(locale: Locale) {
    if (locale === currentLocale || isPending) return;
    startTransition(async () => {
      await updateUserPreferences({ locale });
      router.refresh();
    });
  }

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-md border border-[var(--color-mushu-border)] p-0.5 text-xs font-medium',
        isPending && 'opacity-70',
      )}
      aria-label={t('localeToggleLabel')}
    >
      {(['pt-BR', 'en'] as const).map((locale) => {
        const isActive = locale === currentLocale;
        return (
          <button
            key={locale}
            type="button"
            aria-pressed={isActive}
            aria-label={t('localeToggleLabel')}
            disabled={isPending}
            onClick={() => switchLocale(locale)}
            className={cn(
              'rounded-[5px] px-2.5 py-1 transition-colors disabled:cursor-wait',
              isActive
                ? 'bg-[var(--color-mushu-surface)] text-[var(--color-mushu-ink)]'
                : 'text-[var(--color-mushu-mute)] hover:text-[var(--color-mushu-ink)]',
            )}
          >
            {locale === 'pt-BR' ? t('localePtLabel') : t('localeEnLabel')}
          </button>
        );
      })}
    </div>
  );
}

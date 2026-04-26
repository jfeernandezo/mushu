'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export function LegalLinks({ className }: { className?: string }) {
  const t = useTranslations('legal');
  return (
    <nav
      className={cn(
        'flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-[var(--color-mushu-faint)]',
        className,
      )}
    >
      <Link href="/privacy" className="hover:text-[var(--color-mushu-mute)]">
        {t('privacy')}
      </Link>
      <span aria-hidden>·</span>
      <Link href="/terms" className="hover:text-[var(--color-mushu-mute)]">
        {t('terms')}
      </Link>
      <span aria-hidden>·</span>
      <Link href="/data-deletion" className="hover:text-[var(--color-mushu-mute)]">
        {t('dataDeletion')}
      </Link>
    </nav>
  );
}

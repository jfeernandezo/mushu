import { getLocale, getTranslations } from 'next-intl/server';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { LEGAL } from '@/lib/legal';

// Read legal content from env at request time, not at build time.
// Otherwise placeholders get baked into the bundle and forks can't reconfigure.
export const dynamic = 'force-dynamic';

export default async function LegalLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('legal');
  const locale = await getLocale();
  const isPtOnly = locale !== 'pt-BR';

  return (
    <div className="min-h-screen bg-[var(--color-mushu-bg)] text-[var(--color-mushu-ink)]">
      <header className="border-b border-[var(--color-mushu-border)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/mushu-logo.png"
              alt="Mushu"
              width={28}
              height={28}
              className="rounded-md"
            />
            <span className="text-base font-semibold tracking-tight">Mushu</span>
          </Link>
          <nav className="flex gap-4 text-sm text-[var(--color-mushu-mute)]">
            <Link href="/privacy" className="hover:text-[var(--color-mushu-ink)]">
              {t('privacy')}
            </Link>
            <Link href="/terms" className="hover:text-[var(--color-mushu-ink)]">
              {t('terms')}
            </Link>
            <Link href="/data-deletion" className="hover:text-[var(--color-mushu-ink)]">
              {t('dataDeletion')}
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        {isPtOnly ? (
          <div className="mb-8 rounded-md border border-[var(--color-mushu-amber)]/40 bg-[var(--color-mushu-surface)] px-4 py-3 text-xs text-[var(--color-mushu-mute)]">
            {t('ptOnlyBanner')}
          </div>
        ) : null}

        {children}

        <p className="mt-16 border-t border-[var(--color-mushu-border)] pt-6 text-xs text-[var(--color-mushu-faint)]">
          {t('effective', { date: LEGAL.effectiveDate })}
        </p>
      </main>
    </div>
  );
}

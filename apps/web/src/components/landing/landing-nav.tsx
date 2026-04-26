import { Github, LogIn } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import { LocaleToggle } from './locale-toggle';

const primaryButton =
  'inline-flex items-center justify-center gap-2 rounded-md bg-gradient-to-b from-[var(--color-mushu-scarlet)] to-[var(--color-mushu-scarlet-soft)] px-4 py-2 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_8px_24px_-8px_rgba(199,62,29,0.5)] transition hover:brightness-110';

const outlineButton =
  'inline-flex items-center justify-center gap-2 rounded-md border border-[var(--color-mushu-border)] px-4 py-2 text-sm font-semibold text-[var(--color-mushu-ink)] transition hover:bg-[var(--color-mushu-surface-hover)]';

export async function LandingNav({ currentLocale }: { currentLocale: Locale }) {
  const t = await getTranslations('landing.nav');

  const navLinks = [
    { href: '#features', label: t('features') },
    { href: '#process', label: t('howItWorks') },
    { href: '#use-cases', label: t('useCases') },
    { href: '#faq', label: t('faq') },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-mushu-border-subtle)] bg-[color-mix(in_srgb,var(--color-mushu-bg)_82%,transparent)] backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 lg:px-6">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/mushu-logo.png" alt="Mushu" width={28} height={28} className="rounded-md" />
          <span className="text-base font-semibold tracking-tight">Mushu</span>
        </Link>

        <div className="hidden items-center gap-6 lg:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-[var(--color-mushu-mute)] transition hover:text-[var(--color-mushu-ink)]"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <LocaleToggle currentLocale={currentLocale} />
          <a
            href="https://github.com/jfeernandezo/mushu"
            target="_blank"
            rel="noopener"
            className={`${outlineButton} hidden sm:inline-flex`}
          >
            <Github className="h-4 w-4" />
            <span className="hidden lg:inline">{t('github')}</span>
          </a>
          <Link href="/login" className={`${primaryButton} px-3 sm:px-4`}>
            <LogIn className="h-4 w-4 sm:hidden" />
            <span>{t('signIn')}</span>
          </Link>
        </div>
      </nav>
    </header>
  );
}

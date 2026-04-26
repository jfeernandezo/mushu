import { Github } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import Image from 'next/image';
import Link from 'next/link';
import { LegalLinks } from '@/components/legal-links';
import { isLocale } from '@/i18n/config';
import { LocaleToggle } from './locale-toggle';

export async function LandingFooter() {
  const t = await getTranslations('landing.footer');
  const locale = await getLocale();
  const currentLocale = isLocale(locale) ? locale : 'pt-BR';

  return (
    <footer className="border-t border-[var(--color-mushu-border-subtle)] px-4 py-12 sm:px-6 lg:px-16">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href="/" className="flex items-center gap-3">
              <Image src="/mushu-logo.png" alt="Mushu" width={32} height={32} className="rounded-md" />
              <span className="text-base font-semibold tracking-tight">Mushu</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-6 text-[var(--color-mushu-mute)]">{t('tagline')}</p>
            <a
              href="https://github.com/jfeernandezo/mushu"
              target="_blank"
              rel="noopener"
              className="mt-5 inline-flex h-10 w-10 items-center justify-center rounded-md border border-[var(--color-mushu-border)] text-[var(--color-mushu-mute)] transition hover:bg-[var(--color-mushu-surface-hover)] hover:text-[var(--color-mushu-ink)]"
            >
              <Github className="h-4 w-4" />
            </a>
          </div>

          <div>
            <h3 className="text-sm font-semibold">{t('project.title')}</h3>
            <ul className="mt-4 space-y-3 text-sm text-[var(--color-mushu-mute)]">
              <li>
                <a href="#features" className="hover:text-[var(--color-mushu-ink)]">
                  {t('project.features')}
                </a>
              </li>
              <li>
                <a href="#process" className="hover:text-[var(--color-mushu-ink)]">
                  {t('project.howItWorks')}
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/jfeernandezo/mushu#roadmap"
                  target="_blank"
                  rel="noopener"
                  className="hover:text-[var(--color-mushu-ink)]"
                >
                  {t('project.roadmap')}
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/jfeernandezo/mushu/blob/main/docs/SELF_HOSTING.md"
                  target="_blank"
                  rel="noopener"
                  className="hover:text-[var(--color-mushu-ink)]"
                >
                  {t('project.selfHosting')}
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold">{t('legal.title')}</h3>
            <LegalLinks className="mt-4 justify-start gap-x-0 gap-y-3 text-left [&>span]:hidden [&>a]:basis-full" />
            <a
              href="https://github.com/jfeernandezo/mushu/blob/main/LICENSE"
              target="_blank"
              rel="noopener"
              className="mt-3 block text-sm text-[var(--color-mushu-mute)] hover:text-[var(--color-mushu-ink)]"
            >
              {t('legal.license')}
            </a>
          </div>

          <div className="lg:text-right">
            <h3 className="text-sm font-semibold">{t('builtBy')}</h3>
            <a
              href="https://rayastudio.com.br"
              target="_blank"
              rel="noopener"
              className="mt-4 block text-sm text-[var(--color-mushu-mute)] hover:text-[var(--color-mushu-ink)]"
            >
              Raya Studio
            </a>
            <div className="mt-6 inline-flex lg:justify-end">
              <LocaleToggle currentLocale={currentLocale} />
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-[var(--color-mushu-border-subtle)] pt-6 text-xs text-[var(--color-mushu-faint)] sm:flex-row sm:items-center sm:justify-between">
          <p>{t('copyright')}</p>
          <p>{t('strip')}</p>
        </div>
      </div>
    </footer>
  );
}

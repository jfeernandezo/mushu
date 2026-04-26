import { Github } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import Link from 'next/link';

export async function HeroSection() {
  const t = await getTranslations('landing.hero');

  return (
    <section className="relative isolate min-h-[calc(100vh-4rem)] overflow-hidden">
      <Image
        src="/landing/hero-bg.webp"
        alt=""
        width={2400}
        height={1400}
        priority
        className="absolute inset-0 -z-20 h-full w-full object-cover"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-[var(--color-mushu-bg)]/60 to-[var(--color-mushu-bg)]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(65%_55%_at_50%_0%,transparent,var(--color-mushu-bg)_78%)]" />

      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center px-4 py-16 sm:px-6 lg:px-16 lg:py-24">
        <div className="max-w-3xl pt-12">
          <p className="mb-6 border-l border-[var(--color-mushu-scarlet)] pl-3 font-mono text-xs font-medium uppercase tracking-wider text-[var(--color-mushu-scarlet)]">
            {t('eyebrow')}
          </p>
          <h1 className="max-w-4xl text-5xl font-semibold tracking-tight text-[var(--color-mushu-ink)] sm:text-6xl lg:text-7xl">
            {t('titleLine1')}
            <span className="block text-[var(--color-mushu-scarlet)]">{t('titleLine2')}</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-[var(--color-mushu-mute)] sm:text-lg">
            {t('subtitle')}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-md bg-gradient-to-b from-[var(--color-mushu-scarlet)] to-[var(--color-mushu-scarlet-soft)] px-6 py-3 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_8px_24px_-8px_rgba(199,62,29,0.5)] transition hover:brightness-110"
            >
              {t('ctaPrimary')}
            </Link>
            <a
              href="https://github.com/jfeernandezo/mushu"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--color-mushu-border)] bg-[color-mix(in_srgb,var(--color-mushu-surface)_70%,transparent)] px-6 py-3 text-sm font-semibold text-[var(--color-mushu-ink)] backdrop-blur-md transition hover:bg-[var(--color-mushu-surface-hover)]"
            >
              <Github className="h-4 w-4" />
              {t('ctaSecondary')}
            </a>
          </div>
          <p className="mt-5 max-w-2xl text-xs leading-6 text-[var(--color-mushu-faint)]">
            {t('preAlphaNote')}
          </p>
        </div>
      </div>
    </section>
  );
}

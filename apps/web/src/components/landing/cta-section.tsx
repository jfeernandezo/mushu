import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import Link from 'next/link';

export async function CtaSection() {
  const t = await getTranslations('landing.cta');

  return (
    <section className="relative isolate overflow-hidden border-t border-[var(--color-mushu-border-subtle)] px-4 py-20 sm:px-6 lg:px-16 lg:py-28">
      <Image
        src="/landing/cta-bg.webp"
        alt=""
        width={2400}
        height={900}
        className="absolute inset-0 -z-20 h-full w-full object-cover"
      />
      <div className="absolute inset-0 -z-10 bg-[var(--color-mushu-bg)]/55" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[var(--color-mushu-bg)] via-transparent to-[var(--color-mushu-bg)]" />
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">{t('title')}</h2>
        <p className="mt-4 text-base leading-7 text-[var(--color-mushu-mute)] sm:text-lg">{t('subtitle')}</p>
        <Link
          href="/login"
          className="mt-8 inline-flex items-center justify-center rounded-md bg-gradient-to-b from-[var(--color-mushu-scarlet)] to-[var(--color-mushu-scarlet-soft)] px-6 py-3 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_8px_24px_-8px_rgba(199,62,29,0.5)] transition hover:brightness-110"
        >
          {t('button')}
        </Link>
      </div>
    </section>
  );
}

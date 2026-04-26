import { Check, Mail } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export async function PricingSection() {
  const t = await getTranslations('landing.ways');
  const selfHostFeatures = t.raw('selfHost.features') as string[];
  const hostedFeatures = t.raw('hosted.features') as string[];

  return (
    <section className="border-t border-[var(--color-mushu-border-subtle)] px-4 py-16 sm:px-6 lg:px-16 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <p className="mb-4 border-l border-[var(--color-mushu-scarlet)] pl-3 font-mono text-xs font-medium uppercase tracking-wider text-[var(--color-mushu-scarlet)]">
          {t('eyebrow')}
        </p>
        <h2 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">{t('title')}</h2>

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          <article className="rounded-lg border border-[var(--color-mushu-scarlet)] bg-[var(--color-mushu-surface)] p-6 shadow-[0_24px_80px_-48px_rgba(199,62,29,0.8)]">
            <h3 className="text-xl font-semibold tracking-tight">{t('selfHost.title')}</h3>
            <p className="mt-5 text-5xl font-semibold tracking-tight text-[var(--color-mushu-scarlet)]">{t('selfHost.price')}</p>
            <ul className="mt-8 space-y-3">
              {selfHostFeatures.map((feature) => (
                <li key={feature} className="flex gap-3 text-sm leading-6 text-[var(--color-mushu-mute)]">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-[var(--color-mushu-amber)]" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <a
              href="https://github.com/jfeernandezo/mushu/blob/main/docs/SELF_HOSTING.md"
              target="_blank"
              rel="noopener"
              className="mt-8 inline-flex w-full items-center justify-center rounded-md bg-gradient-to-b from-[var(--color-mushu-scarlet)] to-[var(--color-mushu-scarlet-soft)] px-5 py-3 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_8px_24px_-8px_rgba(199,62,29,0.5)] transition hover:brightness-110"
            >
              {t('selfHost.cta')}
            </a>
          </article>

          <article className="rounded-lg border border-[var(--color-mushu-border)] bg-[color-mix(in_srgb,var(--color-mushu-surface)_70%,transparent)] p-6 backdrop-blur-md">
            <h3 className="text-xl font-semibold tracking-tight">{t('hosted.title')}</h3>
            <div className="mt-5 flex flex-wrap items-end gap-x-3 gap-y-2">
              <p className="text-5xl font-semibold tracking-tight">{t('hosted.price')}</p>
              <p className="pb-1 text-xs leading-5 text-[var(--color-mushu-faint)]">{t('hosted.priceNote')}</p>
            </div>
            <ul className="mt-8 space-y-3">
              {hostedFeatures.map((feature) => (
                <li key={feature} className="flex gap-3 text-sm leading-6 text-[var(--color-mushu-mute)]">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-[var(--color-mushu-amber)]" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <a
              href="mailto:adm@rayastudio.com.br?subject=Mushu%20hosted%20waitlist"
              className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-md border border-[var(--color-mushu-border)] px-5 py-3 text-sm font-semibold text-[var(--color-mushu-ink)] transition hover:bg-[var(--color-mushu-surface-hover)]"
            >
              <Mail className="h-4 w-4" />
              {t('hosted.cta')}
            </a>
          </article>
        </div>
      </div>
    </section>
  );
}

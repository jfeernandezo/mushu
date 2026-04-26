import { getTranslations } from 'next-intl/server';
import Image from 'next/image';

const featureCards = [
  {
    key: 'commentToDm',
    image: '/landing/feature-comment-dm.webp',
  },
  {
    key: 'leadCapture',
    image: '/landing/feature-lead-capture.webp',
  },
  {
    key: 'conditions',
    image: '/landing/feature-conditions.webp',
  },
  {
    key: 'templates',
    image: '/landing/feature-templates.webp',
  },
] as const;

export async function FeaturesSection() {
  const t = await getTranslations('landing.features');

  return (
    <section
      id="features"
      className="border-t border-[var(--color-mushu-border-subtle)] px-4 py-16 sm:px-6 lg:px-16 lg:py-24"
    >
      <div className="mx-auto max-w-6xl">
        <p className="mb-4 border-l border-[var(--color-mushu-scarlet)] pl-3 font-mono text-xs font-medium uppercase tracking-wider text-[var(--color-mushu-scarlet)]">
          {t('eyebrow')}
        </p>
        <div className="max-w-3xl">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">{t('title')}</h2>
          <p className="mt-4 text-base leading-7 text-[var(--color-mushu-mute)]">{t('subtitle')}</p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          {featureCards.map((card) => (
            <article
              key={card.key}
              className="overflow-hidden rounded-lg border border-[var(--color-mushu-border)] bg-[var(--color-mushu-surface)] transition hover:-translate-y-0.5 hover:bg-[var(--color-mushu-surface-hover)]"
            >
              <div className="aspect-[16/10] overflow-hidden border-b border-[var(--color-mushu-border-subtle)] bg-[var(--color-mushu-bg)]">
                <Image
                  src={card.image}
                  alt={t(`cards.${card.key}.alt`)}
                  width={1600}
                  height={1000}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-semibold tracking-tight">{t(`cards.${card.key}.title`)}</h3>
                <p className="mt-3 text-sm leading-6 text-[var(--color-mushu-mute)]">
                  {t.raw(`cards.${card.key}.body`) as string}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

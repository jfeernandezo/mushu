import { Braces, Github, GitBranch, Heart, Instagram, Sparkles } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

const cards = [
  { key: 'free', Icon: Heart },
  { key: 'instagram', Icon: Instagram },
  { key: 'builder', Icon: GitBranch },
  { key: 'logic', Icon: Braces },
  { key: 'openSource', Icon: Github },
  { key: 'makers', Icon: Sparkles },
] as const;

export async function BenefitsSection() {
  const t = await getTranslations('landing.benefits');

  return (
    <section className="border-t border-[var(--color-mushu-border-subtle)] px-4 py-16 sm:px-6 lg:px-16 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <p className="mb-4 border-l border-[var(--color-mushu-scarlet)] pl-3 font-mono text-xs font-medium uppercase tracking-wider text-[var(--color-mushu-scarlet)]">
          {t('eyebrow')}
        </p>
        <div className="max-w-3xl">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">{t('title')}</h2>
          <p className="mt-4 text-base leading-7 text-[var(--color-mushu-mute)]">{t('subtitle')}</p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cards.map(({ key, Icon }) => (
            <article
              key={key}
              className="rounded-lg border border-[var(--color-mushu-border)] bg-[radial-gradient(50%_75%_at_50%_0,color-mix(in_srgb,var(--color-mushu-scarlet)_9%,var(--color-mushu-surface)),var(--color-mushu-surface))] p-6 transition hover:-translate-y-0.5 hover:bg-[var(--color-mushu-surface-hover)]"
            >
              <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-md bg-gradient-to-b from-[color-mix(in_srgb,var(--color-mushu-scarlet)_24%,transparent)] to-[color-mix(in_srgb,var(--color-mushu-amber)_12%,transparent)] text-[var(--color-mushu-scarlet)]">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold tracking-tight">{t(`cards.${key}.title`)}</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--color-mushu-mute)]">{t(`cards.${key}.body`)}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

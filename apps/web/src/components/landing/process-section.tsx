import { LayoutTemplate, Plug, Rocket } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

const steps = [
  { key: 'connect', number: '01', Icon: Plug },
  { key: 'build', number: '02', Icon: LayoutTemplate },
  { key: 'publish', number: '03', Icon: Rocket },
] as const;

export async function ProcessSection() {
  const t = await getTranslations('landing.process');

  return (
    <section
      id="process"
      className="border-t border-[var(--color-mushu-border-subtle)] px-4 py-16 sm:px-6 lg:px-16 lg:py-24"
    >
      <div className="mx-auto max-w-6xl">
        <p className="mb-4 border-l border-[var(--color-mushu-scarlet)] pl-3 font-mono text-xs font-medium uppercase tracking-wider text-[var(--color-mushu-scarlet)]">
          {t('eyebrow')}
        </p>
        <h2 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">{t('title')}</h2>

        <div className="relative mt-12 grid gap-5 lg:grid-cols-3">
          <div className="absolute left-[16.5%] right-[16.5%] top-10 hidden h-px bg-[var(--color-mushu-border-subtle)] lg:block" />
          {steps.map(({ key, number, Icon }) => (
            <article
              key={key}
              className="relative rounded-lg border border-[var(--color-mushu-border)] bg-[color-mix(in_srgb,var(--color-mushu-surface)_72%,transparent)] p-6 backdrop-blur-md"
            >
              <div className="mb-6 flex items-center justify-between">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[var(--color-mushu-scarlet)] bg-[var(--color-mushu-bg)] font-mono text-sm font-semibold text-[var(--color-mushu-scarlet)]">
                  {number}
                </span>
                <Icon className="h-5 w-5 text-[var(--color-mushu-amber)]" />
              </div>
              <h3 className="text-lg font-semibold tracking-tight">{t(`steps.${key}.title`)}</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--color-mushu-mute)]">{t(`steps.${key}.body`)}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

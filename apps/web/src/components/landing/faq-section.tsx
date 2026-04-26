import { getTranslations } from 'next-intl/server';

const items = ['preAlpha', 'hosted', 'channels', 'metaApi', 'migration', 'data'] as const;

export async function FaqSection() {
  const t = await getTranslations('landing.faq');

  return (
    <section
      id="faq"
      className="border-t border-[var(--color-mushu-border-subtle)] px-4 py-16 sm:px-6 lg:px-16 lg:py-24"
    >
      <div className="mx-auto max-w-6xl">
        <p className="mb-4 border-l border-[var(--color-mushu-scarlet)] pl-3 font-mono text-xs font-medium uppercase tracking-wider text-[var(--color-mushu-scarlet)]">
          {t('eyebrow')}
        </p>
        <h2 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">{t('title')}</h2>

        <div className="mt-12 grid gap-4 lg:grid-cols-2">
          {items.map((item) => (
            <details
              key={item}
              className="group rounded-lg border border-[var(--color-mushu-border)] bg-[var(--color-mushu-surface)] p-5 open:bg-[var(--color-mushu-surface-hover)]"
            >
              <summary className="cursor-pointer list-none text-base font-semibold tracking-tight marker:hidden">
                <span className="flex items-start justify-between gap-4">
                  {t(`items.${item}.q`)}
                  <span className="mt-1 text-[var(--color-mushu-scarlet)] transition group-open:rotate-45">+</span>
                </span>
              </summary>
              <p className="mt-4 text-sm leading-6 text-[var(--color-mushu-mute)]">{t(`items.${item}.a`)}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

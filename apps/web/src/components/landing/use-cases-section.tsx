import { MessagesSquare, Store, UsersRound } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

const useCases = [
  { key: 'launches', Icon: Store },
  { key: 'creators', Icon: MessagesSquare },
  { key: 'agencies', Icon: UsersRound },
] as const;

export async function UseCasesSection() {
  const t = await getTranslations('landing.useCases');

  return (
    <section
      id="use-cases"
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

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {useCases.map(({ key, Icon }) => (
            <article key={key} className="rounded-lg border border-[var(--color-mushu-border)] bg-[var(--color-mushu-surface)] p-6">
              <Icon className="mb-5 h-6 w-6 text-[var(--color-mushu-amber)]" />
              <h3 className="text-lg font-semibold tracking-tight">{t(`cards.${key}.title`)}</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--color-mushu-mute)]">{t(`cards.${key}.body`)}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

import { Check } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { listPublicPlans, type PublicPlan } from '@/actions/billing';
import { isHosted } from '@/lib/mode';

/**
 * Landing pricing block. Two modes:
 *   - hosted: 3 real plan cards (Free / Pro / Agency) + small self-host link
 *   - selfhost: legacy two-card layout (self-host details + hosted-waitlist
 *     pointer to the upstream service)
 */
export async function PricingSection() {
  if (isHosted()) {
    const plans = await listPublicPlans();
    return <HostedPricing plans={plans} />;
  }
  return <SelfHostPricing />;
}

async function HostedPricing({ plans }: { plans: PublicPlan[] }) {
  const t = await getTranslations('landing.ways');
  const tp = await getTranslations('pricing');

  return (
    <section className="border-t border-[var(--color-mushu-border-subtle)] px-4 py-16 sm:px-6 lg:px-16 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <p className="mb-4 border-l border-[var(--color-mushu-scarlet)] pl-3 font-mono text-xs font-medium uppercase tracking-wider text-[var(--color-mushu-scarlet)]">
          {t('eyebrow')}
        </p>
        <h2 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
          {t('title')}
        </h2>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {plans.map((p) => {
            const isFeatured = p.code === 'pro';
            return (
              <article
                key={p.code}
                className={
                  isFeatured
                    ? 'rounded-lg border border-[var(--color-mushu-scarlet)] bg-[var(--color-mushu-surface)] p-6 shadow-[0_24px_80px_-48px_rgba(199,62,29,0.8)]'
                    : 'rounded-lg border border-[var(--color-mushu-border)] bg-[color-mix(in_srgb,var(--color-mushu-surface)_70%,transparent)] p-6 backdrop-blur-md'
                }
              >
                <h3 className="text-xl font-semibold tracking-tight">{p.name}</h3>
                <div className="mt-5">
                  {p.priceBrlCents > 0 ? (
                    <>
                      <span
                        className={
                          isFeatured
                            ? 'text-5xl font-semibold tracking-tight text-[var(--color-mushu-scarlet)]'
                            : 'text-5xl font-semibold tracking-tight'
                        }
                      >
                        R$ {(p.priceBrlCents / 100).toFixed(0)}
                      </span>
                      <span className="ml-1 text-sm text-[var(--color-mushu-mute)]">
                        /{tp('perMonth')}
                      </span>
                    </>
                  ) : (
                    <span className="text-5xl font-semibold tracking-tight">{tp('free')}</span>
                  )}
                </div>
                <ul className="mt-8 space-y-3 text-sm text-[var(--color-mushu-mute)]">
                  <li className="flex gap-3">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-[var(--color-mushu-amber)]" />
                    <span>{tp('limits.contacts', { n: p.maxContacts.toLocaleString('pt-BR') })}</span>
                  </li>
                  <li className="flex gap-3">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-[var(--color-mushu-amber)]" />
                    <span>{tp('limits.igAccounts', { n: p.maxIgAccounts })}</span>
                  </li>
                  <li className="flex gap-3">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-[var(--color-mushu-amber)]" />
                    <span>{tp('limits.operators', { n: p.maxOperators })}</span>
                  </li>
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-3">
                      <Check className="mt-1 h-4 w-4 shrink-0 text-[var(--color-mushu-amber)]" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={p.purchasable ? `/signup?plan=${p.code}` : '/signup'}
                  className={
                    isFeatured
                      ? 'mt-8 inline-flex w-full items-center justify-center rounded-md bg-gradient-to-b from-[var(--color-mushu-scarlet)] to-[var(--color-mushu-scarlet-soft)] px-5 py-3 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_8px_24px_-8px_rgba(199,62,29,0.5)] transition hover:brightness-110'
                      : 'mt-8 inline-flex w-full items-center justify-center rounded-md border border-[var(--color-mushu-border)] px-5 py-3 text-sm font-semibold text-[var(--color-mushu-ink)] transition hover:bg-[var(--color-mushu-surface-hover)]'
                  }
                >
                  {p.purchasable ? tp('cta.upgrade') : tp('cta.start')}
                </Link>
              </article>
            );
          })}
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 text-sm text-[var(--color-mushu-mute)]">
          <span>{tp('selfhost.title')}</span>
          <a
            href="https://github.com/jfeernandezo/mushu"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[var(--color-mushu-ink)] underline underline-offset-2 hover:text-[var(--color-mushu-scarlet)]"
          >
            {tp('selfhost.cta')} →
          </a>
        </div>
      </div>
    </section>
  );
}

async function SelfHostPricing() {
  const t = await getTranslations('landing.ways');
  const selfHostFeatures = t.raw('selfHost.features') as string[];

  return (
    <section className="border-t border-[var(--color-mushu-border-subtle)] px-4 py-16 sm:px-6 lg:px-16 lg:py-24">
      <div className="mx-auto max-w-3xl">
        <p className="mb-4 border-l border-[var(--color-mushu-scarlet)] pl-3 font-mono text-xs font-medium uppercase tracking-wider text-[var(--color-mushu-scarlet)]">
          {t('eyebrow')}
        </p>
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
          {t('title')}
        </h2>

        <article className="mt-12 rounded-lg border border-[var(--color-mushu-scarlet)] bg-[var(--color-mushu-surface)] p-6 shadow-[0_24px_80px_-48px_rgba(199,62,29,0.8)]">
          <h3 className="text-xl font-semibold tracking-tight">{t('selfHost.title')}</h3>
          <p className="mt-5 text-5xl font-semibold tracking-tight text-[var(--color-mushu-scarlet)]">
            {t('selfHost.price')}
          </p>
          <ul className="mt-8 space-y-3">
            {selfHostFeatures.map((feature) => (
              <li
                key={feature}
                className="flex gap-3 text-sm leading-6 text-[var(--color-mushu-mute)]"
              >
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

        <p className="mt-6 text-center text-sm text-[var(--color-mushu-mute)]">
          {t('hostedNote')}{' '}
          <a
            href="https://mushu.rayastudio.com.br"
            target="_blank"
            rel="noopener"
            className="font-medium text-[var(--color-mushu-ink)] underline underline-offset-2 hover:text-[var(--color-mushu-scarlet)]"
          >
            mushu.rayastudio.com.br
          </a>
        </p>
      </div>
    </section>
  );
}

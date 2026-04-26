import { Check } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { listPublicPlans } from '@/actions/billing';
import { LandingFooter } from '@/components/landing/landing-footer';
import { LandingNav } from '@/components/landing/landing-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { resolveLocale } from '@/i18n/get-locale';
import { isHosted } from '@/lib/mode';

/**
 * Public pricing page. Self-hosted instances 404 this — they don't sell
 * anything. Hosted instances render plan cards with checkout buttons.
 */
export default async function PricingPage() {
  if (!isHosted()) notFound();

  const t = await getTranslations('pricing');
  const plans = await listPublicPlans();
  const locale = await resolveLocale();

  return (
    <div className="flex min-h-screen flex-col">
      <LandingNav currentLocale={locale} />

      <main className="flex flex-1 flex-col items-center px-6 py-16 sm:py-24">
        <div className="mx-auto w-full max-w-5xl">
          <header className="mb-12 text-center">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{t('title')}</h1>
            <p className="mt-3 text-base text-[var(--color-mushu-mute)] sm:text-lg">
              {t('subtitle')}
            </p>
          </header>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {plans.map((p) => (
              <Card
                key={p.code}
                className={
                  p.code === 'pro'
                    ? 'border-[var(--color-mushu-scarlet)]/40 shadow-[0_0_40px_rgba(255,0,0,0.05)]'
                    : ''
                }
              >
                <CardHeader>
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  <div className="mt-2">
                    {p.priceBrlCents > 0 ? (
                      <>
                        <span className="text-3xl font-semibold">
                          R$ {(p.priceBrlCents / 100).toFixed(0)}
                        </span>
                        <span className="text-sm text-[var(--color-mushu-mute)]">
                          /{t('perMonth')}
                        </span>
                      </>
                    ) : (
                      <span className="text-3xl font-semibold">{t('free')}</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <ul className="flex flex-col gap-1.5 text-sm">
                    <li className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-mushu-amber)]" />
                      <span>{t('limits.contacts', { n: p.maxContacts.toLocaleString('pt-BR') })}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-mushu-amber)]" />
                      <span>{t('limits.igAccounts', { n: p.maxIgAccounts })}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-mushu-amber)]" />
                      <span>{t('limits.operators', { n: p.maxOperators })}</span>
                    </li>
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-mushu-amber)]" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  {p.purchasable ? (
                    <Button asChild className="w-full">
                      <Link href={`/signup?plan=${p.code}`}>{t('cta.upgrade')}</Link>
                    </Button>
                  ) : (
                    <Button asChild variant="outline" className="w-full">
                      <Link href="/signup">{t('cta.start')}</Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="mt-8 border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <h3 className="text-base font-medium">{t('selfhost.title')}</h3>
              <p className="max-w-xl text-sm text-[var(--color-mushu-mute)]">
                {t('selfhost.body')}
              </p>
              <Button asChild variant="ghost">
                <a
                  href="https://github.com/jfeernandezo/mushu"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('selfhost.cta')}
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}

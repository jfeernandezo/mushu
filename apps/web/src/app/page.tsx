import { getLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { BenefitsSection } from '@/components/landing/benefits-section';
import { CtaSection } from '@/components/landing/cta-section';
import { FaqSection } from '@/components/landing/faq-section';
import { FeaturesSection } from '@/components/landing/features-section';
import { HeroSection } from '@/components/landing/hero-section';
import { LandingFooter } from '@/components/landing/landing-footer';
import { LandingNav } from '@/components/landing/landing-nav';
import { PricingSection } from '@/components/landing/pricing-section';
import { ProcessSection } from '@/components/landing/process-section';
import { UseCasesSection } from '@/components/landing/use-cases-section';
import { isLocale } from '@/i18n/config';
import { auth } from '@/lib/auth';

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect('/dashboard');

  const locale = await getLocale();
  const currentLocale = isLocale(locale) ? locale : 'pt-BR';

  return (
    <main className="min-h-screen overflow-x-hidden bg-[var(--color-mushu-bg)] text-[var(--color-mushu-ink)]">
      <LandingNav currentLocale={currentLocale} />
      <HeroSection />
      <BenefitsSection />
      <FeaturesSection />
      <ProcessSection />
      <UseCasesSection />
      <PricingSection />
      <FaqSection />
      <CtaSection />
      <LandingFooter />
    </main>
  );
}

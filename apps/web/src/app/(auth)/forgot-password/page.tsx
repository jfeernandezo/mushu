import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import Link from 'next/link';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { LegalLinks } from '@/components/legal-links';

export default async function ForgotPasswordPage() {
  const t = await getTranslations('auth.forgotPassword');
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="text-center">
          <Image
            src="/mushu-logo.png"
            alt="Mushu"
            width={56}
            height={56}
            priority
            className="mx-auto mb-2 rounded-xl"
          />
          <h1 className="text-xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-[var(--color-mushu-mute)]">{t('subtitle')}</p>
        </div>
        <ForgotPasswordForm />
        <p className="text-center text-xs text-[var(--color-mushu-faint)]">
          {t('rememberedIt')}{' '}
          <Link href="/login" className="text-[var(--color-mushu-amber)] hover:underline">
            {t('backToLogin')}
          </Link>
        </p>
        <LegalLinks className="mt-2" />
      </div>
    </main>
  );
}

import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import Link from 'next/link';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { LegalLinks } from '@/components/legal-links';

interface ResetPasswordPageProps {
  searchParams: Promise<{ token?: string; error?: string }>;
}

/**
 * Landing for the link in the password-reset email.
 *
 * Better Auth sends links of the form `${baseURL}/reset-password?token=...`
 * (the URL we set in `redirectTo` from the forgot-password form). If the
 * token is missing or already-consumed, Better Auth may instead redirect
 * here with `?error=invalid_token` — show a friendly retry pointer.
 */
export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { token, error } = await searchParams;
  const t = await getTranslations('auth.resetPassword');

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

        {!token || error ? (
          <div className="flex flex-col gap-3 rounded-md border border-[var(--color-mushu-border)] bg-[var(--color-mushu-surface)] px-4 py-5 text-center">
            <p className="text-sm text-[var(--color-mushu-ink)]">
              {error === 'invalid_token' ? t('invalidToken') : t('missingToken')}
            </p>
            <Link
              href="/forgot-password"
              className="text-sm text-[var(--color-mushu-amber)] hover:underline"
            >
              {t('requestNew')}
            </Link>
          </div>
        ) : (
          <ResetPasswordForm token={token} />
        )}

        <p className="text-center text-xs text-[var(--color-mushu-faint)]">
          <Link href="/login" className="text-[var(--color-mushu-amber)] hover:underline">
            {t('backToLogin')}
          </Link>
        </p>
        <LegalLinks className="mt-2" />
      </div>
    </main>
  );
}

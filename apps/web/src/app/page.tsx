import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { LegalLinks } from '@/components/legal-links';
import { auth } from '@/lib/auth';

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect('/dashboard');

  const t = await getTranslations('landing');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-20">
      <div className="max-w-2xl text-center">
        <Image
          src="/mushu-logo.png"
          alt="Mushu"
          width={96}
          height={96}
          priority
          className="mx-auto mb-4 rounded-2xl"
        />
        <h1 className="mb-4 text-5xl font-bold tracking-tight">Mushu</h1>
        <p className="mb-8 text-lg text-[var(--color-mushu-mute)]">{t('tagline')}</p>
        <div className="flex justify-center gap-3">
          <a
            href="/login"
            className="rounded-lg bg-[var(--color-mushu-scarlet)] px-6 py-3 font-medium text-white hover:bg-[var(--color-mushu-scarlet-soft)]"
          >
            {t('signIn')}
          </a>
          <a
            href="https://github.com/jfeernandezo/mushu"
            className="rounded-lg border border-[var(--color-mushu-border)] px-6 py-3 font-medium text-[var(--color-mushu-ink)] hover:bg-[var(--color-mushu-surface)]"
          >
            {t('github')}
          </a>
        </div>
        <p className="mt-12 text-xs text-[var(--color-mushu-faint)]">
          {t('preAlpha')}{' '}
          <a className="underline" href="https://rayastudio.com.br">
            Raya Studio
          </a>
          .
        </p>
        <LegalLinks className="mt-6" />
      </div>
    </main>
  );
}

import { headers } from 'next/headers';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { LegalLinks } from '@/components/legal-links';
import { auth } from '@/lib/auth';

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect('/dashboard');

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
        <p className="mb-8 text-lg text-zinc-600">
          Your loyal little dragon for Instagram automation. Open-source
          ManyChat alternative — self-hosted, free forever.
        </p>
        <div className="flex justify-center gap-3">
          <a
            href="/login"
            className="rounded-lg bg-[var(--color-mushu-red)] px-6 py-3 font-medium text-white hover:opacity-90"
          >
            Sign in
          </a>
          <a
            href="https://github.com/jfeernandezo/mushu"
            className="rounded-lg border border-zinc-300 px-6 py-3 font-medium hover:bg-zinc-100"
          >
            GitHub
          </a>
        </div>
        <p className="mt-12 text-xs text-zinc-400">
          Pre-alpha. Built by{' '}
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

import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { LEGAL } from '@/lib/legal';

// Read company identity from env at request time, not at build time.
// Otherwise placeholders get baked into the bundle and forks can't reconfigure.
export const dynamic = 'force-dynamic';

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-mushu-bg)] text-[var(--color-mushu-ink)]">
      <header className="border-b border-[var(--color-mushu-border)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/mushu-logo.png"
              alt="Mushu"
              width={28}
              height={28}
              className="rounded-md"
            />
            <span className="text-base font-semibold tracking-tight">Mushu</span>
          </Link>
          <nav className="flex gap-4 text-sm text-[var(--color-mushu-mute)]">
            <Link href="/privacy" className="hover:text-[var(--color-mushu-ink)]">
              Privacidade
            </Link>
            <Link href="/terms" className="hover:text-[var(--color-mushu-ink)]">
              Termos
            </Link>
            <Link href="/data-deletion" className="hover:text-[var(--color-mushu-ink)]">
              Exclusão de dados
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        {children}

        <p className="mt-16 border-t border-[var(--color-mushu-border)] pt-6 text-xs text-[var(--color-mushu-faint)]">
          Vigência a partir de {LEGAL.effectiveDate}.
        </p>
      </main>
    </div>
  );
}

import Link from 'next/link';
import { cn } from '@/lib/utils';

export function LegalLinks({ className }: { className?: string }) {
  return (
    <nav
      className={cn(
        'flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-[var(--color-mushu-faint)]',
        className,
      )}
    >
      <Link href="/privacy" className="hover:text-[var(--color-mushu-mute)]">
        Privacidade
      </Link>
      <span aria-hidden>·</span>
      <Link href="/terms" className="hover:text-[var(--color-mushu-mute)]">
        Termos
      </Link>
      <span aria-hidden>·</span>
      <Link href="/data-deletion" className="hover:text-[var(--color-mushu-mute)]">
        Exclusão de dados
      </Link>
    </nav>
  );
}

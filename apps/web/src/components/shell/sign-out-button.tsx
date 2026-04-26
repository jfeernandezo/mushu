'use client';

import { LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

export function SignOutButton({ className }: { className?: string }) {
  const t = useTranslations('userMenu');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      try {
        await authClient.signOut();
        toast.success(t('signedOut'));
        router.push('/');
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown_error';
        toast.error(t('couldNotSignOut', { error: msg }));
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={cn(
        'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
        'text-[var(--color-mushu-mute)] hover:bg-[var(--color-mushu-surface)] hover:text-[var(--color-mushu-ink)]',
        'disabled:opacity-50',
        className,
      )}
    >
      <LogOut className="h-4 w-4 shrink-0" />
      <span className="flex-1 text-left">{pending ? t('signingOut') : t('signOut')}</span>
    </button>
  );
}

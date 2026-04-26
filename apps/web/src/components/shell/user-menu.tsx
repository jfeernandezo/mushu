'use client';

import { LogOut, Settings as SettingsIcon, User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { authClient } from '@/lib/auth-client';

interface UserMenuProps {
  user?: { name: string | null | undefined; email: string };
}

export function UserMenu({ user }: UserMenuProps) {
  const t = useTranslations('userMenu');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSignOut() {
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

  const initials = user ? toInitials(user.name ?? user.email) : 'U';
  const display = user?.name?.trim() ? user.name : user?.email;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('openMenu')}
          className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mushu-amber)]"
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-[var(--color-mushu-scarlet)] text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {user ? (
          <>
            <DropdownMenuLabel className="flex flex-col gap-0.5 py-2">
              <span className="text-sm font-medium text-[var(--color-mushu-ink)]">
                {display}
              </span>
              {user.name?.trim() ? (
                <span className="text-xs text-[var(--color-mushu-faint)]">
                  {user.email}
                </span>
              ) : null}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        ) : null}

        <DropdownMenuItem asChild>
          <Link href="/settings/profile" onClick={() => setOpen(false)}>
            <User className="h-3.5 w-3.5" />
            <span>{t('profile')}</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings" onClick={() => setOpen(false)}>
            <SettingsIcon className="h-3.5 w-3.5" />
            <span>{t('settings')}</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          disabled={pending}
          onSelect={(e) => {
            e.preventDefault();
            onSignOut();
          }}
          className="text-[var(--color-mushu-danger)] focus:text-[var(--color-mushu-danger)]"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>{pending ? t('signingOut') : t('signOut')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function toInitials(s: string): string {
  const parts = s.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

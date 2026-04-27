'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { forwardRef, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * Password input with a show/hide toggle. Behaves like a regular `<Input>`
 * — accepts ref, all the standard InputHTMLAttributes — but renders an
 * eye button on the right that flips `type` between 'password' and 'text'.
 *
 * Use everywhere we collect a password: login, signup, change-password,
 * reset-password. The toggle resets to hidden whenever the component
 * unmounts (we don't persist visibility across navigations).
 */
export const PasswordInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>
>(function PasswordInput({ className, disabled, ...props }, ref) {
  const t = useTranslations('common.passwordInput');
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        ref={ref}
        disabled={disabled}
        className={cn(
          'flex h-9 w-full rounded-md border border-[var(--color-mushu-border)] bg-[var(--color-mushu-surface)] px-3 py-1 pr-10 text-sm text-[var(--color-mushu-ink)] placeholder:text-[var(--color-mushu-faint)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-mushu-amber)] disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        disabled={disabled}
        // tabIndex=-1: keep focus on the input when the user tabs through —
        // power users on a password manager don't want to land on the eye.
        tabIndex={-1}
        aria-label={visible ? t('hide') : t('show')}
        className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded text-[var(--color-mushu-mute)] transition-colors hover:text-[var(--color-mushu-ink)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});

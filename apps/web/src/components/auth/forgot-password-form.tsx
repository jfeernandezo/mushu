'use client';

import { CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/auth-client';

/**
 * Asks Better Auth to email a password-reset link. Better Auth's
 * `forgetPassword` writes a token to the `verification` table and triggers
 * our `sendResetPassword` hook (configured in lib/auth.ts → sends via
 * Hostinger SMTP).
 *
 * UX choice: we ALWAYS show the same success message, regardless of whether
 * the email actually exists in the database. This prevents email-enumeration
 * attacks (an attacker can't probe which addresses have accounts).
 */
export function ForgotPasswordForm() {
  const t = useTranslations('auth.forgotPassword');
  const tFields = useTranslations('auth.fields');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    // Don't surface result.error to the user — Better Auth returns the same
    // shape whether the email exists or not, but we don't even check. The
    // "if it exists, you'll get a link" message holds either way.
    await authClient.requestPasswordReset({
      email,
      redirectTo: '/reset-password',
    });
    setLoading(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-md border border-[var(--color-mushu-border)] bg-[var(--color-mushu-surface)] px-4 py-6 text-center">
        <CheckCircle2 className="h-8 w-8 text-[var(--color-mushu-amber)]" />
        <p className="text-sm text-[var(--color-mushu-ink)]">{t('sentTitle')}</p>
        <p className="text-xs text-[var(--color-mushu-mute)]">
          {t('sentBody', { email })}
        </p>
        <p className="text-[11px] text-[var(--color-mushu-faint)]">{t('sentHint')}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <Input
        type="email"
        autoComplete="email"
        required
        placeholder={tFields('emailPlaceholder')}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoFocus
      />
      <Button type="submit" disabled={loading || !email.trim()}>
        {loading ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}

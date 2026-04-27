'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { authClient } from '@/lib/auth-client';

interface ResetPasswordFormProps {
  token: string;
}

/**
 * Sets a new password using the token from the email link. Better Auth's
 * `resetPassword` validates the token (single-use, time-limited), updates
 * the password hash, and revokes any existing sessions for that user.
 *
 * On success: redirect to /login with a success toast — the user logs in
 * fresh with the new password (we intentionally don't auto-sign-in here so
 * they confirm the password works in their head before being trapped on a
 * dashboard with a password they may have just typo'd).
 */
export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const t = useTranslations('auth.resetPassword');
  const tFields = useTranslations('auth.fields');
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    if (newPassword !== confirmPassword) {
      setError(t('mismatch'));
      return;
    }
    setLoading(true);
    const r = await authClient.resetPassword({ newPassword, token });
    setLoading(false);
    if (r.error) {
      const msg = r.error.message ?? t('failed');
      setError(msg);
      toast.error(msg);
      return;
    }
    toast.success(t('success'));
    router.push('/login');
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <PasswordInput
        autoComplete="new-password"
        required
        minLength={8}
        placeholder={tFields('newPasswordPlaceholder')}
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        autoFocus
      />
      <PasswordInput
        autoComplete="new-password"
        required
        minLength={8}
        placeholder={tFields('confirmPasswordPlaceholder')}
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
      />
      {error ? <p className="text-xs text-[var(--color-mushu-danger)]">{error}</p> : null}
      <Button type="submit" disabled={loading || !newPassword || !confirmPassword}>
        {loading ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}

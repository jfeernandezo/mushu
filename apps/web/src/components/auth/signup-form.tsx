'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { recordSignupConsent } from '@/actions/consent';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { authClient } from '@/lib/auth-client';

export function SignupForm() {
  const t = useTranslations('auth.signup');
  const tFields = useTranslations('auth.fields');
  const tConsent = useTranslations('auth.consent');
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!accepted) {
      const msg = tConsent('mustAccept');
      setError(msg);
      toast.error(msg);
      return;
    }
    setLoading(true);
    const r = await authClient.signUp.email({ name, email, password });
    if (r.error) {
      setLoading(false);
      const msg = r.error.message ?? t('couldNotSignUp');
      setError(msg);
      toast.error(msg);
      return;
    }
    // Best-effort consent record. If it fails, we still let the user in — the
    // signup itself succeeded; the missing audit row is a recoverable issue
    // we surface in server logs (recordAudit logs internally).
    await recordSignupConsent();
    setLoading(false);
    toast.success(t('welcomeNew'));
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <Input
        type="text"
        autoComplete="name"
        required
        placeholder={tFields('namePlaceholder')}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Input
        type="email"
        autoComplete="email"
        required
        placeholder={tFields('emailPlaceholder')}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <PasswordInput
        autoComplete="new-password"
        required
        minLength={8}
        placeholder={tFields('passwordSignupPlaceholder')}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <label className="flex items-start gap-2 text-xs text-[var(--color-mushu-text-muted)]">
        <input
          type="checkbox"
          required
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          {tConsent('iAm18AndAcceptPrefix')}{' '}
          <Link href="/terms" target="_blank" className="underline">
            {tConsent('terms')}
          </Link>{' '}
          {tConsent('and')}{' '}
          <Link href="/privacy" target="_blank" className="underline">
            {tConsent('privacy')}
          </Link>
          .
        </span>
      </label>
      {error ? <p className="text-xs text-[var(--color-mushu-danger)]">{error}</p> : null}
      <Button type="submit" disabled={loading || !accepted}>
        {loading ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}

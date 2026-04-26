'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/auth-client';

export function SignupForm() {
  const t = useTranslations('auth.signup');
  const tFields = useTranslations('auth.fields');
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const r = await authClient.signUp.email({ name, email, password });
    setLoading(false);
    if (r.error) {
      const msg = r.error.message ?? t('couldNotSignUp');
      setError(msg);
      toast.error(msg);
      return;
    }
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
      <Input
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        placeholder={tFields('passwordSignupPlaceholder')}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error ? <p className="text-xs text-[var(--color-mushu-danger)]">{error}</p> : null}
      <Button type="submit" disabled={loading}>
        {loading ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}

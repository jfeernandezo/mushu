'use client';

import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { deleteAccount } from '@/actions/user';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface DeleteAccountDialogProps {
  email: string;
}

export function DeleteAccountDialog({ email }: DeleteAccountDialogProps) {
  const t = useTranslations('settings.danger');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const r = await deleteAccount({ confirmEmail, password });
    setLoading(false);
    if (r.ok) {
      toast.success(t('success'));
      router.push('/');
    } else if (r.error === 'email_mismatch') {
      toast.error(t('emailMismatch'));
    } else if (r.error === 'invalid_input') {
      toast.error(t('fillFields'));
    } else {
      toast.error(t('couldNotDelete', { error: r.error }));
    }
  }

  if (!open) {
    return (
      <Button variant="destructive" onClick={() => setOpen(true)} className="w-fit">
        <Trash2 className="h-4 w-4" />
        {t('openButton')}
      </Button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 rounded-md border border-[var(--color-mushu-danger)]/40 bg-[var(--color-mushu-surface)] p-4"
    >
      <div>
        <h3 className="text-sm font-medium text-[var(--color-mushu-ink)]">
          {t('confirmTitle')}
        </h3>
        <p className="mt-1 text-xs text-[var(--color-mushu-mute)]">
          {t('confirmBody', { email })}
        </p>
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-[var(--color-mushu-mute)]">{t('emailField')}</span>
        <Input
          type="email"
          required
          autoComplete="off"
          value={confirmEmail}
          placeholder={email}
          onChange={(e) => setConfirmEmail(e.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-[var(--color-mushu-mute)]">{t('passwordField')}</span>
        <Input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setConfirmEmail('');
            setPassword('');
          }}
          disabled={loading}
        >
          {t('cancel')}
        </Button>
        <Button type="submit" variant="destructive" disabled={loading}>
          {loading ? t('deleting') : t('delete')}
        </Button>
      </div>
    </form>
  );
}

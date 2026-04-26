'use client';

import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { updateProfile } from '@/actions/user';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ProfileFormProps {
  initialName: string;
  initialImage: string | null | undefined;
  email: string;
}

export function ProfileForm({ initialName, initialImage, email }: ProfileFormProps) {
  const t = useTranslations('settings.profile');
  const [name, setName] = useState(initialName);
  const [image, setImage] = useState(initialImage ?? '');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const r = await updateProfile({ name, image });
    setLoading(false);
    if (r.ok) {
      toast.success(t('updated'));
    } else {
      toast.error(t('couldNotUpdate', { error: r.error }));
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field label={t('name')}>
        <Input
          required
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>

      <Field label={t('email')} hint={t('emailHint')}>
        <Input value={email} disabled readOnly />
      </Field>

      <Field label={t('avatar')} hint={t('avatarHint')}>
        <Input
          type="url"
          placeholder="https://…"
          value={image}
          onChange={(e) => setImage(e.target.value)}
        />
      </Field>

      <div className="flex justify-end">
        <Button type="submit" disabled={loading} className="w-fit">
          {loading ? t('saving') : t('save')}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-[var(--color-mushu-mute)]">{label}</span>
      {children}
      {hint ? (
        <span className="text-xs text-[var(--color-mushu-faint)]">{hint}</span>
      ) : null}
    </label>
  );
}

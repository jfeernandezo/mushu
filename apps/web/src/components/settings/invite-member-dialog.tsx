'use client';

import { UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { inviteMember } from '@/actions/members';
import { Button } from '@/components/ui/button';
import { ASSIGNABLE_ROLES, type AssignableRole } from '@/lib/member-roles';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export function InviteMemberDialog() {
  const t = useTranslations('settings.members.invite');
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AssignableRole>('editor');
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      const r = await inviteMember({ email, role });
      if (r.ok) {
        toast.success(t('sent', { email }));
        setEmail('');
        setOpen(false);
      } else if (r.error === 'already_member') {
        toast.error(t('alreadyMember'));
      } else if (r.error === 'smtp_not_configured') {
        toast.error(t('smtpNotConfigured'));
      } else if (r.error === 'invalid_input') {
        toast.error(t('invalidEmail'));
      } else {
        toast.error(t('failed', { error: r.error }));
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="h-4 w-4" />
          {t('button')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-[var(--color-mushu-mute)]">{t('emailLabel')}</span>
            <Input
              type="email"
              required
              autoComplete="off"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="pessoa@empresa.com"
              disabled={pending}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-[var(--color-mushu-mute)]">{t('roleLabel')}</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as AssignableRole)}
              disabled={pending}
              className="rounded-md border border-[var(--color-mushu-border)] bg-[var(--color-mushu-bg)] px-3 py-2 text-sm text-[var(--color-mushu-ink)]"
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`roleOption.${r}`)}
                </option>
              ))}
            </select>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={pending || !email.trim()}>
              {pending ? t('sending') : t('send')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

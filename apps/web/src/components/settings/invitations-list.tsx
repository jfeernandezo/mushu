'use client';

import { Mail, X } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { cancelInvitation, type PendingInvitation } from '@/actions/members';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmAlertDialog } from '@/components/ui/confirm-alert-dialog';

interface InvitationsListProps {
  invitations: PendingInvitation[];
  canCancel: boolean;
}

export function InvitationsList({ invitations, canCancel }: InvitationsListProps) {
  const t = useTranslations('settings.members');
  const formatter = useFormatter();
  const [pending, setPending] = useState<string | null>(null);

  async function onCancel(id: string) {
    setPending(id);
    try {
      const r = await cancelInvitation(id);
      if (r.ok) {
        toast.success(t('invitationCancelled'));
      } else {
        toast.error(t('cancelFailed', { error: r.error }));
        throw new Error(r.error);
      }
    } finally {
      setPending(null);
    }
  }

  return (
    <ul className="flex flex-col gap-2">
      {invitations.map((inv) => (
        <li
          key={inv.id}
          className="flex items-center gap-3 rounded-md border border-[var(--color-mushu-border)] bg-[var(--color-mushu-surface)] px-3 py-2.5"
        >
          <Mail className="h-4 w-4 shrink-0 text-[var(--color-mushu-mute)]" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="truncate text-sm text-[var(--color-mushu-ink)]">{inv.email}</p>
            <p className="truncate text-xs text-[var(--color-mushu-faint)]">
              {t('expiresAt', {
                date: formatter.dateTime(inv.expiresAt, { dateStyle: 'short' }),
              })}
            </p>
          </div>
          {inv.role ? (
            <Badge variant="outline" className="shrink-0">
              {t(`roleLabel.${inv.role}`)}
            </Badge>
          ) : null}
          {canCancel ? (
            <ConfirmAlertDialog
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending === inv.id}
                  aria-label={t('cancelInvitationAriaLabel', { email: inv.email })}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              }
              title={t('cancelInvitationTitle')}
              description={t('cancelInvitationConfirm', { email: inv.email })}
              confirmLabel={t('cancelInvitation')}
              pendingLabel={t('cancelling')}
              cancelLabel={t('keepInvitation')}
              onConfirm={() => onCancel(inv.id)}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

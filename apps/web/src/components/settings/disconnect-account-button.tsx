'use client';

import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { disconnectAccount } from '@/actions/connected-accounts';
import { Button } from '@/components/ui/button';
import { ConfirmAlertDialog } from '@/components/ui/confirm-alert-dialog';
import { Tooltip } from '@/components/ui/tooltip';

interface DisconnectAccountButtonProps {
  accountId: string;
  username: string;
  channel: 'instagram' | 'threads';
}

/**
 * Confirm-then-disconnect button. Wraps the standard ConfirmAlertDialog so
 * the destructive UX matches the rest of the app (sessions, members,
 * invitations all use the same pattern).
 */
export function DisconnectAccountButton({
  accountId,
  username,
  channel,
}: DisconnectAccountButtonProps) {
  const t = useTranslations('settings.workspace');
  const label = channel === 'threads' ? 'Threads' : 'Instagram';

  async function onConfirm() {
    const r = await disconnectAccount({ accountId });
    if (r.ok) {
      toast.success(t('disconnected', { username }));
    } else {
      toast.error(t('disconnectFailed', { error: r.error }));
      throw new Error(r.error);
    }
  }

  return (
    <ConfirmAlertDialog
      trigger={
        <Tooltip content={t('disconnectAriaLabel', { label, username })}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={t('disconnectAriaLabel', { label, username })}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </Tooltip>
      }
      title={t('disconnectTitle', { label })}
      description={t('disconnectConfirm', { label, username })}
      confirmLabel={t('disconnect')}
      pendingLabel={t('disconnecting')}
      cancelLabel={t('disconnectCancel')}
      onConfirm={onConfirm}
    />
  );
}

'use client';

import { Crown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { transferOwnership } from '@/actions/members';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface TransferTarget {
  memberId: string;
  name: string;
  email: string;
  role: string;
}

interface TransferOwnershipDialogProps {
  ownerEmail: string;
  eligibleTargets: TransferTarget[];
}

/**
 * Two-step ownership transfer modal: pick a target → confirm by re-typing
 * the current owner's email. Mirrors the destroy-account-dialog pattern so
 * the destructive intent is unambiguous.
 *
 * After success, the page reloads — the current user is no longer owner and
 * the UI must re-render without this card.
 */
export function TransferOwnershipDialog({
  ownerEmail,
  eligibleTargets,
}: TransferOwnershipDialogProps) {
  const t = useTranslations('settings.transferOwnership');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [targetMemberId, setTargetMemberId] = useState<string>('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    const r = await transferOwnership({ targetMemberId, confirmEmail });
    setLoading(false);
    if (r.ok) {
      toast.success(t('success'));
      setOpen(false);
      setConfirmEmail('');
      setTargetMemberId('');
      router.refresh();
      return;
    }
    if (r.error === 'email_mismatch') {
      toast.error(t('emailMismatch'));
      return;
    }
    if (r.error === 'invalid_input') {
      toast.error(t('fillFields'));
      return;
    }
    toast.error(t('failed', { error: r.error }));
  }

  if (eligibleTargets.length === 0) {
    return (
      <p className="text-xs text-[var(--color-mushu-mute)]">{t('noEligibleTargets')}</p>
    );
  }

  if (!open) {
    return (
      <Button variant="destructive" onClick={() => setOpen(true)} className="w-fit">
        <Crown className="h-4 w-4" />
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
        <p className="mt-1 text-xs text-[var(--color-mushu-mute)]">{t('confirmBody')}</p>
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-[var(--color-mushu-mute)]">{t('targetField')}</span>
        <select
          required
          value={targetMemberId}
          onChange={(e) => setTargetMemberId(e.target.value)}
          className="h-9 rounded-md border border-[var(--color-mushu-border)] bg-[var(--color-mushu-bg)] px-3 text-sm text-[var(--color-mushu-ink)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-mushu-amber)]"
        >
          <option value="" disabled>
            {t('targetPlaceholder')}
          </option>
          {eligibleTargets.map((target) => (
            <option key={target.memberId} value={target.memberId}>
              {target.name} ({target.email}) — {target.role}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-[var(--color-mushu-mute)]">
          {t('emailField', { email: ownerEmail })}
        </span>
        <Input
          type="email"
          required
          autoComplete="off"
          value={confirmEmail}
          placeholder={ownerEmail}
          onChange={(e) => setConfirmEmail(e.target.value)}
        />
      </label>

      <p className="text-xs text-[var(--color-mushu-danger)]">{t('warning')}</p>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setConfirmEmail('');
            setTargetMemberId('');
          }}
          disabled={loading}
        >
          {t('cancel')}
        </Button>
        <Button
          type="submit"
          variant="destructive"
          disabled={loading || !targetMemberId || !confirmEmail}
        >
          {loading ? t('transferring') : t('transfer')}
        </Button>
      </div>
    </form>
  );
}

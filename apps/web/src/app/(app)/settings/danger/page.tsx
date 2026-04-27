import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getOwnershipTransferContext } from '@/actions/members';
import { DeleteAccountDialog } from '@/components/settings/delete-account-dialog';
import { TransferOwnershipDialog } from '@/components/settings/transfer-ownership-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { auth } from '@/lib/auth';

export default async function DangerSettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  const t = await getTranslations('settings.danger');
  const tTransfer = await getTranslations('settings.transferOwnership');
  const ownershipCtx = await getOwnershipTransferContext();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-[var(--color-mushu-mute)]">{t('subtitle')}</p>
      </div>

      {ownershipCtx.isOwner ? (
        <Card className="border-[var(--color-mushu-danger)]/40">
          <CardHeader>
            <CardTitle className="text-sm text-[var(--color-mushu-danger)]">
              {tTransfer('cardTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-[var(--color-mushu-mute)]">
              {tTransfer('cardDescription')}
            </p>
            <TransferOwnershipDialog
              ownerEmail={ownershipCtx.ownerEmail}
              eligibleTargets={ownershipCtx.eligibleTargets}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-[var(--color-mushu-danger)]/40">
        <CardHeader>
          <CardTitle className="text-sm text-[var(--color-mushu-danger)]">
            {t('card')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-[var(--color-mushu-mute)]">
            {t.rich('explanation', {
              dataDeletionLink: (chunks) => (
                <Link
                  href="/data-deletion"
                  className="text-[var(--color-mushu-amber)] hover:underline"
                >
                  {chunks}
                </Link>
              ),
            })}
          </p>
          <DeleteAccountDialog email={session.user.email} />
        </CardContent>
      </Card>
    </div>
  );
}

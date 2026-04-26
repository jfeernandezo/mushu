import { getFormatter, getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { canManageBilling, getMySubscription, listPublicPlans } from '@/actions/billing';
import { BillingActions } from '@/components/settings/billing-actions';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { auth } from '@/lib/auth';
import { isHosted } from '@/lib/mode';

export default async function BillingSettingsPage() {
  if (!isHosted()) notFound();

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  const t = await getTranslations('settings.billing');
  const formatter = await getFormatter();

  const [subResult, plans, canManage] = await Promise.all([
    getMySubscription(),
    listPublicPlans(),
    canManageBilling(),
  ]);

  if (!subResult.ok) {
    return (
      <div className="flex max-w-2xl flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <Card>
          <CardContent className="py-6 text-sm text-[var(--color-mushu-mute)]">
            {t('couldNotLoad', { error: subResult.error })}
          </CardContent>
        </Card>
      </div>
    );
  }

  const sub = subResult.data;
  const purchasablePlans = plans.filter(
    (p) => p.purchasable && p.code !== sub.planCode,
  );

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-[var(--color-mushu-mute)]">{t('subtitle')}</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-sm">{t('currentPlan')}</CardTitle>
          <Badge variant={sub.status === 'active' || sub.status === 'trialing' ? 'success' : 'outline'}>
            {t(`status.${sub.status}`)}
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-semibold">{sub.planName}</span>
            {sub.priceBrlCents > 0 ? (
              <span className="text-sm text-[var(--color-mushu-mute)]">
                R$ {(sub.priceBrlCents / 100).toFixed(0)} / {t('perMonth')}
              </span>
            ) : null}
          </div>

          {sub.cancelAtPeriodEnd && sub.currentPeriodEnd ? (
            <p className="text-xs text-[var(--color-mushu-amber)]">
              {t('cancelsOn', {
                date: formatter.dateTime(sub.currentPeriodEnd, { dateStyle: 'long' }),
              })}
            </p>
          ) : sub.currentPeriodEnd ? (
            <p className="text-xs text-[var(--color-mushu-faint)]">
              {t('renewsOn', {
                date: formatter.dateTime(sub.currentPeriodEnd, { dateStyle: 'long' }),
              })}
            </p>
          ) : null}

          {!canManage ? (
            <p className="text-xs text-[var(--color-mushu-faint)]">{t('readOnlyHint')}</p>
          ) : null}
        </CardContent>
      </Card>

      {canManage ? (
        <BillingActions
          currentPlanCode={sub.planCode}
          hasStripeCustomer={sub.hasStripeCustomer}
          plans={purchasablePlans}
        />
      ) : null}
    </div>
  );
}

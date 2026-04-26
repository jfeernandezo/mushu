'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import type { PublicPlan } from '@/actions/billing';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface BillingActionsProps {
  currentPlanCode: string;
  hasStripeCustomer: boolean;
  plans: PublicPlan[];
}

export function BillingActions({
  currentPlanCode,
  hasStripeCustomer,
  plans,
}: BillingActionsProps) {
  const t = useTranslations('settings.billing');
  const [pending, setPending] = useState<string | null>(null);

  async function startCheckout(planCode: string) {
    setPending(planCode);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ planCode }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(t('checkoutFailed', { error: body.error ?? res.status }));
        return;
      }
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } finally {
      setPending(null);
    }
  }

  async function openPortal() {
    setPending('portal');
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(t('portalFailed', { error: body.error ?? res.status }));
        return;
      }
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      {plans.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('changePlan')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {plans.map((p) => {
              const isUpgrade =
                planRank(p.code) > planRank(currentPlanCode);
              return (
                <div
                  key={p.code}
                  className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-mushu-border)] bg-[var(--color-mushu-surface)] px-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-[var(--color-mushu-mute)]">
                      R$ {(p.priceBrlCents / 100).toFixed(0)} / {t('perMonth')}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={isUpgrade ? 'default' : 'outline'}
                    disabled={pending !== null}
                    onClick={() => startCheckout(p.code)}
                  >
                    {pending === p.code
                      ? t('loading')
                      : isUpgrade
                        ? t('upgradeTo', { plan: p.name })
                        : t('switchTo', { plan: p.name })}
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {hasStripeCustomer ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('managePayment')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-[var(--color-mushu-mute)]">{t('portalDescription')}</p>
            <Button
              variant="secondary"
              className="w-fit"
              disabled={pending !== null}
              onClick={openPortal}
            >
              {pending === 'portal' ? t('loading') : t('openPortal')}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}

function planRank(code: string): number {
  if (code === 'free') return 0;
  if (code === 'pro') return 1;
  if (code === 'agency') return 2;
  return -1;
}

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getFlowAnalytics } from '@/actions/analytics';
import { FlowFunnel } from '@/components/analytics/flow-funnel';
import { AppShell } from '@/components/shell/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const days = (await searchParams).days === '30' ? 30 : 7;
  const analytics = await getFlowAnalytics(days);
  const t = await getTranslations('analytics');
  const tNav = await getTranslations('nav');

  return (
    <AppShell breadcrumb={[{ label: tNav('analytics') }]}>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-[var(--color-mushu-mute)]">{t('subtitle')}</p>
        </div>
        <nav aria-label={t('period')} className="flex gap-2">
          {[7, 30].map((period) => (
            <Link
              key={period}
              href={`/analytics?days=${period}`}
              aria-current={days === period ? 'page' : undefined}
              className={`rounded-md border px-3 py-2 text-sm ${days === period ? 'bg-[var(--color-mushu-scarlet)] text-white' : ''}`}
            >
              {t('days', { days: period })}
            </Link>
          ))}
        </nav>
        <p className="text-sm text-[var(--color-mushu-mute)]">{t('cohortNote')}</p>
        {!analytics ? (
          <p>{t('noOrg')}</p>
        ) : analytics.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">{t('empty')}</CardContent>
          </Card>
        ) : (
          analytics.map((flow) => (
            <Card key={flow.id}>
              <CardHeader>
                <CardTitle>
                  <Link href={`/flows/${flow.id}`}>{flow.name}</Link>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <dl className="grid grid-cols-2 gap-4 md:grid-cols-5">
                  {(['started', 'completed', 'failed', 'completionRate', 'clicks'] as const).map(
                    (metric) => (
                      <div key={metric}>
                        <dt className="text-sm text-[var(--color-mushu-mute)]">{t(metric)}</dt>
                        <dd className="text-2xl font-semibold">
                          {metric === 'completionRate'
                            ? `${flow[metric].toFixed(1)}%`
                            : flow[metric]}
                        </dd>
                      </div>
                    ),
                  )}
                </dl>
                <h2 className="font-semibold">{t('funnel')}</h2>
                <p className="text-xs text-[var(--color-mushu-mute)]">{t('funnelNote')}</p>
                {flow.steps.length ? (
                  <FlowFunnel steps={flow.steps} />
                ) : (
                  <p className="text-sm">{t('noSteps')}</p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </AppShell>
  );
}

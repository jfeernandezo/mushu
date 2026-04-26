import { db, flow } from '@mushu/db';
import { desc, eq } from 'drizzle-orm';
import { Workflow } from 'lucide-react';
import { getFormatter, getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CreateFlowButton } from '@/components/flows/create-flow-button';
import { AppShell } from '@/components/shell/app-shell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { auth } from '@/lib/auth';

export default async function FlowsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');
  const orgId = session.session.activeOrganizationId;
  if (!orgId) redirect('/dashboard');

  const t = await getTranslations('flows');
  const tNav = await getTranslations('nav');
  const formatter = await getFormatter();

  const flows = await db
    .select({
      id: flow.id,
      name: flow.name,
      description: flow.description,
      isEnabled: flow.isEnabled,
      publishVersion: flow.publishVersion,
      updatedAt: flow.updatedAt,
    })
    .from(flow)
    .where(eq(flow.organizationId, orgId))
    .orderBy(desc(flow.updatedAt));

  return (
    <AppShell breadcrumb={[{ label: tNav('flows') }]} showActivitiesPanel={false}>
      <div className="flex flex-col gap-6">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
            <p className="text-sm text-[var(--color-mushu-mute)]">{t('subtitle')}</p>
          </div>
          <CreateFlowButton />
        </div>

        {flows.length === 0 ? (
          <EmptyState title={t('emptyTitle')} body={t('emptyBody')} />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {flows.map((f) => (
              <Link key={f.id} href={`/flows/${f.id}`}>
                <Card className="transition-colors hover:border-[var(--color-mushu-scarlet)]">
                  <CardContent className="flex flex-col gap-2 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-[var(--color-mushu-ink)]">{f.name}</h3>
                      <Badge variant={f.isEnabled ? 'success' : 'outline'}>
                        {f.isEnabled ? t('live') : t('draft')}
                      </Badge>
                    </div>
                    <p className="line-clamp-2 text-sm text-[var(--color-mushu-mute)]">
                      {f.description ?? t('noDescription')}
                    </p>
                    <p className="mt-2 text-xs text-[var(--color-mushu-faint)]">
                      {t('versionUpdated', {
                        version: f.publishVersion,
                        date: formatter.dateTime(f.updatedAt, { dateStyle: 'short' }),
                      })}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <Workflow className="h-10 w-10 text-[var(--color-mushu-faint)]" />
        <div>
          <h3 className="font-medium">{title}</h3>
          <p className="mt-1 text-sm text-[var(--color-mushu-mute)]">{body}</p>
        </div>
        <CreateFlowButton />
      </CardContent>
    </Card>
  );
}

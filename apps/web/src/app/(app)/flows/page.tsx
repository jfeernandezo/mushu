import { db, flow } from '@mushu/db';
import { desc, eq } from 'drizzle-orm';
import { Plus, Workflow } from 'lucide-react';
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
    <AppShell
      breadcrumb={[{ label: 'Flows' }]}
      user={{ name: session.user.name, email: session.user.email }}
      showActivitiesPanel={false}
    >
      <div className="flex flex-col gap-6">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Flows</h1>
            <p className="text-sm text-[var(--color-mushu-mute)]">
              Visual automations triggered by Instagram events.
            </p>
          </div>
          <CreateFlowButton />
        </div>

        {flows.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {flows.map((f) => (
              <Link key={f.id} href={`/flows/${f.id}`}>
                <Card className="transition-colors hover:border-[var(--color-mushu-scarlet)]">
                  <CardContent className="flex flex-col gap-2 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-[var(--color-mushu-ink)]">{f.name}</h3>
                      <Badge variant={f.isEnabled ? 'success' : 'outline'}>
                        {f.isEnabled ? 'Live' : 'Draft'}
                      </Badge>
                    </div>
                    <p className="line-clamp-2 text-sm text-[var(--color-mushu-mute)]">
                      {f.description ?? 'No description'}
                    </p>
                    <p className="mt-2 text-xs text-[var(--color-mushu-faint)]">
                      v{f.publishVersion} · updated {f.updatedAt.toLocaleDateString()}
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

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <Workflow className="h-10 w-10 text-[var(--color-mushu-faint)]" />
        <div>
          <h3 className="font-medium">No flows yet</h3>
          <p className="mt-1 text-sm text-[var(--color-mushu-mute)]">
            Create your first flow to start automating comment replies and DM sequences.
          </p>
        </div>
        <CreateFlowButton />
      </CardContent>
    </Card>
  );
}

void Plus;

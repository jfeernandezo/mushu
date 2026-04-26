import { Zap } from 'lucide-react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/shell/app-shell';
import { Card, CardContent } from '@/components/ui/card';
import { auth } from '@/lib/auth';

export default async function TriggersPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  return (
    <AppShell
      breadcrumb={[{ label: 'Triggers' }]}

      showActivitiesPanel={false}
    >
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Triggers</h1>
          <p className="text-sm text-[var(--color-mushu-mute)]">
            All trigger nodes from your published flows, in one list.
          </p>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Zap className="h-10 w-10 text-[var(--color-mushu-faint)]" />
            <p className="text-sm text-[var(--color-mushu-mute)]">
              No triggers yet — publish a flow with a trigger block to populate this list.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

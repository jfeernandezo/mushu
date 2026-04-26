import { BarChart3 } from 'lucide-react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/shell/app-shell';
import { Card, CardContent } from '@/components/ui/card';
import { auth } from '@/lib/auth';

export default async function AnalyticsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  return (
    <AppShell
      breadcrumb={[{ label: 'Analytics' }]}

      showActivitiesPanel={false}
    >
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-sm text-[var(--color-mushu-mute)]">
            Deeper performance breakdowns for your flows. Coming in v0.2.
          </p>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <BarChart3 className="h-10 w-10 text-[var(--color-mushu-faint)]" />
            <p className="text-sm text-[var(--color-mushu-mute)]">
              Conversion funnels, A/B testing, contact LTV — all on the v0.2 roadmap.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

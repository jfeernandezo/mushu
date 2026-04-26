import { MessageCircle, Send, Users, Zap } from 'lucide-react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  getDashboardStats,
  getMessagesChartData,
  getTopTriggers,
} from '@/actions/dashboard';
import { MessagesChart } from '@/components/dashboard/messages-chart';
import { StatCard } from '@/components/dashboard/stat-card';
import { TopTriggersList } from '@/components/dashboard/top-triggers-list';
import { AppShell } from '@/components/shell/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { auth } from '@/lib/auth';

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  const orgId = session.session.activeOrganizationId;
  if (!orgId) {
    return (
      <AppShell
        breadcrumb={[{ label: 'Dashboard' }]}

      >
        <NoOrgState />
      </AppShell>
    );
  }

  const [stats, chartData, topTriggers] = await Promise.all([
    getDashboardStats(orgId),
    getMessagesChartData(orgId),
    getTopTriggers(orgId),
  ]);

  return (
    <AppShell
      breadcrumb={[{ label: 'Dashboard' }]}

    >
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
          <p className="text-sm text-[var(--color-mushu-mute)]">
            Snapshot of your Instagram automations.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Comments answered"
            value={stats.commentsRespondedDay}
            icon={MessageCircle}
            hint="Last 24h"
          />
          <StatCard
            label="DMs sent"
            value={stats.dmsSentDay}
            icon={Send}
            hint="Last 24h"
          />
          <StatCard
            label="Active contacts"
            value={stats.activeContactsWeek}
            icon={Users}
            hint="Last 7 days"
          />
          <StatCard
            label="Live flows"
            value={stats.liveFlows}
            icon={Zap}
            hint="Currently enabled"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Messages — last 7 days</CardTitle>
            </CardHeader>
            <CardContent>
              <MessagesChart data={chartData} />
            </CardContent>
          </Card>
          <TopTriggersList items={topTriggers} />
        </div>
      </div>
    </AppShell>
  );
}

function NoOrgState() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-base text-[var(--color-mushu-ink)]">
            No active workspace
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--color-mushu-mute)]">
            Create or pick a workspace to see your dashboard. Workspaces let you isolate
            multiple clients or brands inside a single Mushu instance.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

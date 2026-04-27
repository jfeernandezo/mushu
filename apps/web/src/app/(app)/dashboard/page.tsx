import { MessageCircle, Send, Users, Zap } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  getDashboardStats,
  getMessagesChartData,
  getTopTriggers,
} from '@/actions/dashboard';
import { getOnboardingState } from '@/actions/onboarding';
import { MessagesChart } from '@/components/dashboard/messages-chart';
import { OnboardingChecklist } from '@/components/dashboard/onboarding-checklist';
import { StatCard } from '@/components/dashboard/stat-card';
import { TopTriggersList } from '@/components/dashboard/top-triggers-list';
import { AppShell } from '@/components/shell/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { auth } from '@/lib/auth';

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  const t = await getTranslations('dashboard');
  const tNav = await getTranslations('nav');

  const orgId = session.session.activeOrganizationId;
  if (!orgId) {
    return (
      <AppShell breadcrumb={[{ label: tNav('dashboard') }]}>
        <NoOrgState title={t('noOrgTitle')} body={t('noOrgBody')} />
      </AppShell>
    );
  }

  const [stats, chartData, topTriggers, onboarding] = await Promise.all([
    getDashboardStats(orgId),
    getMessagesChartData(orgId),
    getTopTriggers(orgId),
    getOnboardingState(),
  ]);

  return (
    <AppShell breadcrumb={[{ label: tNav('dashboard') }]}>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('today')}</h1>
          <p className="text-sm text-[var(--color-mushu-mute)]">{t('subtitle')}</p>
        </div>

        <OnboardingChecklist state={onboarding} />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={t('stats.commentsAnswered')}
            value={stats.commentsRespondedDay}
            icon={MessageCircle}
            hint={t('stats.last24h')}
          />
          <StatCard
            label={t('stats.dmsSent')}
            value={stats.dmsSentDay}
            icon={Send}
            hint={t('stats.last24h')}
          />
          <StatCard
            label={t('stats.activeContacts')}
            value={stats.activeContactsWeek}
            icon={Users}
            hint={t('stats.last7days')}
          />
          <StatCard
            label={t('stats.liveFlows')}
            value={stats.liveFlows}
            icon={Zap}
            hint={t('stats.currentlyEnabled')}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{t('messagesLast7Days')}</CardTitle>
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

function NoOrgState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-base text-[var(--color-mushu-ink)]">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--color-mushu-mute)]">{body}</p>
        </CardContent>
      </Card>
    </div>
  );
}

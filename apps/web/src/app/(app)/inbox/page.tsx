import { instagramAccount, withOrgTx } from '@mushu/db';
import { eq } from 'drizzle-orm';
import { Inbox, Plug } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  getInboxCapabilities,
  listInboxConversations,
} from '@/actions/inbox';
import { InboxClient } from '@/components/inbox/inbox-client';
import { AppShell } from '@/components/shell/app-shell';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { auth } from '@/lib/auth';

interface InboxPageProps {
  searchParams: Promise<{
    status?: string;
    account?: string;
    assignee?: string;
    c?: string;
  }>;
}

export default async function InboxPage({ searchParams }: InboxPageProps) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');
  const orgId = session.session.activeOrganizationId;
  if (!orgId) redirect('/dashboard');

  const t = await getTranslations('inbox');
  const tNav = await getTranslations('nav');
  const params = await searchParams;

  const capabilities = await getInboxCapabilities();

  if (!capabilities.canView) {
    return (
      <AppShell breadcrumb={[{ label: tNav('inbox') }]}>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Inbox className="h-10 w-10 text-[var(--color-mushu-faint)]" />
            <p className="text-sm text-[var(--color-mushu-mute)]">{t('noPermission')}</p>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const [convResult, accounts] = await Promise.all([
    listInboxConversations({
      status: normalizeStatus(params.status),
      igAccountId: params.account ?? null,
      assignee: normalizeAssignee(params.assignee),
    }),
    withOrgTx(orgId, (tx) =>
      tx
        .select({
          id: instagramAccount.id,
          username: instagramAccount.igUsername,
          channel: instagramAccount.channel,
        })
        .from(instagramAccount)
        .where(eq(instagramAccount.organizationId, orgId)),
    ),
  ]);

  const initialConversations = convResult.ok ? convResult.data : [];

  return (
    <AppShell breadcrumb={[{ label: tNav('inbox') }]}>
      <div className="flex h-[calc(100vh-7rem)] flex-col gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-[var(--color-mushu-mute)]">{t('subtitle')}</p>
        </div>
        {accounts.length === 0 ? (
          <Card className="flex-1">
            <CardContent className="h-full p-0">
              <EmptyState
                icon={Plug}
                title={t('noAccountTitle')}
                description={t('noAccountBody')}
                action={{ label: t('noAccountConnect'), href: '/settings/workspace' }}
              />
            </CardContent>
          </Card>
        ) : (
          <InboxClient
            initialConversations={initialConversations}
            igAccounts={accounts}
            capabilities={capabilities}
            initialFilters={{
              status: normalizeStatus(params.status) ?? 'all',
              igAccountId: params.account ?? null,
              assignee: normalizeAssignee(params.assignee) ?? 'any',
            }}
            initialConversationId={params.c ?? null}
          />
        )}
      </div>
    </AppShell>
  );
}

function normalizeStatus(s: string | undefined) {
  if (s === 'open' || s === 'pending' || s === 'resolved' || s === 'snoozed' || s === 'all') {
    return s;
  }
  return undefined;
}

function normalizeAssignee(s: string | undefined) {
  if (s === 'me' || s === 'unassigned' || s === 'any') return s === 'any' ? undefined : s;
  return undefined;
}

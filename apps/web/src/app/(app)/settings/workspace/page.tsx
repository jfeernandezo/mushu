import { instagramAccount, withOrgTx } from '@mushu/db';
import { eq } from 'drizzle-orm';
import { AtSign, Instagram, Plug } from 'lucide-react';
import { getFormatter, getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { DisconnectAccountButton } from '@/components/settings/disconnect-account-button';
import { auth } from '@/lib/auth';

export default async function WorkspaceSettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');
  const orgId = session.session.activeOrganizationId;

  const t = await getTranslations('settings.workspace');
  const formatter = await getFormatter();

  const accounts = orgId
    ? await withOrgTx(orgId, (tx) =>
        tx
          .select({
            id: instagramAccount.id,
            igUsername: instagramAccount.igUsername,
            channel: instagramAccount.channel,
            expiresAt: instagramAccount.expiresAt,
            webhookSubscribed: instagramAccount.webhookSubscribed,
          })
          .from(instagramAccount)
          .where(eq(instagramAccount.organizationId, orgId)),
      )
    : [];

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-[var(--color-mushu-mute)]">{t('subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t('card')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {accounts.length === 0 ? (
            <EmptyState
              size="compact"
              icon={Plug}
              title={t('emptyTitle')}
              description={t('empty')}
            />
          ) : (
            accounts.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-md border border-[var(--color-mushu-border)] px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  {a.channel === 'threads' ? (
                    <AtSign className="h-4 w-4 text-[var(--color-mushu-ink)]" />
                  ) : (
                    <Instagram className="h-4 w-4 text-[var(--color-mushu-amber)]" />
                  )}
                  <span className="text-sm">@{a.igUsername}</span>
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                    {a.channel === 'threads' ? 'Threads' : 'Instagram'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  {a.webhookSubscribed ? (
                    <Badge variant="success">{t('active')}</Badge>
                  ) : (
                    <Badge variant="outline">{t('webhookPending')}</Badge>
                  )}
                  <span className="text-xs text-[var(--color-mushu-faint)]">
                    {a.expiresAt
                      ? t('expiresOn', {
                          date: formatter.dateTime(a.expiresAt, { dateStyle: 'short' }),
                        })
                      : t('neverExpires')}
                  </span>
                  <DisconnectAccountButton
                    accountId={a.id}
                    username={a.igUsername}
                    channel={a.channel as 'instagram' | 'threads'}
                  />
                </div>
              </div>
            ))
          )}
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="default" className="w-fit">
              <a href="/api/oauth/instagram/start">
                <Instagram className="h-4 w-4" />
                {t('connect')}
              </a>
            </Button>
            <Button asChild variant="secondary" className="w-fit">
              <a href="/api/oauth/threads/start">
                <AtSign className="h-4 w-4" />
                {t('connectThreads')}
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

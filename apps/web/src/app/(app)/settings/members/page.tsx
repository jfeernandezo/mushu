import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  getMyMemberCapabilities,
  listMembers,
  listPendingInvitations,
} from '@/actions/members';
import { InvitationsList } from '@/components/settings/invitations-list';
import { InviteMemberDialog } from '@/components/settings/invite-member-dialog';
import { MembersList } from '@/components/settings/members-list';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { auth } from '@/lib/auth';
import { isEmailEnabled } from '@/lib/email';

export default async function MembersSettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  const t = await getTranslations('settings.members');
  const [listResult, capabilities, invitationsResult] = await Promise.all([
    listMembers(),
    getMyMemberCapabilities(),
    listPendingInvitations(),
  ]);
  const members = listResult.ok ? listResult.data : [];
  const invitations = invitationsResult.ok ? invitationsResult.data : [];
  const emailEnabled = isEmailEnabled();

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-[var(--color-mushu-mute)]">{t('subtitle')}</p>
        </div>
        {capabilities.canInvite && emailEnabled ? <InviteMemberDialog /> : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t('card', { count: members.length })}</CardTitle>
        </CardHeader>
        <CardContent>
          <MembersList
            members={members}
            capabilities={capabilities}
            emailEnabled={emailEnabled}
          />
        </CardContent>
      </Card>

      {invitations.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              {t('pendingCard', { count: invitations.length })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <InvitationsList
              invitations={invitations}
              canCancel={capabilities.canInvite}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

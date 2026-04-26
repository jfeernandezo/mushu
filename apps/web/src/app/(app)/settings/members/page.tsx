import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getMyMemberCapabilities, listMembers } from '@/actions/members';
import { MembersList } from '@/components/settings/members-list';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { auth } from '@/lib/auth';

export default async function MembersSettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  const t = await getTranslations('settings.members');
  const [listResult, capabilities] = await Promise.all([listMembers(), getMyMemberCapabilities()]);
  const members = listResult.ok ? listResult.data : [];

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-[var(--color-mushu-mute)]">{t('subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t('card', { count: members.length })}</CardTitle>
        </CardHeader>
        <CardContent>
          <MembersList members={members} capabilities={capabilities} />
        </CardContent>
      </Card>
    </div>
  );
}

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { listMySessions } from '@/actions/user';
import { SessionsList } from '@/components/settings/sessions-list';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { auth } from '@/lib/auth';

export default async function SessionsSettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  const result = await listMySessions();
  const sessions = result.ok ? result.data : [];

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sessions</h1>
        <p className="text-sm text-[var(--color-mushu-mute)]">
          Devices and browsers signed in to your account.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Active sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <SessionsList sessions={sessions} />
        </CardContent>
      </Card>
    </div>
  );
}

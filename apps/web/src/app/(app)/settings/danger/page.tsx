import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { DeleteAccountDialog } from '@/components/settings/delete-account-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { auth } from '@/lib/auth';

export default async function DangerSettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Danger zone</h1>
        <p className="text-sm text-[var(--color-mushu-mute)]">
          Irreversible actions. Proceed with care.
        </p>
      </div>

      <Card className="border-[var(--color-mushu-danger)]/40">
        <CardHeader>
          <CardTitle className="text-sm text-[var(--color-mushu-danger)]">
            Delete account
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-[var(--color-mushu-mute)]">
            Permanently deletes your user, sessions, organization memberships, connected
            Instagram tokens, flows, contacts and history. This cannot be undone. See{' '}
            <a
              href="/data-deletion"
              className="text-[var(--color-mushu-amber)] hover:underline"
            >
              the data deletion page
            </a>{' '}
            for the full scope and retention policy.
          </p>
          <DeleteAccountDialog email={session.user.email} />
        </CardContent>
      </Card>
    </div>
  );
}

import { Users } from 'lucide-react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/shell/app-shell';
import { Card, CardContent } from '@/components/ui/card';
import { auth } from '@/lib/auth';

export default async function ContactsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  return (
    <AppShell
      breadcrumb={[{ label: 'Contacts' }]}
      user={{ name: session.user.name, email: session.user.email }}
      showActivitiesPanel={false}
    >
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
          <p className="text-sm text-[var(--color-mushu-mute)]">
            Everyone who interacted with your Instagram via Mushu.
          </p>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Users className="h-10 w-10 text-[var(--color-mushu-faint)]" />
            <p className="text-sm text-[var(--color-mushu-mute)]">
              No contacts yet. They'll show up here as people comment or DM your IG.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

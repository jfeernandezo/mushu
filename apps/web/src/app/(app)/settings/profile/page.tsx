import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ProfileForm } from '@/components/settings/profile-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { auth } from '@/lib/auth';

export default async function ProfileSettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-[var(--color-mushu-mute)]">
          How you appear inside Mushu.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Personal info</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            initialName={session.user.name ?? ''}
            initialImage={session.user.image}
            email={session.user.email}
          />
        </CardContent>
      </Card>
    </div>
  );
}

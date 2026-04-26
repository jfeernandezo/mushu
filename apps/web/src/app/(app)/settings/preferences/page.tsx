import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { PreferencesForm } from '@/components/settings/preferences-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { resolveLocale } from '@/i18n/get-locale';
import { auth } from '@/lib/auth';

export default async function PreferencesSettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  const locale = await resolveLocale();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Preferences</h1>
        <p className="text-sm text-[var(--color-mushu-mute)]">
          Theme and language for this account.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Appearance &amp; locale</CardTitle>
        </CardHeader>
        <CardContent>
          <PreferencesForm initialLocale={locale} />
        </CardContent>
      </Card>
    </div>
  );
}

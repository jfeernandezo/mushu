import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { PreferencesForm } from '@/components/settings/preferences-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { resolveLocale } from '@/i18n/get-locale';
import { auth } from '@/lib/auth';

export default async function PreferencesSettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  const t = await getTranslations('settings.preferences');
  const locale = await resolveLocale();

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
        <CardContent>
          <PreferencesForm initialLocale={locale} />
        </CardContent>
      </Card>
    </div>
  );
}

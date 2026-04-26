import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DataExportButton } from '@/components/settings/data-export-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { auth } from '@/lib/auth';

export default async function PrivacySettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  const t = await getTranslations('settings.privacy');

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-[var(--color-mushu-mute)]">{t('subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t('exportTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-[var(--color-mushu-mute)]">{t('exportBody')}</p>
          <DataExportButton />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t('docsTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5 text-sm">
          <Link href="/privacy" className="underline" target="_blank">
            {t('privacyLink')}
          </Link>
          <Link href="/terms" className="underline" target="_blank">
            {t('termsLink')}
          </Link>
          <Link href="/data-deletion" className="underline" target="_blank">
            {t('dataDeletionLink')}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

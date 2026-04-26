import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { SettingsNav } from '@/components/settings/settings-nav';
import { AppShell } from '@/components/shell/app-shell';
import { SignOutButton } from '@/components/shell/sign-out-button';
import { auth } from '@/lib/auth';

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  const tNav = await getTranslations('nav');
  const tSettings = await getTranslations('settings');

  return (
    <AppShell breadcrumb={[{ label: tNav('settings'), href: '/settings' }]}>
      <div className="flex gap-8">
        <aside className="flex w-56 shrink-0 flex-col">
          <p className="mb-2 px-2 text-[11px] font-medium uppercase tracking-wider text-[var(--color-mushu-faint)]">
            {tSettings('section')}
          </p>
          <SettingsNav />
          <div className="mt-6 border-t border-[var(--color-mushu-border)] pt-3">
            <SignOutButton />
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </AppShell>
  );
}

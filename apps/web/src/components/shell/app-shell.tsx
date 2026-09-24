import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { auth } from '@/lib/auth';
import { AppSidebar } from './app-sidebar';
import { AppTopNav } from './app-topnav';

interface AppShellProps {
  breadcrumb: { label: string; href?: string }[];
  children: ReactNode;
}

export async function AppShell({ breadcrumb, children }: AppShellProps) {
  // Self-resolve session so every page that uses AppShell gets a working
  // top-bar Bell without prop-drilling. Callers (the (app) layout) already
  // redirect unauthenticated users to /login, so we trust a session is
  // present here — but defensively handle the null case.
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session ? { name: session.user.name, email: session.user.email } : undefined;
  const tNav = await getTranslations('nav');
  const orgId = session?.session.activeOrganizationId ?? null;

  return (
    <div className="flex min-h-dvh w-full">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-[var(--color-mushu-surface)] focus:p-3 focus:text-[var(--color-mushu-ink)]"
      >
        {tNav('skipToContent')}
      </a>
      <AppSidebar className="sticky top-0 hidden lg:flex" />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopNav breadcrumb={breadcrumb} user={user} orgId={orgId} />
        <main
          id="main-content"
          tabIndex={-1}
          className="min-w-0 flex-1 px-4 py-5 outline-none sm:px-6 sm:py-6"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

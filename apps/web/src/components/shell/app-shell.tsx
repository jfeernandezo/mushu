import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { auth } from '@/lib/auth';
import { ActivitiesPanel } from './activities-panel';
import { AppSidebar } from './app-sidebar';
import { AppTopNav } from './app-topnav';

interface AppShellProps {
  breadcrumb: { label: string; href?: string }[];
  children: ReactNode;
  showActivitiesPanel?: boolean;
}

export async function AppShell({
  breadcrumb,
  children,
  showActivitiesPanel = true,
}: AppShellProps) {
  // Self-resolve session so every page that uses AppShell gets a working
  // top-bar Bell + activities panel without prop-drilling. Callers (the (app)
  // layout) already redirect unauthenticated users to /login, so we trust a
  // session is present here — but defensively handle the null case.
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session
    ? { name: session.user.name, email: session.user.email }
    : undefined;
  const orgId = session?.session.activeOrganizationId ?? null;

  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <div className="flex flex-1 flex-col">
        <AppTopNav breadcrumb={breadcrumb} user={user} orgId={orgId} />
        <main className="flex-1 overflow-y-auto px-6 py-6">{children}</main>
      </div>
      {showActivitiesPanel && orgId ? <ActivitiesPanel orgId={orgId} /> : null}
    </div>
  );
}

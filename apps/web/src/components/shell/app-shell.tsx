import type { ReactNode } from 'react';
import { ActivitiesPanel } from './activities-panel';
import { AppSidebar } from './app-sidebar';
import { AppTopNav } from './app-topnav';

interface AppShellProps {
  breadcrumb: { label: string; href?: string }[];
  user?: { name: string | null | undefined; email: string };
  children: ReactNode;
  showActivitiesPanel?: boolean;
}

export function AppShell({ breadcrumb, user, children, showActivitiesPanel = true }: AppShellProps) {
  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <div className="flex flex-1 flex-col">
        <AppTopNav breadcrumb={breadcrumb} user={user} />
        <main className="flex-1 overflow-y-auto px-6 py-6">{children}</main>
      </div>
      {showActivitiesPanel ? <ActivitiesPanel /> : null}
    </div>
  );
}

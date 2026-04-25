'use client';

import {
  BarChart3,
  Inbox,
  LayoutDashboard,
  type LucideIcon,
  Settings,
  Users,
  Workflow,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  disabled?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/inbox', label: 'Inbox', icon: Inbox, badge: 'v0.3', disabled: true },
  { href: '/flows', label: 'Flows', icon: Workflow },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/triggers', label: 'Triggers', icon: Zap },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
];

const FOOTER_ITEMS: NavItem[] = [{ href: '/settings', label: 'Settings', icon: Settings }];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-[var(--color-mushu-border)] bg-[var(--color-mushu-bg)] py-4">
      <div className="px-5 pb-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">🐲</span>
          <span className="text-lg font-semibold tracking-tight text-[var(--color-mushu-ink)]">
            Mushu
          </span>
        </Link>
      </div>

      <div className="px-3">
        <p className="mb-2 px-2 text-[11px] font-medium uppercase tracking-wider text-[var(--color-mushu-faint)]">
          Workspace
        </p>
        <nav className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => (
            <SidebarLink key={item.href} item={item} active={pathname === item.href} />
          ))}
        </nav>
      </div>

      <div className="mt-auto px-3">
        <nav className="flex flex-col gap-0.5">
          {FOOTER_ITEMS.map((item) => (
            <SidebarLink key={item.href} item={item} active={pathname === item.href} />
          ))}
        </nav>
      </div>
    </aside>
  );
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  const content = (
    <>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{item.label}</span>
      {item.badge ? (
        <span className="rounded bg-[var(--color-mushu-surface-hover)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-mushu-faint)]">
          {item.badge}
        </span>
      ) : null}
    </>
  );

  const className = cn(
    'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
    active
      ? 'bg-[var(--color-mushu-surface)] text-[var(--color-mushu-ink)]'
      : 'text-[var(--color-mushu-mute)] hover:bg-[var(--color-mushu-surface)] hover:text-[var(--color-mushu-ink)]',
    item.disabled && 'pointer-events-none opacity-50',
  );

  if (item.disabled) {
    return (
      <span className={className} aria-disabled>
        {content}
      </span>
    );
  }
  return (
    <Link href={item.href} className={className}>
      {content}
    </Link>
  );
}

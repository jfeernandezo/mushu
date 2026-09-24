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
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

type NavKey = 'dashboard' | 'inbox' | 'flows' | 'contacts' | 'triggers' | 'analytics' | 'settings';

interface NavItem {
  href: string;
  key: NavKey;
  icon: LucideIcon;
  badge?: string;
  disabled?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', key: 'dashboard', icon: LayoutDashboard },
  { href: '/inbox', key: 'inbox', icon: Inbox },
  { href: '/flows', key: 'flows', icon: Workflow },
  { href: '/contacts', key: 'contacts', icon: Users },
  { href: '/triggers', key: 'triggers', icon: Zap },
  { href: '/analytics', key: 'analytics', icon: BarChart3 },
];

const FOOTER_ITEMS: NavItem[] = [{ href: '/settings', key: 'settings', icon: Settings }];

export function AppSidebar({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const tNav = useTranslations('nav');
  const tLegal = useTranslations('legal');

  return (
    <aside
      className={cn(
        'flex h-dvh w-60 shrink-0 flex-col overflow-y-auto border-r border-[var(--color-mushu-border)] bg-[var(--color-mushu-bg)] py-4',
        className,
      )}
    >
      <div className="px-5 pb-6">
        <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-2">
          <Image src="/mushu-logo.png" alt="Mushu" width={28} height={28} className="rounded-md" />
          <span className="text-lg font-semibold tracking-tight text-[var(--color-mushu-ink)]">
            Mushu
          </span>
        </Link>
      </div>

      <div className="px-3">
        <p className="mb-2 px-2 text-[11px] font-medium uppercase tracking-wider text-[var(--color-mushu-faint)]">
          {tNav('workspace')}
        </p>
        <nav aria-label={tNav('navigation')} className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => (
            <SidebarLink
              onNavigate={onNavigate}
              key={item.href}
              item={item}
              label={tNav(item.key)}
              active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
            />
          ))}
        </nav>
      </div>

      <div className="mt-auto px-3">
        <nav className="flex flex-col gap-0.5">
          {FOOTER_ITEMS.map((item) => (
            <SidebarLink
              onNavigate={onNavigate}
              key={item.href}
              item={item}
              label={tNav(item.key)}
              active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
            />
          ))}
        </nav>
        <div className="mt-3 flex flex-wrap gap-x-2 gap-y-1 px-2 text-[10px] text-[var(--color-mushu-faint)]">
          <Link
            onClick={onNavigate}
            href="/privacy"
            className="hover:text-[var(--color-mushu-mute)]"
          >
            {tLegal('privacy')}
          </Link>
          <Link onClick={onNavigate} href="/terms" className="hover:text-[var(--color-mushu-mute)]">
            {tLegal('terms')}
          </Link>
          <Link
            onClick={onNavigate}
            href="/data-deletion"
            className="hover:text-[var(--color-mushu-mute)]"
          >
            {tLegal('dataDeletionShort')}
          </Link>
        </div>
      </div>
    </aside>
  );
}

function SidebarLink({
  item,
  label,
  active,
  onNavigate,
}: {
  item: NavItem;
  label: string;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const content = (
    <>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {item.badge ? (
        <span className="rounded bg-[var(--color-mushu-surface-hover)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-mushu-faint)]">
          {item.badge}
        </span>
      ) : null}
    </>
  );

  const className = cn(
    'flex min-h-11 items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mushu-focus)] lg:min-h-9',
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
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={className}
    >
      {content}
    </Link>
  );
}

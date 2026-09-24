'use client';

import {
  AlertTriangle,
  Building2,
  CreditCard,
  KeyRound,
  type LucideIcon,
  MonitorSmartphone,
  Settings as SettingsIcon,
  Shield,
  User,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

type NavKey =
  | 'profile'
  | 'security'
  | 'sessions'
  | 'workspace'
  | 'members'
  | 'billing'
  | 'preferences'
  | 'privacy'
  | 'danger';

interface NavItem {
  href: string;
  key: NavKey;
  icon: LucideIcon;
  hostedOnly?: boolean;
}

const ITEMS: NavItem[] = [
  { href: '/settings/profile', key: 'profile', icon: User },
  { href: '/settings/security', key: 'security', icon: KeyRound },
  { href: '/settings/sessions', key: 'sessions', icon: MonitorSmartphone },
  { href: '/settings/workspace', key: 'workspace', icon: Building2 },
  { href: '/settings/members', key: 'members', icon: Users },
  { href: '/settings/billing', key: 'billing', icon: CreditCard, hostedOnly: true },
  { href: '/settings/preferences', key: 'preferences', icon: SettingsIcon },
  { href: '/settings/privacy', key: 'privacy', icon: Shield },
  { href: '/settings/danger', key: 'danger', icon: AlertTriangle },
];

interface SettingsNavProps {
  /** True when MUSHU_MODE=hosted; resolved server-side and passed in. */
  isHosted: boolean;
}

export function SettingsNav({ isHosted }: SettingsNavProps) {
  const pathname = usePathname();
  const t = useTranslations('settings.nav');
  const visibleItems = ITEMS.filter((i) => !i.hostedOnly || isHosted);
  return (
    <nav
      aria-label={t('navigation')}
      className="flex gap-1 overflow-x-auto pb-1 xl:flex-col xl:gap-0.5 xl:overflow-visible"
    >
      {visibleItems.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-11 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mushu-focus)] focus-visible:ring-inset xl:min-h-9',
              active
                ? 'bg-[var(--color-mushu-surface)] text-[var(--color-mushu-ink)]'
                : 'text-[var(--color-mushu-mute)] hover:bg-[var(--color-mushu-surface)] hover:text-[var(--color-mushu-ink)]',
              item.key === 'danger' && !active && 'text-[var(--color-mushu-danger)]/80',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{t(item.key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

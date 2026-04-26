'use client';

import {
  AlertTriangle,
  Building2,
  KeyRound,
  type LucideIcon,
  MonitorSmartphone,
  Settings as SettingsIcon,
  User,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

type NavKey = 'profile' | 'security' | 'sessions' | 'workspace' | 'preferences' | 'danger';

interface NavItem {
  href: string;
  key: NavKey;
  icon: LucideIcon;
}

const ITEMS: NavItem[] = [
  { href: '/settings/profile', key: 'profile', icon: User },
  { href: '/settings/security', key: 'security', icon: KeyRound },
  { href: '/settings/sessions', key: 'sessions', icon: MonitorSmartphone },
  { href: '/settings/workspace', key: 'workspace', icon: Building2 },
  { href: '/settings/preferences', key: 'preferences', icon: SettingsIcon },
  { href: '/settings/danger', key: 'danger', icon: AlertTriangle },
];

export function SettingsNav() {
  const pathname = usePathname();
  const t = useTranslations('settings.nav');
  return (
    <nav className="flex flex-col gap-0.5">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
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

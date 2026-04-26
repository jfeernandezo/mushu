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
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const ITEMS: NavItem[] = [
  { href: '/settings/profile', label: 'Profile', icon: User },
  { href: '/settings/security', label: 'Security', icon: KeyRound },
  { href: '/settings/sessions', label: 'Sessions', icon: MonitorSmartphone },
  { href: '/settings/workspace', label: 'Workspace', icon: Building2 },
  { href: '/settings/preferences', label: 'Preferences', icon: SettingsIcon },
  { href: '/settings/danger', label: 'Danger zone', icon: AlertTriangle },
];

export function SettingsNav() {
  const pathname = usePathname();
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
              item.href === '/settings/danger' && !active && 'text-[var(--color-mushu-danger)]/80',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

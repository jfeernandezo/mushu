'use client';

import { Bell, Moon, Search, Sun } from 'lucide-react';
import { useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

interface AppTopNavProps {
  breadcrumb: { label: string; href?: string }[];
  user?: { name: string | null | undefined; email: string };
}

export function AppTopNav({ breadcrumb, user }: AppTopNavProps) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  return (
    <header className="flex h-14 items-center gap-4 border-b border-[var(--color-mushu-border)] bg-[var(--color-mushu-bg)] px-6">
      <nav aria-label="breadcrumb" className="flex items-center gap-2 text-sm">
        {breadcrumb.map((b, i) => (
          <span key={`${b.label}-${i}`} className="flex items-center gap-2">
            {i > 0 && <span className="text-[var(--color-mushu-faint)]">/</span>}
            {b.href ? (
              <a
                className="text-[var(--color-mushu-mute)] hover:text-[var(--color-mushu-ink)]"
                href={b.href}
              >
                {b.label}
              </a>
            ) : (
              <span className="text-[var(--color-mushu-ink)]">{b.label}</span>
            )}
          </span>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-mushu-faint)]" />
          <Input
            placeholder="Search… (⌘/)"
            className="h-8 pl-8 text-xs"
            disabled
          />
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </Button>

        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Notifications">
          <Bell className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="h-6" />

        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-[var(--color-mushu-scarlet)] text-white">
            {user ? initials(user.name ?? user.email) : 'U'}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}

function initials(s: string): string {
  const parts = s.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

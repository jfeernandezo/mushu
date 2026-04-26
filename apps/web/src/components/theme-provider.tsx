'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isTheme, resolveTheme, type ResolvedTheme, type Theme, THEME_COOKIE } from '@/lib/theme';

interface ThemeContextValue {
  theme: Theme;
  resolved: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: React.ReactNode;
  initialTheme: Theme;
}

export function ThemeProvider({ children, initialTheme }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    initialTheme === 'system' ? 'dark' : initialTheme,
  );

  // Reflect theme to <html data-theme> + cookie + watch system changes.
  useEffect(() => {
    const root = document.documentElement;
    const next = resolveTheme(theme);
    root.dataset.theme = next;
    setResolved(next);

    // 1 year, lax — same site only.
    document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;

    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = () => {
      const r = mq.matches ? 'light' : 'dark';
      root.dataset.theme = r;
      setResolved(r);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    if (!isTheme(next)) return;
    setThemeState(next);
  }, []);

  const value = useMemo(() => ({ theme, resolved, setTheme }), [theme, resolved, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

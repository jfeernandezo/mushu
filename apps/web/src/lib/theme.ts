export const THEMES = ['light', 'dark', 'system'] as const;
export type Theme = (typeof THEMES)[number];

export type ResolvedTheme = 'light' | 'dark';

export const THEME_COOKIE = 'mushu_theme';

export function isTheme(value: string | undefined | null): value is Theme {
  return value !== undefined && value !== null && (THEMES as readonly string[]).includes(value);
}

/** Resolve `'system'` to `'light'` or `'dark'` based on the user's OS setting. */
export function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === 'system') {
    if (typeof window === 'undefined') return 'dark';
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return theme;
}

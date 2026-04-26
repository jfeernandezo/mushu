import type { ResolvedTheme } from './theme';

/**
 * JS-side color values that mirror the CSS vars in globals.css.
 *
 * Use these in client components that pass colors to libraries which can't
 * read CSS vars directly (Recharts, ReactFlow, native Canvas APIs, etc).
 * Read the resolved theme via `useTheme()` and index this object by it.
 */
export const THEME_COLORS = {
  dark: {
    bg: '#0a0a0b',
    surface: '#141416',
    surfaceHover: '#1c1c20',
    border: '#26262a',
    borderSubtle: '#1d1d20',
    ink: '#f5f5f4',
    mute: '#8b8b8e',
    faint: '#5a5a5e',
    scarlet: '#c73e1d',
    scarletSoft: '#e15a3a',
    amber: '#ffc107',
    amberSoft: '#ffd54f',
    success: '#4ade80',
    danger: '#f87171',
  },
  light: {
    bg: '#ffffff',
    surface: '#f8f8f7',
    surfaceHover: '#efefee',
    border: '#e4e4e7',
    borderSubtle: '#ededee',
    ink: '#18181b',
    mute: '#52525b',
    faint: '#a1a1aa',
    scarlet: '#c73e1d',
    scarletSoft: '#e15a3a',
    amber: '#f59e0b',
    amberSoft: '#fbbf24',
    success: '#16a34a',
    danger: '#dc2626',
  },
} as const satisfies Record<ResolvedTheme, Record<string, string>>;

export type ThemePalette = (typeof THEME_COLORS)['dark'];

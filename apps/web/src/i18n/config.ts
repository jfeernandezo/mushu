export const LOCALES = ['pt-BR', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'pt-BR';

export const LOCALE_COOKIE = 'mushu_locale';

export function isLocale(value: string | undefined | null): value is Locale {
  return value !== undefined && value !== null && (LOCALES as readonly string[]).includes(value);
}

export const LOCALE_LABELS: Record<Locale, string> = {
  'pt-BR': 'Português (Brasil)',
  en: 'English',
};

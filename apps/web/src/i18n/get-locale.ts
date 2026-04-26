import { cookies, headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from './config';

/**
 * Resolve the current request's locale, in priority order:
 *   1. Cookie (set when the user picks a locale in /settings)
 *   2. Logged-in user's `locale` column
 *   3. DEFAULT_LOCALE
 */
export async function resolveLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieValue)) return cookieValue;

  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  const userLocale = (session?.user as { locale?: string } | undefined)?.locale;
  if (isLocale(userLocale)) return userLocale;

  return DEFAULT_LOCALE;
}

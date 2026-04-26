'use server';

import { db, user } from '@mushu/db';
import { eq } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';
import { z } from 'zod';
import { LOCALE_COOKIE, LOCALES } from '@/i18n/config';
import { auth } from '@/lib/auth';
import { THEME_COOKIE, THEMES } from '@/lib/theme';

const schema = z.object({
  locale: z.enum(LOCALES).optional(),
  theme: z.enum(THEMES).optional(),
});

export async function updateUserPreferences(
  input: z.input<typeof schema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };
  const { locale, theme } = parsed.data;
  if (!locale && !theme) return { ok: true };

  const cookieStore = await cookies();
  const oneYear = 60 * 60 * 24 * 365;
  if (locale) {
    cookieStore.set(LOCALE_COOKIE, locale, {
      path: '/',
      maxAge: oneYear,
      sameSite: 'lax',
    });
  }
  if (theme) {
    cookieStore.set(THEME_COOKIE, theme, {
      path: '/',
      maxAge: oneYear,
      sameSite: 'lax',
    });
  }

  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (session?.user.id) {
    const update: { locale?: string; theme?: string; updatedAt: Date } = { updatedAt: new Date() };
    if (locale) update.locale = locale;
    if (theme) update.theme = theme;
    await db.update(user).set(update).where(eq(user.id, session.user.id));
  }

  return { ok: true };
}

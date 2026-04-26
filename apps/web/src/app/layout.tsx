import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { AppToaster } from '@/components/app-toaster';
import { ThemeProvider } from '@/components/theme-provider';
import { isTheme, type ResolvedTheme, type Theme, THEME_COOKIE } from '@/lib/theme';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mushu — Open-source Instagram automation',
  description:
    'Self-hosted ManyChat alternative. Automate Instagram comments and DMs without the SaaS lock-in.',
};

// Inlined into <head>. Resolves the theme cookie before React hydrates so the
// browser paints with the correct palette and avoids a flash of wrong theme
// (FOUC). `system` is resolved against prefers-color-scheme.
const NO_FOUC_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=([^;]+)/);var t=m?decodeURIComponent(m[1]):'dark';if(t==='system'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='dark';}})();`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(THEME_COOKIE)?.value;
  const initialTheme: Theme = isTheme(cookieValue) ? cookieValue : 'dark';
  const ssrTheme: ResolvedTheme = initialTheme === 'system' ? 'dark' : initialTheme;

  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} data-theme={ssrTheme}>
      <head>
        <meta name="color-scheme" content="light dark" />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: trusted constant string */}
        <script dangerouslySetInnerHTML={{ __html: NO_FOUC_SCRIPT }} />
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider initialTheme={initialTheme}>
            {children}
            <AppToaster />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

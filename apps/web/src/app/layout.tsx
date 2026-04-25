import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mushu — Open-source Instagram automation',
  description:
    'Self-hosted ManyChat alternative. Automate Instagram comments and DMs without the SaaS lock-in.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

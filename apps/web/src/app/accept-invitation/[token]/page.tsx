import { dbAdmin, invitation as invitationTable, organization as orgTable } from '@mushu/db';
import { eq } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AcceptInvitationClient } from '@/components/auth/accept-invitation-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { auth } from '@/lib/auth';

interface AcceptInvitationPageProps {
  params: Promise<{ token: string }>;
}

/**
 * Landing page for /accept-invitation/[token] links sent by sendInvitationEmail.
 *
 * Three states:
 *   1. Token doesn't match anything (or is invalid/expired) → friendly error page
 *   2. User isn't logged in → ask them to log in or create an account; we
 *      keep the token in the URL so once authenticated they're sent back here
 *   3. User is logged in → render the accept button (client component calls
 *      auth.api.acceptInvitation)
 */
export default async function AcceptInvitationPage({ params }: AcceptInvitationPageProps) {
  const { token } = await params;
  const t = await getTranslations('acceptInvitation');

  // dbAdmin since invitation table doesn't have RLS scoped by org context
  // and we don't have a session yet for case 2.
  const [inv] = await dbAdmin
    .select({
      id: invitationTable.id,
      email: invitationTable.email,
      role: invitationTable.role,
      status: invitationTable.status,
      expiresAt: invitationTable.expiresAt,
      organizationId: invitationTable.organizationId,
      organizationName: orgTable.name,
    })
    .from(invitationTable)
    .innerJoin(orgTable, eq(orgTable.id, invitationTable.organizationId))
    .where(eq(invitationTable.id, token))
    .limit(1);

  if (!inv) {
    return (
      <ErrorShell title={t('notFoundTitle')} body={t('notFoundBody')} />
    );
  }
  if (inv.status !== 'pending') {
    return (
      <ErrorShell title={t('alreadyHandledTitle')} body={t('alreadyHandledBody')} />
    );
  }
  if (inv.expiresAt.getTime() < Date.now()) {
    return (
      <ErrorShell title={t('expiredTitle')} body={t('expiredBody')} />
    );
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    // Redirect to login with a redirect-back. After login, they bounce back
    // here and case 3 fires.
    const back = `/accept-invitation/${token}`;
    redirect(`/login?redirect=${encodeURIComponent(back)}&hint=invitation&email=${encodeURIComponent(inv.email)}`);
  }

  // The recipient might be logged in to a different account than the email
  // the invitation was sent to. Surface that — they have to logout/switch.
  if (session.user.email.toLowerCase() !== inv.email.toLowerCase()) {
    return (
      <ErrorShell
        title={t('wrongAccountTitle')}
        body={t('wrongAccountBody', {
          expected: inv.email,
          current: session.user.email,
        })}
      />
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-[var(--color-mushu-mute)]">
            {t('body', {
              workspace: inv.organizationName,
              role: inv.role ?? 'member',
            })}
          </p>
          <AcceptInvitationClient invitationId={inv.id} />
        </CardContent>
      </Card>
    </main>
  );
}

function ErrorShell({ title, body }: { title: string; body: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-[var(--color-mushu-mute)]">{body}</p>
          <Link
            href="/login"
            className="text-sm text-[var(--color-mushu-amber)] underline underline-offset-2"
          >
            ← Voltar pro login
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}

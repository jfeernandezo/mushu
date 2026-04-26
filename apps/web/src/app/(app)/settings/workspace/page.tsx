import { db, instagramAccount } from '@mushu/db';
import { eq } from 'drizzle-orm';
import { Instagram } from 'lucide-react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { auth } from '@/lib/auth';

export default async function WorkspaceSettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');
  const orgId = session.session.activeOrganizationId;

  const accounts = orgId
    ? await db
        .select({
          id: instagramAccount.id,
          igUsername: instagramAccount.igUsername,
          expiresAt: instagramAccount.expiresAt,
          webhookSubscribed: instagramAccount.webhookSubscribed,
        })
        .from(instagramAccount)
        .where(eq(instagramAccount.organizationId, orgId))
    : [];

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Workspace</h1>
        <p className="text-sm text-[var(--color-mushu-mute)]">
          Instagram accounts and integrations for this organization.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Instagram accounts</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {accounts.length === 0 ? (
            <p className="text-sm text-[var(--color-mushu-mute)]">
              No Instagram accounts connected yet.
            </p>
          ) : (
            accounts.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-md border border-[var(--color-mushu-border)] px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <Instagram className="h-4 w-4 text-[var(--color-mushu-amber)]" />
                  <span className="text-sm">@{a.igUsername}</span>
                </div>
                <div className="flex items-center gap-2">
                  {a.webhookSubscribed ? (
                    <Badge variant="success">Active</Badge>
                  ) : (
                    <Badge variant="outline">Webhook pending</Badge>
                  )}
                  <span className="text-xs text-[var(--color-mushu-faint)]">
                    Expires {a.expiresAt?.toLocaleDateString() ?? '—'}
                  </span>
                </div>
              </div>
            ))
          )}
          <Button asChild variant="default" className="w-fit">
            <a href="/api/oauth/instagram/start">
              <Instagram className="h-4 w-4" />
              Connect Instagram account
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

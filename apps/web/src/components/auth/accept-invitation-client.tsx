'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';

interface AcceptInvitationClientProps {
  invitationId: string;
}

/**
 * Client-side accept button. Calls Better Auth's organization plugin via the
 * authClient so the invitation row updates and a fresh session reflects the
 * new active organization.
 *
 * Better Auth's `acceptInvitation` writes the new member row, member's
 * permission_group seed (we depend on the role->group templates from
 * 0003 migration), and bumps `session.activeOrganizationId` to the joined
 * org. After it returns we refresh the router so the dashboard re-renders
 * with the new org's data.
 */
export function AcceptInvitationClient({ invitationId }: AcceptInvitationClientProps) {
  const t = useTranslations('acceptInvitation');
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onAccept() {
    if (pending) return;
    setPending(true);
    try {
      const r = await authClient.organization.acceptInvitation({ invitationId });
      if (r.error) {
        toast.error(t('failed', { error: r.error.message ?? 'unknown' }));
        return;
      }
      toast.success(t('accepted'));
      router.push('/dashboard');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button onClick={onAccept} disabled={pending} className="w-full">
      {pending ? t('accepting') : t('acceptButton')}
    </Button>
  );
}

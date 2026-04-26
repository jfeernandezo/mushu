'use client';

import { Trash2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { type MemberRow, removeMember, updateMemberRole } from '@/actions/members';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ASSIGNABLE_ROLES, type AssignableRole } from '@/lib/member-roles';

interface MembersListProps {
  members: MemberRow[];
  capabilities: { canAssignRoles: boolean; canRemove: boolean; canInvite: boolean };
  /** False when SMTP isn't configured — invite UI shows a hint instead. */
  emailEnabled: boolean;
}

export function MembersList({ members, capabilities, emailEnabled }: MembersListProps) {
  const t = useTranslations('settings.members');
  const formatter = useFormatter();
  const [pending, startTransition] = useTransition();

  function onChangeRole(memberId: string, newRole: AssignableRole) {
    startTransition(async () => {
      const r = await updateMemberRole({ memberId, newRole });
      if (r.ok) toast.success(t('roleChanged'));
      else toast.error(t('roleChangeFailed', { error: r.error }));
    });
  }

  function onRemove(memberId: string, name: string) {
    if (!confirm(t('removeConfirm', { name }))) return;
    startTransition(async () => {
      const r = await removeMember(memberId);
      if (r.ok) toast.success(t('removed'));
      else toast.error(t('removeFailed', { error: r.error }));
    });
  }

  return (
    <ul className="flex flex-col gap-2">
      {members.map((m) => {
        const isOwner = m.role === 'owner';
        const showRoleSelector =
          capabilities.canAssignRoles && !isOwner && !m.isCurrentUser;
        const showRemove = capabilities.canRemove && !isOwner && !m.isCurrentUser;

        return (
          <li
            key={m.memberId}
            className="flex items-center gap-3 rounded-md border border-[var(--color-mushu-border)] bg-[var(--color-mushu-surface)] px-3 py-2.5"
          >
            <Avatar className="h-8 w-8 shrink-0">
              {m.image ? <AvatarImage src={m.image} alt={m.name} /> : null}
              <AvatarFallback>{m.name.slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm text-[var(--color-mushu-ink)]">{m.name}</p>
                {m.isCurrentUser ? (
                  <Badge variant="outline" className="shrink-0">
                    {t('youBadge')}
                  </Badge>
                ) : null}
              </div>
              <p className="truncate text-xs text-[var(--color-mushu-faint)]">
                {m.email} · {t('joined', { date: formatter.dateTime(m.joinedAt, { dateStyle: 'short' }) })}
              </p>
            </div>

            {showRoleSelector ? (
              <select
                disabled={pending}
                value={m.role}
                onChange={(e) => onChangeRole(m.memberId, e.target.value as AssignableRole)}
                className="rounded-md border border-[var(--color-mushu-border)] bg-[var(--color-mushu-bg)] px-2 py-1 text-xs text-[var(--color-mushu-ink)]"
              >
                {ASSIGNABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t(`roleLabel.${r}`)}
                  </option>
                ))}
              </select>
            ) : (
              <Badge variant={isOwner ? 'success' : 'outline'} className="shrink-0">
                {t.has(`roleLabel.${m.role}`) ? t(`roleLabel.${m.role}`) : m.role}
              </Badge>
            )}

            {showRemove ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => onRemove(m.memberId, m.name)}
                aria-label={t('remove')}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </li>
        );
      })}
      {capabilities.canInvite && !emailEnabled ? (
        <p className="mt-2 text-xs text-[var(--color-mushu-faint)]">{t('smtpRequired')}</p>
      ) : null}
    </ul>
  );
}

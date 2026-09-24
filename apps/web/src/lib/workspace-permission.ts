import { dbAdmin, member } from '@mushu/db';
import { and, eq } from 'drizzle-orm';
import { PermissionDeniedError, requirePermission } from '@/lib/permissions';

/** Resolve membership from the authenticated user, never from caller-supplied member IDs. */
export async function requireWorkspacePermission(
  userId: string,
  organizationId: string,
  permission: string,
): Promise<void> {
  const [membership] = await dbAdmin
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.organizationId, organizationId)))
    .limit(1);
  if (!membership) throw new PermissionDeniedError(permission);
  await requirePermission(membership.id, permission);
}

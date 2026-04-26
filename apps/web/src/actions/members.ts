'use server';

import {
  db,
  invitation as invitationTable,
  member as memberTable,
  user as userTable,
} from '@mushu/db';
import { and, eq } from 'drizzle-orm';
import { headers as nextHeaders } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { AUDIT_ACTIONS, recordAudit, requestMeta } from '@/lib/audit';
import { auth } from '@/lib/auth';
import { isEmailEnabled } from '@/lib/email';
import { hasPermission, requirePermission, resetMemberGroupsForRole } from '@/lib/permissions';

type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

// Roles assignable via the UI. 'owner' is intentionally NOT in this list:
// transferring ownership is a destructive operation that needs its own
// 2-step confirmation flow (deferred to a future phase). For now, the only
// way to become owner is to be the workspace creator.
const ASSIGNABLE_ROLES = ['admin', 'editor', 'viewer'] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export interface MemberRow {
  memberId: string;
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
  joinedAt: Date;
  isCurrentUser: boolean;
}

async function requireSession() {
  const s = await auth.api.getSession({ headers: await nextHeaders() });
  if (!s) throw new Error('unauthenticated');
  return s;
}

async function findMyMember(userId: string, orgId: string) {
  const [m] = await db
    .select({ id: memberTable.id, role: memberTable.role })
    .from(memberTable)
    .where(and(eq(memberTable.userId, userId), eq(memberTable.organizationId, orgId)))
    .limit(1);
  return m;
}

/**
 * List all members of the active organization, with their identity (name,
 * email, role). Anyone in the org can call this — directories of who's in
 * the workspace shouldn't require a special permission.
 */
export async function listMembers(): Promise<ActionResult<MemberRow[]>> {
  try {
    const session = await requireSession();
    const orgId = session.session.activeOrganizationId;
    if (!orgId) return { ok: true, data: [] };

    const rows = await db
      .select({
        memberId: memberTable.id,
        userId: memberTable.userId,
        name: userTable.name,
        email: userTable.email,
        image: userTable.image,
        role: memberTable.role,
        joinedAt: memberTable.createdAt,
      })
      .from(memberTable)
      .innerJoin(userTable, eq(userTable.id, memberTable.userId))
      .where(eq(memberTable.organizationId, orgId))
      .orderBy(memberTable.createdAt);

    return {
      ok: true,
      data: rows.map((r) => ({
        ...r,
        isCurrentUser: r.userId === session.user.id,
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown_error' };
  }
}

const updateRoleSchema = z.object({
  memberId: z.string().min(1),
  newRole: z.enum(ASSIGNABLE_ROLES),
});

/**
 * Change a member's role. Resets their group memberships to match the new
 * role (any direct group assignments they had are wiped — see the
 * resetMemberGroupsForRole contract). Owner role is immutable from here:
 * owners stay owners, and you can't promote anyone else to owner via this
 * action. Demoting yourself works (you keep the org but lose admin powers).
 */
export async function updateMemberRole(
  input: z.input<typeof updateRoleSchema>,
): Promise<ActionResult> {
  const parsed = updateRoleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };
  try {
    const session = await requireSession();
    const orgId = session.session.activeOrganizationId;
    if (!orgId) return { ok: false, error: 'no_active_org' };

    const me = await findMyMember(session.user.id, orgId);
    if (!me) return { ok: false, error: 'not_a_member' };
    await requirePermission(me.id, 'member.role.assign');

    // Look up the target — must be in the same org, and must not be an owner
    // (owners are immutable from this action).
    const [target] = await db
      .select({ id: memberTable.id, role: memberTable.role, userId: memberTable.userId })
      .from(memberTable)
      .where(
        and(eq(memberTable.id, parsed.data.memberId), eq(memberTable.organizationId, orgId)),
      )
      .limit(1);
    if (!target) return { ok: false, error: 'member_not_found' };
    if (target.role === 'owner') return { ok: false, error: 'cannot_modify_owner' };

    await db
      .update(memberTable)
      .set({ role: parsed.data.newRole })
      .where(eq(memberTable.id, target.id));

    await resetMemberGroupsForRole(target.id, orgId, parsed.data.newRole);

    const meta = await requestMeta();
    await recordAudit({
      orgId,
      actorUserId: session.user.id,
      action: AUDIT_ACTIONS.MEMBER_ROLE_CHANGE,
      targetType: 'member',
      targetId: target.id,
      metadata: { previousRole: target.role, newRole: parsed.data.newRole },
      ...meta,
    });

    revalidatePath('/settings/members');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown_error' };
  }
}

/**
 * Remove a member from the organization. Owners cannot be removed via this
 * action (delete the workspace itself instead). You also can't remove
 * yourself — use a future "leave workspace" action if needed.
 */
export async function removeMember(memberId: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const orgId = session.session.activeOrganizationId;
    if (!orgId) return { ok: false, error: 'no_active_org' };

    const me = await findMyMember(session.user.id, orgId);
    if (!me) return { ok: false, error: 'not_a_member' };
    if (me.id === memberId) return { ok: false, error: 'cannot_remove_self' };
    await requirePermission(me.id, 'member.remove');

    const [target] = await db
      .select({ id: memberTable.id, role: memberTable.role, userId: memberTable.userId })
      .from(memberTable)
      .where(and(eq(memberTable.id, memberId), eq(memberTable.organizationId, orgId)))
      .limit(1);
    if (!target) return { ok: false, error: 'member_not_found' };
    if (target.role === 'owner') return { ok: false, error: 'cannot_remove_owner' };

    await db.delete(memberTable).where(eq(memberTable.id, target.id));
    // member_permission_group rows cascade away via FK.

    const meta = await requestMeta();
    await recordAudit({
      orgId,
      actorUserId: session.user.id,
      action: AUDIT_ACTIONS.MEMBER_REMOVE,
      targetType: 'member',
      targetId: target.id,
      metadata: { removedUserId: target.userId, removedRole: target.role },
      ...meta,
    });

    revalidatePath('/settings/members');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown_error' };
  }
}

/**
 * Convenience: tells the UI which actions are available so it can hide the
 * role dropdown / remove button instead of letting the user click and get a
 * permission error.
 */
export async function getMyMemberCapabilities(): Promise<{
  canAssignRoles: boolean;
  canRemove: boolean;
  canInvite: boolean;
}> {
  try {
    const session = await requireSession();
    const orgId = session.session.activeOrganizationId;
    if (!orgId) return { canAssignRoles: false, canRemove: false, canInvite: false };
    const me = await findMyMember(session.user.id, orgId);
    if (!me) return { canAssignRoles: false, canRemove: false, canInvite: false };
    const [canAssignRoles, canRemove, canInvite] = await Promise.all([
      hasPermission(me.id, 'member.role.assign'),
      hasPermission(me.id, 'member.remove'),
      hasPermission(me.id, 'member.invite'),
    ]);
    return { canAssignRoles, canRemove, canInvite };
  } catch {
    return { canAssignRoles: false, canRemove: false, canInvite: false };
  }
}

export const ASSIGNABLE_ROLE_VALUES = ASSIGNABLE_ROLES;
export type { AssignableRole };

// ============================================================================
// Email invitations
// ============================================================================

const inviteSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  role: z.enum(ASSIGNABLE_ROLES),
});

export interface PendingInvitation {
  id: string;
  email: string;
  role: string | null;
  expiresAt: Date;
  status: string;
}

/**
 * Invite a new member to the active organization. Delegates to Better Auth's
 * `createInvitation` API, which inserts a row in `invitation` and triggers our
 * `sendInvitationEmail` hook (configured in lib/auth.ts) to send the email.
 *
 * If SMTP isn't configured (selfhost without email), returns a special error
 * code so the UI can show a "configure SMTP first" hint instead of a generic
 * failure.
 */
export async function inviteMember(
  input: z.input<typeof inviteSchema>,
): Promise<ActionResult> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  if (!isEmailEnabled()) {
    return { ok: false, error: 'smtp_not_configured' };
  }

  try {
    const session = await requireSession();
    const orgId = session.session.activeOrganizationId;
    if (!orgId) return { ok: false, error: 'no_active_org' };

    const me = await findMyMember(session.user.id, orgId);
    if (!me) return { ok: false, error: 'not_a_member' };
    await requirePermission(me.id, 'member.invite');

    // Reject obvious double-invites locally — Better Auth would also catch it
    // but the UI message is clearer this way.
    const [existingMember] = await db
      .select({ id: memberTable.id })
      .from(memberTable)
      .innerJoin(userTable, eq(userTable.id, memberTable.userId))
      .where(
        and(eq(memberTable.organizationId, orgId), eq(userTable.email, parsed.data.email)),
      )
      .limit(1);
    if (existingMember) return { ok: false, error: 'already_member' };

    await auth.api.createInvitation({
      headers: await nextHeaders(),
      body: {
        email: parsed.data.email,
        // Better Auth's TS type only accepts owner/admin/member by default,
        // but its runtime stores whatever string we pass into invitation.role
        // (and member.role on accept). Our 4-role model lives in the
        // role_permission_group table and works regardless. Cast to keep TS
        // happy until we wire Better Auth's `ac` access-control config.
        role: parsed.data.role as 'admin' | 'member',
        organizationId: orgId,
      },
    });

    const meta = await requestMeta();
    await recordAudit({
      orgId,
      actorUserId: session.user.id,
      action: AUDIT_ACTIONS.MEMBER_INVITE,
      targetType: 'invitation',
      metadata: { email: parsed.data.email, role: parsed.data.role },
      ...meta,
    });

    revalidatePath('/settings/members');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown_error' };
  }
}

/**
 * List pending invitations for the active organization. Includes only
 * status='pending' rows that haven't expired yet — accepted/cancelled/expired
 * are filtered out.
 */
export async function listPendingInvitations(): Promise<ActionResult<PendingInvitation[]>> {
  try {
    const session = await requireSession();
    const orgId = session.session.activeOrganizationId;
    if (!orgId) return { ok: true, data: [] };

    const rows = await db
      .select({
        id: invitationTable.id,
        email: invitationTable.email,
        role: invitationTable.role,
        expiresAt: invitationTable.expiresAt,
        status: invitationTable.status,
      })
      .from(invitationTable)
      .where(
        and(
          eq(invitationTable.organizationId, orgId),
          eq(invitationTable.status, 'pending'),
        ),
      );

    const now = Date.now();
    return {
      ok: true,
      data: rows.filter((r) => r.expiresAt.getTime() > now),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown_error' };
  }
}

/**
 * Cancel a pending invitation. Same permission as creating one.
 */
export async function cancelInvitation(invitationId: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const orgId = session.session.activeOrganizationId;
    if (!orgId) return { ok: false, error: 'no_active_org' };

    const me = await findMyMember(session.user.id, orgId);
    if (!me) return { ok: false, error: 'not_a_member' };
    await requirePermission(me.id, 'member.invite');

    // Verify the invitation belongs to this org before letting Better Auth
    // act on it — defense in depth on top of Better Auth's own checks.
    const [inv] = await db
      .select({ id: invitationTable.id, organizationId: invitationTable.organizationId })
      .from(invitationTable)
      .where(eq(invitationTable.id, invitationId))
      .limit(1);
    if (!inv || inv.organizationId !== orgId) {
      return { ok: false, error: 'invitation_not_found' };
    }

    await auth.api.cancelInvitation({
      headers: await nextHeaders(),
      body: { invitationId },
    });

    revalidatePath('/settings/members');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown_error' };
  }
}

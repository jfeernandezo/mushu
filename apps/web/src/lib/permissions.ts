import { dbAdmin } from '@mushu/db';
import { sql } from 'drizzle-orm';
import { isSelfHost } from './mode';

/**
 * Resolves whether a member has a permission, considering all three sources
 * defined in the architecture (see packages/db/drizzle/0003 migration):
 *
 *   1. Direct group memberships  (member_permission_group)
 *   2. Default groups for the member's role  (role_permission_group)
 *   3. Plan-unlocked groups for the member's org  (added in Phase 5)
 *
 * Uses dbAdmin so it bypasses RLS — this is trusted system code that needs
 * to read across the join even outside a tenant transaction context. The
 * caller does not need to wrap the call in withOrgTx.
 *
 * Returns false on lookup error rather than throwing — fail-closed is the
 * correct default for an authorisation check.
 */
export async function hasPermission(memberId: string, code: string): Promise<boolean> {
  // Self-host mode: every plan-feature permission is granted automatically.
  // Forks aren't running Stripe and shouldn't have to manage subscriptions
  // just to use AI Step or white-label. Workspace permissions still apply.
  if (isSelfHost() && code.startsWith('feature.')) {
    return true;
  }

  try {
    const rows = await dbAdmin.execute<{ has: boolean }>(sql`
      SELECT EXISTS (
        SELECT 1
        FROM permission_group_permission pgp
        WHERE pgp.permission_code = ${code}
          AND pgp.group_code IN (
            -- 1) Direct member group memberships
            SELECT group_code
              FROM member_permission_group
             WHERE member_id = ${memberId}
            UNION
            -- 2) Default groups for the member's role
            SELECT rpg.group_code
              FROM role_permission_group rpg
              JOIN member m ON m.role = rpg.role_code
             WHERE m.id = ${memberId}
            UNION
            -- 3) Plan-unlocked groups for the member's org (only counts if
            --    the subscription is in a granting status)
            SELECT ppg.group_code
              FROM plan_permission_group ppg
              JOIN subscription s ON s.plan_code = ppg.plan_code
              JOIN member m2 ON m2.organization_id = s.organization_id
             WHERE m2.id = ${memberId}
               AND s.status IN ('active', 'trialing')
          )
      ) AS has
    `);
    return Boolean(rows[0]?.has);
  } catch (e) {
    console.error('[permissions] hasPermission failed', {
      memberId,
      code,
      error: e instanceof Error ? e.message : String(e),
    });
    return false;
  }
}

/**
 * Returns every permission code the member resolves to. Useful for the
 * client-side permission context (so the UI can hide buttons without making
 * one round-trip per check) and for debugging.
 */
export async function listMemberPermissions(memberId: string): Promise<string[]> {
  try {
    const rows = await dbAdmin.execute<{ permission_code: string }>(sql`
      SELECT DISTINCT pgp.permission_code
        FROM permission_group_permission pgp
       WHERE pgp.group_code IN (
              SELECT group_code FROM member_permission_group WHERE member_id = ${memberId}
              UNION
              SELECT rpg.group_code FROM role_permission_group rpg
                JOIN member m ON m.role = rpg.role_code WHERE m.id = ${memberId}
              UNION
              SELECT ppg.group_code FROM plan_permission_group ppg
                JOIN subscription s ON s.plan_code = ppg.plan_code
                JOIN member m2 ON m2.organization_id = s.organization_id
               WHERE m2.id = ${memberId}
                 AND s.status IN ('active', 'trialing')
            )
    `);
    const perms = rows.map((r) => r.permission_code);
    // Self-host augments the list with every feature.* permission so the UI
    // doesn't hide any AI/white-label/etc. controls.
    if (isSelfHost()) {
      const selfHostFeatures = [
        'feature.ai_step',
        'feature.white_label',
        'feature.custom_subdomain',
        'feature.priority_support',
      ];
      for (const f of selfHostFeatures) {
        if (!perms.includes(f)) perms.push(f);
      }
    }
    return perms;
  } catch (e) {
    console.error('[permissions] listMemberPermissions failed', {
      memberId,
      error: e instanceof Error ? e.message : String(e),
    });
    return [];
  }
}

/**
 * Throws PermissionDeniedError when the member lacks the permission. Use in
 * Server Actions as the first line after resolving the session/member, so the
 * action fails before performing any side-effect:
 *
 *   await requirePermission(memberId, 'flow.delete');
 *
 * The thrown error is meant to bubble up to the caller's try/catch — surface
 * it as a generic "you can't do that" message rather than echoing the code,
 * to avoid leaking the permission catalog to the UI.
 */
export class PermissionDeniedError extends Error {
  readonly code = 'permission_denied';
  constructor(public readonly permission: string) {
    super(`Permission denied: ${permission}`);
    this.name = 'PermissionDeniedError';
  }
}

export async function requirePermission(memberId: string, code: string): Promise<void> {
  const ok = await hasPermission(memberId, code);
  if (!ok) throw new PermissionDeniedError(code);
}

/**
 * Resets a member's group memberships to match a new role. Used by the
 * member-management UI when an admin changes someone's role from, say,
 * 'editor' to 'admin'. Drops all existing rows in member_permission_group
 * for this member, then re-inserts the role's default groups.
 *
 * Custom direct-group assignments are wiped — this is intentional, since
 * roles are the canonical source of group membership in v1. A future "fine
 * tune permissions" UI could add direct groups on top, but they'd need to
 * be re-applied after every role change for now.
 */
export async function resetMemberGroupsForRole(
  memberId: string,
  organizationId: string,
  roleCode: string,
): Promise<void> {
  await dbAdmin.execute(sql`
    DELETE FROM member_permission_group WHERE member_id = ${memberId}
  `);
  await dbAdmin.execute(sql`
    INSERT INTO member_permission_group (member_id, group_code, organization_id)
      SELECT ${memberId}, rpg.group_code, ${organizationId}
        FROM role_permission_group rpg
       WHERE rpg.role_code = ${roleCode}
      ON CONFLICT DO NOTHING
  `);
}

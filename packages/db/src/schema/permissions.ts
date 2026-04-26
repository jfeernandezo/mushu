import { boolean, index, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import { member, organization } from './auth.ts';

/**
 * Granular permissions catalog and group system.
 *
 * Architecture rule: roles are *identity*, never access rules. All access
 * checks resolve through permission groups. A permission resolves true if
 * it belongs to ANY group reached via:
 *
 *   1. member_permission_group  (user explicitly added to a group)
 *   2. role_permission_group    (user's role string maps to default groups)
 *   3. plan_permission_group    (org's subscription unlocks plan groups)
 *
 * The runtime resolver lives in apps/web/src/lib/permissions.ts.
 */

/**
 * Catalog of every permission code that exists. Seeded by the 0003 migration;
 * extended in future migrations as new features land. Codes follow the
 * pattern <area>.<action>, e.g. 'flow.delete' or 'feature.ai_step'.
 *
 * scope = 'workspace' | 'feature' | 'system'
 *   - workspace: action a member performs (flow.delete, member.invite)
 *   - feature:   capability unlocked by the org's plan (feature.ai_step)
 *   - system:    reserved for future global ops (e.g. operator-level admin)
 */
export const permission = pgTable('permission', {
  code: text('code').primaryKey(),
  description: text('description').notNull(),
  scope: text('scope', { enum: ['workspace', 'feature', 'system'] }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/**
 * Named bundles of permissions. The only thing roles, members, and plans
 * are allowed to grant — never individual permissions directly.
 *
 * is_system = true means we shipped the group in a migration and the UI
 * shouldn't let users delete it.
 */
export const permissionGroup = pgTable('permission_group', {
  code: text('code').primaryKey(),
  description: text('description').notNull(),
  isSystem: boolean('is_system').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const permissionGroupPermission = pgTable(
  'permission_group_permission',
  {
    groupCode: text('group_code')
      .notNull()
      .references(() => permissionGroup.code, { onDelete: 'cascade' }),
    permissionCode: text('permission_code')
      .notNull()
      .references(() => permission.code, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.groupCode, t.permissionCode] }),
  }),
);

/**
 * Default groups granted automatically when a member has this role string.
 * The role values are *identity labels* that surface in the UI ("Admin",
 * "Editor"); they never carry permissions on their own.
 */
export const rolePermissionGroup = pgTable(
  'role_permission_group',
  {
    roleCode: text('role_code').notNull(),
    groupCode: text('group_code')
      .notNull()
      .references(() => permissionGroup.code, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.roleCode, t.groupCode] }),
  }),
);

/**
 * Direct group assignments per member, scoped to one organization. A user
 * who's a member of two orgs has independent rows here for each.
 *
 * organizationId is denormalized (also lives on `member`) so RLS policies
 * can scope without joining. RLS is enabled on this table only — the catalog
 * tables above are global.
 */
export const memberPermissionGroup = pgTable(
  'member_permission_group',
  {
    memberId: text('member_id')
      .notNull()
      .references(() => member.id, { onDelete: 'cascade' }),
    groupCode: text('group_code')
      .notNull()
      .references(() => permissionGroup.code, { onDelete: 'cascade' }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.memberId, t.groupCode] }),
    orgIdx: index('member_permission_group_org_idx').on(t.organizationId),
    memberIdx: index('member_permission_group_member_idx').on(t.memberId),
  }),
);

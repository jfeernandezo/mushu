'use server';

import {
  account as accountTable,
  contact as contactTable,
  contactTag as contactTagTable,
  conversation as conversationTable,
  db,
  flow as flowTable,
  instagramAccount as instagramAccountTable,
  member as memberTable,
  message as messageTable,
  notification as notificationTable,
  organization as organizationTable,
  session as sessionTable,
  user as userTable,
  withOrgTx,
} from '@mushu/db';
import { eq, inArray } from 'drizzle-orm';
import { headers as nextHeaders } from 'next/headers';
import { AUDIT_ACTIONS, recordAudit, requestMeta } from '@/lib/audit';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { getRedis } from '@/lib/redis';

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

const RATE_LIMIT_WINDOW_SECONDS = 60 * 60; // 1 export per hour per user

/**
 * Builds a JSON snapshot of every personal data point Mushu holds about the
 * caller, for LGPD art. 18 V (data portability). Includes:
 *   - the user record + sessions + auth providers (NO password / token values)
 *   - org memberships
 *   - for orgs the caller OWNS: connected IG accounts (NO tokens), contacts,
 *     contact tags, conversations, messages, flows, notifications
 *
 * Members who are NOT owners only get their own user data + the list of orgs
 * they belong to — workspace data belongs to the owner. This keeps a
 * disgruntled team-member from siphoning the org via export.
 */
export async function exportMyData(): Promise<ActionResult<Record<string, unknown>>> {
  const session = await auth.api.getSession({ headers: await nextHeaders() });
  if (!session) return { ok: false, error: 'unauthenticated' };

  const userId = session.user.id;

  // Per-user rate limit: 1 export per hour. Prevents accidental abuse and
  // also caps load — exports may scan many tables for power users.
  const redis = getRedis();
  const rlKey = `rl:export:${userId}`;
  const set = await redis.set(rlKey, '1', 'EX', RATE_LIMIT_WINDOW_SECONDS, 'NX');
  if (set === null) {
    return { ok: false, error: 'rate_limited' };
  }

  const [me] = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      emailVerified: userTable.emailVerified,
      image: userTable.image,
      locale: userTable.locale,
      theme: userTable.theme,
      createdAt: userTable.createdAt,
      updatedAt: userTable.updatedAt,
    })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);

  if (!me) return { ok: false, error: 'user_not_found' };

  const sessions = await db
    .select({
      id: sessionTable.id,
      ipAddress: sessionTable.ipAddress,
      userAgent: sessionTable.userAgent,
      createdAt: sessionTable.createdAt,
      updatedAt: sessionTable.updatedAt,
      expiresAt: sessionTable.expiresAt,
    })
    .from(sessionTable)
    .where(eq(sessionTable.userId, userId));

  const accounts = await db
    .select({
      providerId: accountTable.providerId,
      accountId: accountTable.accountId,
      scope: accountTable.scope,
      createdAt: accountTable.createdAt,
    })
    .from(accountTable)
    .where(eq(accountTable.userId, userId));

  const memberships = await db
    .select({
      memberId: memberTable.id,
      organizationId: memberTable.organizationId,
      role: memberTable.role,
      organizationName: organizationTable.name,
      organizationSlug: organizationTable.slug,
      joinedAt: memberTable.createdAt,
    })
    .from(memberTable)
    .innerJoin(organizationTable, eq(organizationTable.id, memberTable.organizationId))
    .where(eq(memberTable.userId, userId));

  // Workspaces this user can dump in full are determined by the
  // `workspace.export_full_data` permission, NOT by hardcoding role === 'owner'.
  // The default mapping (workspace_owner_group includes this permission) means
  // owners get full export today, but the gate is now the right one to extend
  // (e.g. enterprise plans could grant the permission to admins too).
  const exportableOrgIds: string[] = [];
  for (const m of memberships) {
    if (await hasPermission(m.memberId, 'workspace.export_full_data')) {
      exportableOrgIds.push(m.organizationId);
    }
  }

  const ownedWorkspaces: Record<string, unknown>[] = [];
  for (const orgId of exportableOrgIds) {
    const wsData = await withOrgTx(orgId, async (tx) => {
      const igAccounts = await tx
        .select({
          id: instagramAccountTable.id,
          igUserId: instagramAccountTable.igUserId,
          igUsername: instagramAccountTable.igUsername,
          pageId: instagramAccountTable.pageId,
          expiresAt: instagramAccountTable.expiresAt,
          webhookSubscribed: instagramAccountTable.webhookSubscribed,
          createdAt: instagramAccountTable.createdAt,
        })
        .from(instagramAccountTable)
        .where(eq(instagramAccountTable.organizationId, orgId));

      const contacts = await tx
        .select()
        .from(contactTable)
        .where(eq(contactTable.organizationId, orgId));
      const contactIds = contacts.map((c) => c.id);

      const tags = contactIds.length
        ? await tx
            .select()
            .from(contactTagTable)
            .where(inArray(contactTagTable.contactId, contactIds))
        : [];

      const conversations = await tx
        .select()
        .from(conversationTable)
        .where(eq(conversationTable.organizationId, orgId));
      const conversationIds = conversations.map((c) => c.id);

      const messages = conversationIds.length
        ? await tx
            .select()
            .from(messageTable)
            .where(inArray(messageTable.conversationId, conversationIds))
        : [];

      const flows = await tx
        .select()
        .from(flowTable)
        .where(eq(flowTable.organizationId, orgId));

      const notifications = await tx
        .select()
        .from(notificationTable)
        .where(eq(notificationTable.organizationId, orgId));

      return { igAccounts, contacts, tags, conversations, messages, flows, notifications };
    });

    ownedWorkspaces.push({
      organizationId: orgId,
      instagramAccounts: wsData.igAccounts,
      contacts: wsData.contacts,
      contactTags: wsData.tags,
      conversations: wsData.conversations,
      messages: wsData.messages,
      flows: wsData.flows,
      notifications: wsData.notifications,
    });
  }

  const exportPayload = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    user: me,
    sessions,
    authProviders: accounts,
    organizations: memberships,
    ownedWorkspaces,
  };

  const meta = await requestMeta();
  await recordAudit({
    orgId: session.session.activeOrganizationId ?? null,
    actorUserId: userId,
    action: AUDIT_ACTIONS.USER_DATA_EXPORT,
    targetType: 'user',
    targetId: userId,
    metadata: {
      exportedWorkspacesCount: ownedWorkspaces.length,
      memberOf: memberships.length,
    },
    ...meta,
  });

  return { ok: true, data: exportPayload };
}

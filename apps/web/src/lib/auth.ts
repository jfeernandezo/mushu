import {
  db,
  member,
  memberPermissionGroup,
  organization as orgTable,
  user as userTable,
} from '@mushu/db';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { organization } from 'better-auth/plugins';
import { eq } from 'drizzle-orm';
import { ensureSubscription } from './plan';

const baseURL = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000';

/**
 * Ensures the given user has at least one organization (workspace) and returns
 * its ID. If the user already has a membership, returns the first one. If not,
 * creates a default workspace and adds the user as owner.
 *
 * Mushu scopes most resources (IG accounts, flows, contacts) by org, so a user
 * without an org effectively can't use the app.
 */
export async function ensureUserOrg(userId: string): Promise<string> {
  const existing = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, userId))
    .limit(1);
  if (existing[0]) return existing[0].organizationId;

  const u = await db
    .select({ name: userTable.name })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);

  const orgId = crypto.randomUUID();
  const slug = `ws-${orgId.slice(0, 8)}`;
  const trimmedName = u[0]?.name?.trim();
  const name = trimmedName ? `${trimmedName}'s workspace` : 'My workspace';

  const memberId = crypto.randomUUID();
  await db.insert(orgTable).values({ id: orgId, name, slug });
  await db.insert(member).values({
    id: memberId,
    organizationId: orgId,
    userId,
    role: 'owner',
  });
  // Grant the owner's default permission group inline. The granular permissions
  // system (see migration 0003) keys all access checks off membership in groups,
  // not the role string itself — without this row, the owner would have the
  // 'owner' label but zero permissions on first request.
  await db.insert(memberPermissionGroup).values({
    memberId,
    organizationId: orgId,
    groupCode: 'workspace_owner_group',
  });

  // Every org needs a subscription row so the plan resolver always has
  // something to read. New orgs default to Free; upgrades happen via Stripe
  // checkout (see /api/billing/checkout).
  await ensureSubscription(orgId);

  return orgId;
}

export const auth = betterAuth({
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    // Enable self-service delete (Phase B). Requires the user's password.
    // No verification email — we don't have email infra wired up yet.
    deleteUser: { enabled: true },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (sessionData) => {
          if (!sessionData.activeOrganizationId) {
            const orgId = await ensureUserOrg(sessionData.userId);
            return { data: { ...sessionData, activeOrganizationId: orgId } };
          }
        },
      },
    },
  },
  plugins: [organization()],
});

export type Session = typeof auth.$Infer.Session;

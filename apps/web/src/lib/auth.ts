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
import { sendEmail } from './email';
import {
  invitationEmail,
  resetPasswordEmail,
  verificationEmail,
} from './email-templates';
import { isHosted } from './mode';
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
    // Hosted mode requires email verification before login (App Review hygiene
    // signal — also kills throwaway-email signup spam). Selfhost forks can opt
    // in by setting MUSHU_REQUIRE_EMAIL_VERIFICATION=true.
    requireEmailVerification:
      isHosted() || process.env.MUSHU_REQUIRE_EMAIL_VERIFICATION === 'true',
    sendResetPassword: async ({ user, url }) => {
      const tpl = resetPasswordEmail(url, user.name);
      await sendEmail({
        to: user.email,
        subject: tpl.subject,
        html: tpl.html,
        messageType: 'reset_password',
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      const tpl = verificationEmail(url, user.name);
      await sendEmail({
        to: user.email,
        subject: tpl.subject,
        html: tpl.html,
        messageType: 'verification',
      });
    },
  },
  user: {
    // Enable self-service delete (Phase B). Requires the user's password.
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
  plugins: [
    organization({
      // Workspace invitations: Better Auth creates the row in `invitation` and
      // returns the link; we send it via SMTP. Recipient lands on
      // /accept-invitation/[token] which calls auth.api.acceptInvitation.
      async sendInvitationEmail(data) {
        const url = `${baseURL}/accept-invitation/${data.id}`;
        const tpl = invitationEmail({
          url,
          inviterName: data.inviter.user.name,
          inviterEmail: data.inviter.user.email,
          organizationName: data.organization.name,
          role: data.role,
        });
        await sendEmail({
          to: data.email,
          subject: tpl.subject,
          html: tpl.html,
          messageType: 'invitation',
        });
      },
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;

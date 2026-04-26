'use server';

import { db, session as sessionTable } from '@mushu/db';
import { and, eq, ne } from 'drizzle-orm';
import { headers as nextHeaders } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { AUDIT_ACTIONS, recordAudit, requestMeta } from '@/lib/audit';

type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

async function requireSession() {
  const session = await auth.api.getSession({ headers: await nextHeaders() });
  if (!session) throw new Error('unauthenticated');
  return session;
}

// ---------- Profile ----------

const profileSchema = z.object({
  name: z.string().trim().min(1).max(100),
  image: z
    .string()
    .trim()
    .url()
    .or(z.literal(''))
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
});

export async function updateProfile(
  input: z.input<typeof profileSchema>,
): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };
  try {
    const { user, session } = await requireSession();
    await auth.api.updateUser({
      headers: await nextHeaders(),
      body: { name: parsed.data.name, image: parsed.data.image ?? null },
    });
    const meta = await requestMeta();
    await recordAudit({
      orgId: session.activeOrganizationId ?? null,
      actorUserId: user.id,
      action: AUDIT_ACTIONS.USER_PROFILE_UPDATE,
      targetType: 'user',
      targetId: user.id,
      metadata: { fields: Object.keys(parsed.data) },
      ...meta,
    });
    revalidatePath('/settings/profile');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: messageOf(e) };
  }
}

// ---------- Password ----------

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
  revokeOtherSessions: z.boolean().optional(),
});

export async function changePassword(
  input: z.input<typeof passwordSchema>,
): Promise<ActionResult> {
  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };
  try {
    const { user, session } = await requireSession();
    await auth.api.changePassword({
      headers: await nextHeaders(),
      body: parsed.data,
    });
    const meta = await requestMeta();
    await recordAudit({
      orgId: session.activeOrganizationId ?? null,
      actorUserId: user.id,
      action: AUDIT_ACTIONS.USER_PASSWORD_CHANGE,
      targetType: 'user',
      targetId: user.id,
      metadata: { revokeOtherSessions: parsed.data.revokeOtherSessions ?? false },
      ...meta,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: messageOf(e) };
  }
}

// ---------- Sessions ----------

export interface SessionRow {
  id: string;
  isCurrent: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export async function listMySessions(): Promise<ActionResult<SessionRow[]>> {
  try {
    const { session } = await requireSession();
    const rows = await db
      .select({
        id: sessionTable.id,
        userId: sessionTable.userId,
        ipAddress: sessionTable.ipAddress,
        userAgent: sessionTable.userAgent,
        createdAt: sessionTable.createdAt,
        updatedAt: sessionTable.updatedAt,
        expiresAt: sessionTable.expiresAt,
      })
      .from(sessionTable)
      .where(eq(sessionTable.userId, session.userId))
      .orderBy(sessionTable.updatedAt);

    return {
      ok: true,
      data: rows
        .map((r) => ({
          id: r.id,
          isCurrent: r.id === session.id,
          ipAddress: r.ipAddress,
          userAgent: r.userAgent,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          expiresAt: r.expiresAt,
        }))
        // Current session first, then most recently active.
        .sort((a, b) => {
          if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
          return b.updatedAt.getTime() - a.updatedAt.getTime();
        }),
    };
  } catch (e) {
    return { ok: false, error: messageOf(e) };
  }
}

export async function revokeSessionById(sessionId: string): Promise<ActionResult> {
  try {
    const { session } = await requireSession();
    if (sessionId === session.id) {
      return { ok: false, error: 'cannot_revoke_current_session' };
    }
    await db
      .delete(sessionTable)
      .where(and(eq(sessionTable.id, sessionId), eq(sessionTable.userId, session.userId)));
    const meta = await requestMeta();
    await recordAudit({
      orgId: session.activeOrganizationId ?? null,
      actorUserId: session.userId,
      action: AUDIT_ACTIONS.SESSION_REVOKE,
      targetType: 'session',
      targetId: sessionId,
      ...meta,
    });
    revalidatePath('/settings/sessions');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: messageOf(e) };
  }
}

export async function revokeAllOtherSessions(): Promise<ActionResult> {
  try {
    const { session } = await requireSession();
    await db
      .delete(sessionTable)
      .where(and(eq(sessionTable.userId, session.userId), ne(sessionTable.id, session.id)));
    const meta = await requestMeta();
    await recordAudit({
      orgId: session.activeOrganizationId ?? null,
      actorUserId: session.userId,
      action: AUDIT_ACTIONS.SESSION_REVOKE_ALL,
      targetType: 'user',
      targetId: session.userId,
      ...meta,
    });
    revalidatePath('/settings/sessions');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: messageOf(e) };
  }
}

// ---------- Delete account ----------

const deleteSchema = z.object({
  confirmEmail: z.string().email(),
  password: z.string().min(1),
});

export async function deleteAccount(
  input: z.input<typeof deleteSchema>,
): Promise<ActionResult> {
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };
  try {
    const { user, session } = await requireSession();
    if (parsed.data.confirmEmail.toLowerCase() !== user.email.toLowerCase()) {
      return { ok: false, error: 'email_mismatch' };
    }
    // Record audit BEFORE deletion — afterward the FK chain wipes session/account
    // and the user row is gone. orgId is set to null because cascade will drop
    // the organization too (if user is sole owner) and we don't want a dangling FK.
    const meta = await requestMeta();
    await recordAudit({
      orgId: null,
      actorUserId: null,
      action: AUDIT_ACTIONS.USER_DELETE,
      targetType: 'user',
      targetId: user.id,
      metadata: {
        email: user.email,
        organizationId: session.activeOrganizationId ?? null,
      },
      ...meta,
    });
    await auth.api.deleteUser({
      headers: await nextHeaders(),
      body: { password: parsed.data.password },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: messageOf(e) };
  }
}

// ---------- Helpers ----------

function messageOf(e: unknown): string {
  if (e instanceof Error) return e.message || 'unknown_error';
  if (typeof e === 'object' && e !== null && 'message' in e && typeof e.message === 'string') {
    return e.message;
  }
  return 'unknown_error';
}

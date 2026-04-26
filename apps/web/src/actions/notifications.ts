'use server';

import { db, notification } from '@mushu/db';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { headers as nextHeaders } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
}

async function requireSession() {
  const s = await auth.api.getSession({ headers: await nextHeaders() });
  if (!s) throw new Error('unauthenticated');
  return s;
}

export async function listNotifications(opts: {
  limit?: number;
  onlyUnread?: boolean;
}): Promise<{ ok: true; data: NotificationRow[] } | { ok: false; error: string }> {
  try {
    const session = await requireSession();
    const orgId = session.session.activeOrganizationId;
    if (!orgId) return { ok: true, data: [] };

    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
    const where = opts.onlyUnread
      ? and(eq(notification.organizationId, orgId), isNull(notification.readAt))
      : eq(notification.organizationId, orgId);

    const rows = await db
      .select({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        link: notification.link,
        readAt: notification.readAt,
        createdAt: notification.createdAt,
      })
      .from(notification)
      .where(where)
      .orderBy(desc(notification.createdAt))
      .limit(limit);

    return { ok: true, data: rows };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown_error' };
  }
}

export async function unreadCount(): Promise<number> {
  try {
    const session = await requireSession();
    const orgId = session.session.activeOrganizationId;
    if (!orgId) return 0;
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notification)
      .where(and(eq(notification.organizationId, orgId), isNull(notification.readAt)));
    return row?.count ?? 0;
  } catch {
    return 0;
  }
}

export async function markAsRead(id: string): Promise<{ ok: boolean }> {
  try {
    const session = await requireSession();
    const orgId = session.session.activeOrganizationId;
    if (!orgId) return { ok: false };
    await db
      .update(notification)
      .set({ readAt: new Date() })
      .where(and(eq(notification.id, id), eq(notification.organizationId, orgId)));
    revalidatePath('/notifications');
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function markAllAsRead(): Promise<{ ok: boolean }> {
  try {
    const session = await requireSession();
    const orgId = session.session.activeOrganizationId;
    if (!orgId) return { ok: false };
    await db
      .update(notification)
      .set({ readAt: new Date() })
      .where(and(eq(notification.organizationId, orgId), isNull(notification.readAt)));
    revalidatePath('/notifications');
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

'use server';

import { conversation, flow, message, withOrgTx } from '@mushu/db';
import { and, eq, gte, sql } from 'drizzle-orm';

export interface DashboardStats {
  commentsRespondedDay: number;
  dmsSentDay: number;
  activeContactsWeek: number;
  liveFlows: number;
}

export async function getDashboardStats(orgId: string): Promise<DashboardStats> {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  return withOrgTx(orgId, async (tx) => {
    const [commentsRow] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(message)
      .where(
        and(
          eq(message.organizationId, orgId),
          eq(message.messageType, 'activity'),
          eq(message.status, 'sent'),
          gte(message.createdAt, dayAgo),
        ),
      );

    const [dmsRow] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(message)
      .where(
        and(
          eq(message.organizationId, orgId),
          eq(message.messageType, 'outgoing'),
          eq(message.status, 'sent'),
          gte(message.createdAt, dayAgo),
        ),
      );

    const [activeRow] = await tx
      .select({ n: sql<number>`count(distinct ${conversation.contactId})::int` })
      .from(conversation)
      .where(
        and(eq(conversation.organizationId, orgId), gte(conversation.lastActivityAt, weekAgo)),
      );

    const [flowsRow] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(flow)
      .where(and(eq(flow.organizationId, orgId), eq(flow.isEnabled, true)));

    return {
      commentsRespondedDay: commentsRow?.n ?? 0,
      dmsSentDay: dmsRow?.n ?? 0,
      activeContactsWeek: activeRow?.n ?? 0,
      liveFlows: flowsRow?.n ?? 0,
    };
  });
}

export interface ChartPoint {
  day: string;
  current: number;
  previous: number;
}

export async function getMessagesChartData(_orgId: string): Promise<ChartPoint[]> {
  // MVP: return zeros for last 7 days. Real query will join message + dates.
  // Filling in real data is a v0.2 polish item.
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return labels.map((day) => ({ day, current: 0, previous: 0 }));
}

export interface TopTriggerRow {
  label: string;
  fires: number;
  pct: number;
}

export async function getTopTriggers(_orgId: string, _limit = 5): Promise<TopTriggerRow[]> {
  // MVP: return empty. Implementation requires a counter table or
  // aggregating flow_executions by trigger_id, which we'll wire in v0.2.
  return [];
}

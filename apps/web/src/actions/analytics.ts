'use server';

import { flow, flowExecution, flowStepEvent, withOrgTx } from '@mushu/db';
import { and, eq, gte, sql } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { buildFlowAnalytics, type StepCount } from '@/lib/flow-analytics';

export async function getFlowAnalytics(period: number) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');
  const orgId = session.session.activeOrganizationId;
  if (!orgId) return null;
  const days = period === 30 ? 30 : 7;
  const since = new Date(Date.now() - days * 86_400_000);

  return withOrgTx(orgId, async (tx) => {
    const flows = await tx
      .select({ id: flow.id, name: flow.name, graph: flow.publishedGraph })
      .from(flow)
      .where(eq(flow.organizationId, orgId))
      .orderBy(flow.name);
    // Cohort: every metric refers to executions STARTED in this period.
    // Aggregate separately so joining multiple steps/clicks never multiplies runs.
    const executions = await tx
      .select({
        flowId: flowExecution.flowId,
        started: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where ${flowExecution.status} = 'done')::int`,
        failed: sql<number>`count(*) filter (where ${flowExecution.status} = 'failed')::int`,
      })
      .from(flowExecution)
      .where(and(eq(flowExecution.organizationId, orgId), gte(flowExecution.startedAt, since)))
      .groupBy(flowExecution.flowId);
    const steps: StepCount[] = await tx
      .select({
        flowId: flowStepEvent.flowId,
        nodeId: flowStepEvent.nodeId,
        nodeType: flowStepEvent.nodeType,
        outcome: flowStepEvent.outcome,
        count: sql<number>`count(*)::int`,
      })
      .from(flowStepEvent)
      .innerJoin(flowExecution, eq(flowExecution.id, flowStepEvent.executionId))
      .where(
        and(
          eq(flowStepEvent.organizationId, orgId),
          eq(flowExecution.organizationId, orgId),
          gte(flowExecution.startedAt, since),
        ),
      )
      .groupBy(
        flowStepEvent.flowId,
        flowStepEvent.nodeId,
        flowStepEvent.nodeType,
        flowStepEvent.outcome,
      );
    return buildFlowAnalytics(flows, executions, steps);
  });
}

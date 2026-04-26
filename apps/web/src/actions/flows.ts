'use server';

import { randomUUID } from 'node:crypto';
import { db, flow, trigger } from '@mushu/db';
import { type FlowGraph, flowGraphSchema, isTriggerNode } from '@mushu/shared/flow';
import { and, eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { getTemplate, type TemplateTexts } from '@/lib/flow-templates';

async function requireOrgId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');
  const orgId = session.session.activeOrganizationId;
  if (!orgId) throw new Error('no_active_organization');
  return orgId;
}

export async function createFlow(
  name: string,
  options?: { templateId?: string; templateTexts?: TemplateTexts },
): Promise<{ id: string }> {
  const orgId = await requireOrgId();
  const id = randomUUID();

  let draftGraph: FlowGraph | null = null;
  if (options?.templateId && options.templateTexts) {
    const template = getTemplate(options.templateId);
    if (template) {
      draftGraph = template.build(options.templateTexts);
    }
  }

  await db.insert(flow).values({
    id,
    organizationId: orgId,
    name: name.trim() || 'Untitled flow',
    ...(draftGraph ? { draftGraph } : {}),
  });
  revalidatePath('/flows');
  return { id };
}

export async function deleteFlow(flowId: string): Promise<void> {
  const orgId = await requireOrgId();
  // Triggers reference flow via FK; delete them first since the schema may not
  // declare ON DELETE CASCADE on every relation.
  await db.delete(trigger).where(eq(trigger.flowId, flowId));
  await db.delete(flow).where(and(eq(flow.id, flowId), eq(flow.organizationId, orgId)));
  revalidatePath('/flows');
}

export async function saveFlowDraft(flowId: string, graphJson: unknown): Promise<void> {
  const orgId = await requireOrgId();
  const parsed = flowGraphSchema.safeParse(graphJson);
  if (!parsed.success) {
    throw new Error(`invalid_graph: ${parsed.error.message}`);
  }
  await db
    .update(flow)
    .set({ draftGraph: parsed.data, updatedAt: new Date() })
    .where(and(eq(flow.id, flowId), eq(flow.organizationId, orgId)));
  revalidatePath(`/flows/${flowId}`);
}

export async function publishFlow(flowId: string): Promise<{ version: number }> {
  const orgId = await requireOrgId();

  const [row] = await db
    .select({
      id: flow.id,
      draftGraph: flow.draftGraph,
      publishVersion: flow.publishVersion,
      instagramAccountId: flow.instagramAccountId,
    })
    .from(flow)
    .where(and(eq(flow.id, flowId), eq(flow.organizationId, orgId)))
    .limit(1);

  if (!row) throw new Error('flow_not_found');

  const parsed = flowGraphSchema.safeParse(row.draftGraph);
  if (!parsed.success) throw new Error(`invalid_draft_graph: ${parsed.error.message}`);
  const graph: FlowGraph = parsed.data;

  const newVersion = row.publishVersion + 1;
  await db
    .update(flow)
    .set({
      publishedGraph: graph,
      publishVersion: newVersion,
      isEnabled: true,
      publishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(flow.id, flowId));

  // Sync triggers table from the published graph.
  if (row.instagramAccountId) {
    await syncTriggersFromGraph(flowId, row.instagramAccountId, graph);
  }

  revalidatePath('/flows');
  revalidatePath(`/flows/${flowId}`);
  return { version: newVersion };
}

export async function setFlowEnabled(flowId: string, enabled: boolean): Promise<void> {
  const orgId = await requireOrgId();
  await db
    .update(flow)
    .set({ isEnabled: enabled, updatedAt: new Date() })
    .where(and(eq(flow.id, flowId), eq(flow.organizationId, orgId)));
  revalidatePath('/flows');
}

async function syncTriggersFromGraph(
  flowId: string,
  instagramAccountId: string,
  graph: FlowGraph,
): Promise<void> {
  // Strategy: delete all existing triggers for this flow, re-insert from graph.
  // Trade-off: simpler than diffing, slightly more churn. OK for MVP scale.
  await db.delete(trigger).where(eq(trigger.flowId, flowId));

  const triggerNodes = graph.nodes.filter(isTriggerNode);
  for (const node of triggerNodes) {
    if (node.type === 'trigger.comment_keyword') {
      await db.insert(trigger).values({
        id: randomUUID(),
        flowId,
        instagramAccountId,
        type: 'comment_keyword',
        instagramPostId: node.data.instagramPostId,
        config: {
          keywords: node.data.keywords,
          matchMode: node.data.matchMode,
          caseSensitive: node.data.caseSensitive,
        },
      });
    }
    if (node.type === 'trigger.dm_keyword') {
      await db.insert(trigger).values({
        id: randomUUID(),
        flowId,
        instagramAccountId,
        type: 'dm_keyword',
        config: {
          keywords: node.data.keywords,
          matchMode: node.data.matchMode,
          caseSensitive: node.data.caseSensitive,
        },
      });
    }
  }
}

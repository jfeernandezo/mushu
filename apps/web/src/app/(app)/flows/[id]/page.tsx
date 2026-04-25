import { db, flow } from '@mushu/db';
import { type FlowGraph, flowGraphSchema } from '@mushu/shared/flow';
import { and, eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { FlowBuilder } from '@/components/flow-builder/flow-builder';
import { auth } from '@/lib/auth';

const EMPTY_GRAPH: FlowGraph = { nodes: [], edges: [] };

export default async function FlowEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');
  const orgId = session.session.activeOrganizationId;
  if (!orgId) redirect('/');

  const [row] = await db
    .select({
      id: flow.id,
      name: flow.name,
      draftGraph: flow.draftGraph,
      isEnabled: flow.isEnabled,
    })
    .from(flow)
    .where(and(eq(flow.id, id), eq(flow.organizationId, orgId)))
    .limit(1);

  if (!row) notFound();

  const parsed = flowGraphSchema.safeParse(row.draftGraph);
  const initialGraph = parsed.success ? parsed.data : EMPTY_GRAPH;

  return (
    <FlowBuilder
      flowId={row.id}
      flowName={row.name}
      initialGraph={initialGraph}
      isEnabled={row.isEnabled}
    />
  );
}

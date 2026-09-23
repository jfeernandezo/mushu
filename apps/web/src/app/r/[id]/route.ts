import { randomUUID } from 'node:crypto';
import { dbAdmin, flowExecution, flowStepEvent, trackedLink } from '@mushu/db';
import { and, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return new Response('Not found', { status: 404 });
  }
  // Public capability URL: resolve only this opaque token via the admin client.
  // Never accept an organization or redirect destination from the request.
  const [row] = await dbAdmin
    .select({ link: trackedLink, flowId: flowExecution.flowId })
    .from(trackedLink)
    .innerJoin(
      flowExecution,
      and(
        eq(flowExecution.id, trackedLink.executionId),
        eq(flowExecution.organizationId, trackedLink.organizationId),
      ),
    )
    .where(eq(trackedLink.id, id))
    .limit(1);
  if (!row) return new Response('Not found', { status: 404 });
  let destination: URL;
  try {
    destination = new URL(row.link.url);
    if (!['http:', 'https:'].includes(destination.protocol)) throw new Error('invalid protocol');
  } catch {
    return new Response('Invalid destination', { status: 410 });
  }
  await dbAdmin.insert(flowStepEvent).values({
    id: randomUUID(),
    organizationId: row.link.organizationId,
    flowId: row.flowId,
    executionId: row.link.executionId,
    nodeId: row.link.nodeId,
    nodeType: 'action.send_dm',
    outcome: 'click',
  });
  return new Response(null, {
    status: 302,
    headers: {
      Location: destination.href,
      'Cache-Control': 'no-store, private',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

// Link previews using HEAD must not increment clicks.
export async function HEAD() {
  return new Response(null, {
    status: 405,
    headers: { Allow: 'GET', 'Cache-Control': 'no-store' },
  });
}

import { dbAdmin as db, flowStepEvent } from '@mushu/db';
import { and, eq, ne } from 'drizzle-orm';

export async function setStepOutcome(executionId: string, nodeId: string, outcome: string) {
  await db
    .update(flowStepEvent)
    .set({ outcome })
    .where(
      and(
        eq(flowStepEvent.executionId, executionId),
        eq(flowStepEvent.nodeId, nodeId),
        ne(flowStepEvent.outcome, 'click'),
      ),
    );
}

import { dbAdmin as db, incomingEvent } from '@mushu/db';
import { createLogger } from '@mushu/shared/logger';
import { lt, sql } from 'drizzle-orm';

const logger = createLogger('worker.sweep-events');

const RETENTION_DAYS = 90;
const BATCH_SIZE = 5000;
const MAX_BATCHES_PER_RUN = 50; // safety cap — 250k rows max per daily run

/**
 * Daily retention sweep for `incoming_event`. Webhook traffic accumulates
 * fast (~100-1000 rows/day per active IG account) and the JSONB payloads are
 * heavy. Keeping 90 days is enough for replay/debugging — anything older
 * gets purged.
 *
 * Implementation:
 *   - Cap batch size at 5k to avoid long-running locks on the table.
 *   - Loop until either nothing more to delete OR we hit the safety cap
 *     (250k rows). The cap protects against a runaway delete blocking the
 *     queue worker for too long. Whatever's left gets picked up tomorrow.
 *
 * Index: requires `incoming_event_created_at_idx` (migration 0006). Without
 * it, this becomes a full table scan every run.
 */
export async function sweepIncomingEvents(): Promise<void> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  let totalDeleted = 0;
  let batches = 0;

  while (batches < MAX_BATCHES_PER_RUN) {
    // Subquery selects the IDs to delete in this batch — gives us a
    // predictable, bounded operation instead of relying on `LIMIT` semantics
    // on DELETE (which Postgres doesn't support directly).
    const result = await db.execute<{ id: string }>(sql`
      DELETE FROM "incoming_event"
       WHERE "id" IN (
         SELECT "id" FROM "incoming_event"
          WHERE "created_at" < ${cutoff}
          ORDER BY "created_at"
          LIMIT ${BATCH_SIZE}
       )
       RETURNING "id"
    `);
    // postgres-js returns rows directly as an array; RETURNING gives us one
    // row per deleted record.
    const removed = result.length;
    totalDeleted += removed;
    batches += 1;
    if (removed < BATCH_SIZE) break;
  }

  logger.info(
    { cutoff: cutoff.toISOString(), batches, total_deleted: totalDeleted },
    'sweep complete',
  );

  // Reference to keep the import linted in case the local Drizzle helper
  // tree-shakes differently across versions.
  void incomingEvent;
  void lt;
}

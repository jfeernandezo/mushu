import { createLogger } from '@mushu/shared/logger';
import type { MaintenanceJob } from '../queues.ts';
import { refreshMetaTokens } from './refresh-tokens.ts';
import { sweepIncomingEvents } from './sweep-events.ts';

const logger = createLogger('worker.maintenance');

/**
 * Single dispatcher for every recurring background job. Discriminator on
 * `kind` so we can add new sweepers without spinning up new BullMQ workers.
 */
export async function runMaintenance(job: MaintenanceJob): Promise<void> {
  switch (job.kind) {
    case 'sweep_incoming_events':
      await sweepIncomingEvents();
      return;
    case 'sweep_email_delivery':
      // Wired in Sprint E.3 (email_delivery table introduced there). For now
      // the queue may receive this job from a future migration but there's
      // nothing to do yet — log and move on.
      logger.info('sweep_email_delivery: not implemented yet, skipping');
      return;
    case 'refresh_meta_tokens':
      await refreshMetaTokens();
      return;
    default: {
      const _exhaustive: never = job;
      logger.warn({ job: _exhaustive }, 'unknown maintenance job');
    }
  }
}

import type { Dependencies } from '../property/ports.ts';
import { executeRun } from '../property/application/execute-run.ts';
import { logger } from '../platform/logger.ts';

export async function pollWorker(
  deps: Dependencies & {
    sleep?: (ms: number) => Promise<void>;
    shouldStop?: () => boolean;
  },
) {
  const sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  while (!deps.shouldStop?.()) {
    try {
      await deps.store.heartbeat();
      try {
        const scheduled = await deps.schedule?.();
        if (scheduled?.outcome === 'accepted') {
          logger.info('schedule.accepted', {
            scheduled_at: scheduled.scheduled_at,
          });
        }
      } catch (e) {
        // An unavailable scheduler must not prevent manual queue processing.
        logger.error('schedule.failed', e);
      }
      const r = await executeRun('worker', deps);
      if (r.state !== 'idle') logger.info('worker.result', { ...r });
    } catch (e) {
      logger.error('worker.failed', e);
    }
    if (!deps.shouldStop?.()) await sleep(30000);
  }
}

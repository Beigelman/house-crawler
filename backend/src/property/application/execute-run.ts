import type {
  CommandKind,
  Dependencies,
  EmailState,
  JobResult,
} from '../ports.ts';
import { sanitizeDiagnostic } from '../../platform/diagnostics.ts';
import { logger, withLogContext } from '../../platform/logger.ts';
import { collectProperties } from './collect-properties.ts';
import { validateProperties } from './validate-properties.ts';
import { notifyNewProperties } from './notify-new-properties.ts';

export async function executeRun(
  kind: CommandKind,
  deps: Dependencies,
): Promise<JobResult> {
  return await withLogContext({ command: kind }, async () => {
    let run;
    try {
      run = await deps.store.claim(kind);
    } catch (e) {
      logger.error('run.claim_failed', e);
      throw e;
    }
    if (!run) {
      const activeId = kind === 'worker'
        ? null
        : await deps.store.activeJobId?.() ?? null;
      return {
        job_id: activeId,
        state: kind === 'worker' ? 'idle' : 'busy',
        summary: kind === 'worker'
          ? 'Coletor ocioso'
          : `Execução ${activeId ?? 'não iniciada'}: busy`,
      };
    }
    return await withLogContext(
      { job_id: run.job_id, job_kind: run.kind },
      async () => {
        const started = performance.now();
        logger.info('run.started', { searches: run.searches });
        const controller = new AbortController();
        let renewal: Promise<unknown> = Promise.resolve();
        const timer = setInterval(() => {
          renewal = renewal.then(async () => {
            await deps.store.renew(run);
            await deps.store.heartbeat();
          }).catch((e) => {
            logger.error('run.lease_renewal_failed', e);
            controller.abort(e);
          });
        }, 30000);
        let email: EmailState = 'not_needed';
        try {
          const result = run.kind === 'validate'
            ? await validateProperties(run, deps, controller.signal)
            : await collectProperties(run, deps, controller.signal);
          const { successes, failures } = result;
          email = await notifyNewProperties(
            run,
            result.newProperties,
            deps,
            controller.signal,
          );
          const state = failures
            ? (successes ? 'partial' : 'failed')
            : 'succeeded';
          await deps.store.finish(run, state, email);
          logger.info('run.completed', {
            state,
            email,
            successes,
            failures,
            duration_ms: Math.round(performance.now() - started),
          });
          return {
            job_id: run.job_id,
            state,
            summary: `Execução ${run.job_id}: ${state}`,
          };
        } catch (e) {
          logger.error('run.failed', e, {
            email,
            duration_ms: Math.round(performance.now() - started),
          });
          if (!controller.signal.aborted) {
            try {
              await deps.store.finish(
                run,
                'failed',
                email,
                sanitizeDiagnostic(e),
              );
            } catch (finishError) {
              logger.error('run.finish_failed', finishError);
            }
          }
          throw e;
        } finally {
          clearInterval(timer);
          await renewal;
        }
      },
    );
  });
}

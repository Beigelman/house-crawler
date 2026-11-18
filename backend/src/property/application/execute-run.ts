import type {
  CommandKind,
  Dependencies,
  EmailState,
  RunResult,
} from '../ports.ts';
import { sanitizeDiagnostic } from '../../platform/diagnostics.ts';
import { collectProperties } from './collect-properties.ts';
import { validateProperties } from './validate-properties.ts';
import { notifyNewProperties } from './notify-new-properties.ts';

export async function executeRun(
  kind: CommandKind,
  deps: Dependencies,
): Promise<RunResult> {
  const run = await deps.store.claim(kind);
  if (!run) {
    const activeId = kind === 'worker'
      ? null
      : await deps.store.activeRunId?.() ?? null;
    return {
      run_id: activeId,
      state: kind === 'worker' ? 'idle' : 'busy',
      summary: kind === 'worker'
        ? 'Coletor ocioso'
        : `Execução ${activeId ?? 'não iniciada'}: busy`,
    };
  }
  const controller = new AbortController();
  let renewal: Promise<unknown> = Promise.resolve();
  const timer = setInterval(() => {
    renewal = renewal.then(async () => {
      await deps.store.renew(run);
      await deps.store.heartbeat();
    }).catch((e) => {
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
    const state = failures ? (successes ? 'partial' : 'failed') : 'succeeded';
    await deps.store.finish(run, state, email);
    return {
      run_id: run.run_id,
      state,
      summary: `Execução ${run.run_id}: ${state}`,
    };
  } catch (e) {
    if (!controller.signal.aborted) {
      try {
        await deps.store.source(run, {
          source: 'system',
          profile_id: null,
          count: 0,
          outcome: 'failed',
          error_category: sanitizeDiagnostic(e),
        });
        await deps.store.finish(run, 'failed', email);
      } catch { /* Lost leases cannot commit diagnostic writes. */ }
    }
    throw e;
  } finally {
    clearInterval(timer);
    await renewal;
  }
}

import type { Dependencies } from '../property/ports.ts';
import { executeRun } from '../property/application/execute-run.ts';
import { sanitizeDiagnostic } from '../platform/diagnostics.ts';

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
          console.log(`Coleta agendada: ${scheduled.scheduled_at}`);
        }
      } catch (e) {
        // An unavailable scheduler must not prevent manual queue processing.
        console.error('Erro do agendamento:', sanitizeDiagnostic(e));
      }
      const r = await executeRun('worker', deps);
      if (r.state !== 'idle') console.log(r.summary);
    } catch (e) {
      console.error('Erro do coletor:', sanitizeDiagnostic(e));
    }
    // Keep the dashboard heartbeat fresh while queue polling waits an hour.
    for (
      let waited = 0;
      waited < 3600000 && !deps.shouldStop?.();
      waited += 30000
    ) {
      await sleep(30000);
      if (waited + 30000 < 3600000 && !deps.shouldStop?.()) {
        try {
          await deps.store.heartbeat();
        } catch (e) {
          console.error('Erro do heartbeat:', sanitizeDiagnostic(e));
        }
      }
    }
  }
}

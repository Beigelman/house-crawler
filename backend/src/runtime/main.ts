import { loadConfiguration } from './config.ts';
import { createDependencies } from './dependencies.ts';
import { pollWorker } from './poll-worker.ts';
import { exitCode } from './exit-code.ts';
import { executeRun } from '../property/application/execute-run.ts';
import { sanitizeDiagnostic } from '../platform/diagnostics.ts';
export async function main(kind: 'collect' | 'validate' | 'worker') {
  const config = await loadConfiguration();
  try {
    const deps = createDependencies(config);
    if (kind === 'worker') {
      await pollWorker(deps);
      return 0;
    }
    const result = await executeRun(kind, deps);
    console.log(result.summary);
    return exitCode(result.state);
  } catch (e) {
    console.error('Execução não concluída:', sanitizeDiagnostic(e));
    return 1;
  }
}

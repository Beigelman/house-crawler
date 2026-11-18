import { load } from '@std/dotenv';
import { DfImoveisProvider } from '../providers/df_imoveis.ts';
import { WimoveisProvider } from '../providers/wimoveis.ts';
import { sendNewPropertiesEmail } from '../email/email.ts';
import { propertyStore } from './store.ts';
import {
  type Dependencies,
  executeRun,
  exitCode,
  pollWorker,
  sanitizeDiagnostic,
} from './runner.ts';
export async function main(kind: 'collect' | 'validate' | 'worker') {
  await load({ export: true });
  try {
    const store = propertyStore();
    const deps: Dependencies = {
      store,
      schedule: Deno.env.get('WORKER_SCHEDULE_ENABLED') === 'false'
        ? undefined
        : store.schedule,
      sendEmail: sendNewPropertiesEmail,
      providers: (id, params, signal) => {
        const p = id === 'dfimoveis'
          ? new DfImoveisProvider(params, signal)
          : new WimoveisProvider(params, signal);
        return {
          collect: () => p.collectOutcome(),
          verify: (url) => p.verify(url),
        };
      },
    };
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

import type { CommandKind } from '../property/ports.ts';
import { loadConfiguration } from './config.ts';
import { createDependencies } from './dependencies.ts';
import { pollWorker } from './poll-worker.ts';
import { exitCode } from './exit-code.ts';
import { executeRun } from '../property/application/execute-run.ts';
import { logger } from '../platform/logger.ts';

export async function main(kind: CommandKind) {
  try {
    const config = await loadConfiguration();
    const deps = createDependencies(config);
    if (kind === 'worker') {
      await pollWorker(deps);
      return 0;
    }
    const result = await executeRun(kind, deps);
    logger.info('command.completed', { command: kind, ...result });
    return exitCode(result.state);
  } catch (e) {
    logger.error('command.failed', e, { command: kind });
    return 1;
  }
}

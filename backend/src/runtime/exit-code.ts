import type { JobResult } from '../property/ports.ts';

export const exitCode = (state: JobResult['state']) =>
  state === 'succeeded' ? 0 : state === 'busy' ? 2 : 1;

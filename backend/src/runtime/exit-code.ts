import type { RunResult } from '../property/ports.ts';

export const exitCode = (state: RunResult['state']) =>
  state === 'succeeded' ? 0 : state === 'busy' ? 2 : 1;

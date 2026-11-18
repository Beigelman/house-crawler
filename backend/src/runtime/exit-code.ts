export const exitCode = (state: string) =>
  state === 'succeeded' ? 0 : state === 'busy' ? 2 : 1;

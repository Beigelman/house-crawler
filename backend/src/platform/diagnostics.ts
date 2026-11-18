export function sanitizeDiagnostic(e: unknown): string {
  const s = e instanceof Error ? e.message : '';
  return /403/.test(s)
    ? 'blocked'
    : /timeout|timed out/i.test(s)
    ? 'timeout'
    : /database/i.test(s)
    ? 'database'
    : /network|fetch/i.test(s)
    ? 'network'
    : /HTTP/.test(s)
    ? 'http'
    : /parse|extract/i.test(s)
    ? 'parse'
    : 'internal';
}

export function parseBRL(v: string): number | null {
  const s = v.trim().replace(/^R\$\s*/, '');
  if (!/^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{2})?$/.test(s)) return null;
  const n = Math.round(Number(s.replaceAll('.', '').replace(',', '.')) * 100);
  return Number.isSafeInteger(n) ? n : null;
}

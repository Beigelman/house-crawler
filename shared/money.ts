// Shift the decimal representation before rounding, avoiding 0.29 * 100 < 29.
export function toCentavos(value: number): number {
  const [coefficient, exponent = '0'] = String(value).split('e');
  return Math.round(Number(coefficient + 'e' + (Number(exponent) + 2)));
}

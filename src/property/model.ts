export type SearchParams = {
  neighborhoods: string[];
  numberOfRooms: number[];
  numberOfSuites: number;
  minArea: number;
  maxArea: number;
  minPrice: number;
  maxPrice: number;
  hasElevator: boolean;
  hasParking: boolean;
};
export type Property = {
  titulo: string;
  valor: string;
  link: string;
  source?: string | null;
  price_cents?: number | null;
  area?: number | null;
  rooms?: number | null;
  suites?: number | null;
  neighborhood?: string | null;
  has_elevator?: boolean | null;
  has_parking?: boolean | null;
  photo?: string | null;
  verification?: string;
};
export type Listing = Property & {
  created_at: string;
  last_seen_at: string | null;
  availability: string;
  price_observed_at: string | null;
  median_m2: number | null;
  peer_count: number | null;
  discount_pct: number | null;
  cohort: string | null;
  comparison_at: string | null;
  price_cents: number | null;
};
export type Profile = {
  id: string;
  name: string;
  enabled: boolean;
  params: SearchParams;
  providers: string[];
};
// Shift the decimal representation before rounding, avoiding 0.29 * 100 < 29.
export function toCentavos(value: number): number {
  const [coefficient, exponent = '0'] = String(value).split('e');
  return Math.round(Number(coefficient + 'e' + (Number(exponent) + 2)));
}
export function matchesProfile(p: Property, s: SearchParams): boolean {
  return p.neighborhood != null && s.neighborhoods.includes(p.neighborhood) &&
    p.rooms != null && s.numberOfRooms.includes(p.rooms) && p.area != null &&
    p.area >= s.minArea && p.area <= s.maxArea && p.price_cents != null &&
    p.price_cents >= toCentavos(s.minPrice) &&
    p.price_cents <= toCentavos(s.maxPrice) &&
    (s.numberOfSuites === 0 ||
      (p.suites != null && p.suites >= s.numberOfSuites)) &&
    (!s.hasElevator || p.has_elevator === true) &&
    (!s.hasParking || p.has_parking === true);
}
export function parseBRL(v: string): number | null {
  const s = v.trim().replace(/^R\$\s*/, '');
  if (!/^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{2})?$/.test(s)) return null;
  const n = Math.round(Number(s.replaceAll('.', '').replace(',', '.')) * 100);
  return Number.isSafeInteger(n) ? n : null;
}

import type {
  ScrapedListing,
  SearchParams,
} from '../../../../shared/property.ts';
import { toCentavos } from '../../../../shared/money.ts';

export function matchesProfile(p: ScrapedListing, s: SearchParams): boolean {
  return p.neighborhood != null && s.neighborhoods.includes(p.neighborhood) &&
    p.bedrooms != null && s.numberOfRooms.includes(p.bedrooms) &&
    p.area_m2 != null &&
    p.area_m2 >= s.minArea && p.area_m2 <= s.maxArea && p.price_cents != null &&
    p.price_cents >= toCentavos(s.minPrice) &&
    p.price_cents <= toCentavos(s.maxPrice) &&
    (s.numberOfSuites === 0 ||
      (p.suites != null && p.suites >= s.numberOfSuites)) &&
    (!s.hasElevator || p.has_elevator === true) &&
    (!s.hasParking || p.has_parking === true);
}

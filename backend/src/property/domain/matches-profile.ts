import type { Property, SearchParams } from '../../../../shared/property.ts';
import { toCentavos } from '../../../../shared/money.ts';

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

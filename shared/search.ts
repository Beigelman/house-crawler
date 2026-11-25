import type { Database } from './database.types.ts';
import type { SavedSearch } from './property.ts';
import { toCentavos } from './money.ts';

export type SearchRow = Database['public']['Tables']['saved_searches']['Row'];

// Forms and portal query builders use BRL; persistence always uses centavos.
export function fromSearchRow(row: SearchRow): SavedSearch {
  return {
    id: row.id,
    name: row.name,
    enabled: row.enabled,
    notificationEmails: row.notification_emails,
    providers: row.sources,
    params: {
      neighborhoods: row.neighborhoods,
      numberOfRooms: row.bedrooms,
      numberOfSuites: row.min_suites,
      minArea: Number(row.min_area_m2),
      maxArea: Number(row.max_area_m2),
      minPrice: Number(row.min_price_cents) / 100,
      maxPrice: Number(row.max_price_cents) / 100,
      hasElevator: row.has_elevator === true,
      hasParking: row.has_parking === true,
    },
  };
}

export function toSearchRow(search: SavedSearch) {
  return {
    id: search.id,
    name: search.name,
    enabled: search.enabled,
    notification_emails: search.notificationEmails,
    neighborhoods: search.params.neighborhoods,
    bedrooms: search.params.numberOfRooms,
    min_suites: search.params.numberOfSuites,
    min_area_m2: search.params.minArea,
    max_area_m2: search.params.maxArea,
    min_price_cents: toCentavos(search.params.minPrice),
    max_price_cents: toCentavos(search.params.maxPrice),
    has_elevator: search.params.hasElevator || null,
    has_parking: search.params.hasParking || null,
    sources: search.providers,
  };
}

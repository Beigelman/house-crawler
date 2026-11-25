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

export type ScrapedListing = {
  source_listing_id?: string | null;
  title: string;
  url: string;
  source?: string | null;
  price_cents?: number | null;
  area_m2?: number | null;
  bedrooms?: number | null;
  suites?: number | null;
  neighborhood?: string | null;
  has_elevator?: boolean | null;
  has_parking?: boolean | null;
  photo_url?: string | null;
  last_check_result?: string;
};

export type Listing = ScrapedListing & {
  id: string;
  first_seen_at: string;
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

export type SavedSearch = {
  id: string;
  name: string;
  enabled: boolean;
  notificationEmails: string[];
  params: SearchParams;
  providers: string[];
};

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

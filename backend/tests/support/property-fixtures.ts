// deno-lint-ignore-file require-await
import type { ScrapedListing } from '../../../shared/property.ts';
export const params = {
  neighborhoods: ['asa-norte'],
  numberOfRooms: [3],
  numberOfSuites: 1,
  minArea: 90,
  maxArea: 150,
  minPrice: 1000000,
  maxPrice: 1400000,
  hasElevator: true,
  hasParking: true,
};
export const listing = {
  url: 'https://www.wimoveis.com.br/imovel/a',
  title: 'Apartamento',
  source: 'wimoveis',
  price_cents: 120000000,
  area_m2: 100,
  bedrooms: 3,
  suites: 1,
  neighborhood: 'asa-norte',
  has_elevator: true,
  has_parking: true,
  photo_url: null,
};
export function harness(outcomes: ('succeeded' | 'failed')[] = ['succeeded']) {
  const calls: { name: string; value: unknown }[] = [];
  let fresh = true;
  const store = {
    claim: async () => ({
      job_id: 'run',
      token: 1,
      kind: 'collect' as const,
      searches: [{
        id: 'profile',
        name: 'Test',
        enabled: true,
        params,
        providers: outcomes.map((_, i) => 'source' + i),
      }],
    }),
    renew: async () => {},
    listings: async () => [],
    save: async (_r: unknown, items: ScrapedListing[]) => {
      calls.push({ name: 'save', value: items });
      const n = fresh ? items : [];
      fresh = false;
      return n;
    },
    source: async (_r: unknown, value: unknown) => {
      calls.push({ name: 'source', value });
    },
    finish: async (_r: unknown, state: string, email: string) => {
      calls.push({ name: 'finish', value: { state, email } });
    },
    heartbeat: async () => {},
  };
  const providers = (_id: string) => ({
    collect: async () => ({
      properties: [listing],
      outcome: outcomes[Number(_id.slice(-1))],
      error: outcomes[Number(_id.slice(-1))] === 'failed' ? 'blocked' : null,
    }),
    verify: async () => ({ last_check_result: 'unknown' }),
  });
  const sendEmail = async (items: ScrapedListing[]) => {
    calls.push({ name: 'email', value: items });
    return { success: true };
  };
  return { calls, store, providers, sendEmail };
}

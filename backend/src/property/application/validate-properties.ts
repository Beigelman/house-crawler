import type { CrawlJob, Dependencies } from '../ports.ts';
import type { ScrapedListing } from '../../../../shared/property.ts';
import { providerIdForUrl } from '../provider-id.ts';

export async function validateProperties(
  run: CrawlJob,
  deps: Dependencies,
  signal: AbortSignal,
) {
  let successes = 0;
  let failures = 0;
  for (const p of await deps.store.listings()) {
    if (signal.aborted) throw signal.reason;
    const id = providerIdForUrl(p.url);
    if (!id) {
      await deps.store.save(
        run,
        [{ ...p, last_check_result: 'unknown' }],
        null,
      );
      failures++;
      continue;
    }
    const provider = deps.providers(
      id,
      run.searches[0]?.params ??
        {
          neighborhoods: [],
          numberOfRooms: [],
          numberOfSuites: 0,
          minArea: 0,
          maxArea: 0,
          minPrice: 0,
          maxPrice: 0,
          hasElevator: false,
          hasParking: false,
        },
      signal,
    );
    const result = await provider.verify(p.url);
    await deps.store.save(run, [{ ...p, ...result }], null);
    result.last_check_result === 'unknown' ? failures++ : successes++;
    await deps.store.source(run, {
      source: id,
      search_id: null,
      count: 1,
      outcome: result.last_check_result === 'unknown' ? 'failed' : 'succeeded',
      error_category: result.last_check_result === 'unknown'
        ? 'verification_unknown'
        : null,
    });
    await (deps.sleep ??
      ((ms: number) => new Promise((r) => setTimeout(r, ms))))(1500);
  }
  return { successes, failures, newProperties: [] as ScrapedListing[] };
}

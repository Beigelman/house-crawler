import type { Dependencies, Run } from '../ports.ts';
import type { Property } from '../../../../shared/property.ts';
import { providerIdForUrl } from '../provider-id.ts';

export async function validateProperties(
  run: Run,
  deps: Dependencies,
  signal: AbortSignal,
) {
  let successes = 0;
  let failures = 0;
  for (const p of await deps.store.listings()) {
    if (signal.aborted) throw signal.reason;
    const id = providerIdForUrl(p.link);
    if (!id) {
      await deps.store.save(run, [{ ...p, verification: 'unknown' }], null);
      failures++;
      continue;
    }
    const provider = deps.providers(
      id,
      run.profiles[0]?.params ??
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
    const result = await provider.verify(p.link);
    await deps.store.save(run, [{ ...p, ...result }], null);
    result.verification === 'unknown' ? failures++ : successes++;
    await deps.store.source(run, {
      source: id,
      profile_id: null,
      count: 1,
      outcome: result.verification,
      error_category: result.verification === 'unknown'
        ? 'verification_unknown'
        : null,
    });
    await (deps.sleep ??
      ((ms: number) => new Promise((r) => setTimeout(r, ms))))(1500);
  }
  return { successes, failures, newProperties: [] as Property[] };
}
